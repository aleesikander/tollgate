#!/usr/bin/env python3
"""
Verification script for Prompt 2 - Policy Engine + Approval Workflow.

This script exercises every item on the verification checklist against the
actual running API. It produces a pass/fail table at the end.

Usage:
    python scripts/verify_prompt_2.py

Requirements:
    - Docker containers running (Postgres + Redis)
    - API running on localhost:8000
    - Database migrations applied
"""

import asyncio
import statistics
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Add src to path for imports
sys.path.insert(0, "src")

from tollgate.config import get_settings
from tollgate.models import Action, ApprovalRequest, Base

settings = get_settings()

# Test configuration
API_BASE_URL = "http://localhost:8000"
TEST_EMAIL = f"verify_{int(time.time())}@test.com"
TEST_PASSWORD = "testpassword123"
TEST_ORG_NAME = f"Verify Org {int(time.time())}"

# Policy YAML for testing
POLICY_YAML = """version: 1
rules:
  - action: issue_refund
    when: { amount: { lte: 50 } }
    decide: allow
  - action: issue_refund
    when: { amount: { gt: 50, lte: 500 } }
    decide: require_approval
    approvers: ["#support-leads"]
  - action: issue_refund
    when: { amount: { gt: 500 } }
    decide: deny
    reason: "Refund exceeds maximum allowed amount"
  - action: delete_account
    decide: deny
    reason: "Account deletion never allowed for agents"
default: deny
"""

# Policy v2 that denies small refunds (for rollback test)
POLICY_V2_YAML = """version: 1
rules:
  - action: issue_refund
    when: { amount: { lte: 50 } }
    decide: deny
    reason: "Small refunds now denied in v2"
  - action: issue_refund
    when: { amount: { gt: 50, lte: 500 } }
    decide: require_approval
    approvers: ["#support-leads"]
  - action: issue_refund
    when: { amount: { gt: 500 } }
    decide: deny
    reason: "Refund exceeds maximum allowed amount"
  - action: delete_account
    decide: deny
    reason: "Account deletion never allowed for agents"
default: deny
"""


@dataclass
class CheckResult:
    """Result of a verification check."""
    number: int
    name: str
    status: str  # "PASS", "FAIL", "PARTIAL"
    notes: str = ""


@dataclass
class TestContext:
    """Holds test state across checks."""
    user_id: str = ""
    org_id: str = ""
    jwt_token: str = ""
    agent_id: str = ""
    api_key: str = ""
    pending_action_id: str = ""
    expiry_test_action_id: str = ""
    results: list[CheckResult] = field(default_factory=list)


async def get_db_session() -> AsyncSession:
    """Create a database session for direct DB access."""
    engine = create_async_engine(str(settings.database_url))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session()


def add_result(ctx: TestContext, number: int, name: str, status: str, notes: str = "") -> None:
    """Add a check result."""
    ctx.results.append(CheckResult(number=number, name=name, status=status, notes=notes))
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"  {symbol} Check {number}: {name} - {status}")
    if notes:
        print(f"      Notes: {notes}")


async def check_1_signup_and_agent(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 1: Signup + agent creation works."""
    print("\n--- Check 1: Signup + Agent Creation ---")

    try:
        # Signup
        signup_resp = await client.post(
            f"{API_BASE_URL}/auth/signup",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "org_name": TEST_ORG_NAME,
            },
        )

        if signup_resp.status_code != 201:
            add_result(ctx, 1, "Signup + agent creation", "FAIL",
                      f"Signup failed: {signup_resp.status_code} - {signup_resp.text}")
            return

        signup_data = signup_resp.json()
        ctx.user_id = signup_data["user_id"]
        ctx.org_id = signup_data["org_id"]
        ctx.jwt_token = signup_data["access_token"]

        # Create agent
        agent_resp = await client.post(
            f"{API_BASE_URL}/agents",
            json={"name": "Verification Test Agent"},
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

        if agent_resp.status_code != 201:
            add_result(ctx, 1, "Signup + agent creation", "FAIL",
                      f"Agent creation failed: {agent_resp.status_code} - {agent_resp.text}")
            return

        agent_data = agent_resp.json()
        ctx.agent_id = agent_data["id"]
        ctx.api_key = agent_data["api_key"]

        add_result(ctx, 1, "Signup + agent creation", "PASS",
                  f"user_id={ctx.user_id}, agent_id={ctx.agent_id}")

    except Exception as e:
        add_result(ctx, 1, "Signup + agent creation", "FAIL", f"Exception: {e}")


async def check_2_upload_policy(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 2: Upload a policy and verify it parses."""
    print("\n--- Check 2: Policy Upload + Parse ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/agents/{ctx.agent_id}/policies",
            json={"source_yaml": POLICY_YAML},
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

        if resp.status_code != 201:
            add_result(ctx, 2, "Policy upload + parse", "FAIL",
                      f"Upload failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        # Verify structure
        if data.get("version") != 1:
            add_result(ctx, 2, "Policy upload + parse", "FAIL",
                      f"Expected version=1, got {data.get('version')}")
            return

        if not data.get("is_active"):
            add_result(ctx, 2, "Policy upload + parse", "FAIL",
                      f"Expected is_active=true, got {data.get('is_active')}")
            return

        parsed = data.get("parsed_json", {})
        if len(parsed.get("rules", [])) != 4:
            add_result(ctx, 2, "Policy upload + parse", "FAIL",
                      f"Expected 4 rules, got {len(parsed.get('rules', []))}")
            return

        add_result(ctx, 2, "Policy upload + parse", "PASS",
                  f"version={data['version']}, is_active={data['is_active']}, rules_count=4")

    except Exception as e:
        add_result(ctx, 2, "Policy upload + parse", "FAIL", f"Exception: {e}")


async def check_3_get_active_policy(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 3: Verify active policy retrieval."""
    print("\n--- Check 3: Get Active Policy ---")

    try:
        resp = await client.get(
            f"{API_BASE_URL}/agents/{ctx.agent_id}/policies/active",
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 3, "Get active policy", "FAIL",
                      f"GET failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("version") != 1 or not data.get("is_active"):
            add_result(ctx, 3, "Get active policy", "FAIL",
                      f"version={data.get('version')}, is_active={data.get('is_active')}")
            return

        parsed = data.get("parsed_json", {})
        if parsed.get("default") != "deny":
            add_result(ctx, 3, "Get active policy", "FAIL",
                      f"Expected default=deny, got {parsed.get('default')}")
            return

        add_result(ctx, 3, "Get active policy", "PASS",
                  f"version=1, is_active=true, default=deny")

    except Exception as e:
        add_result(ctx, 3, "Get active policy", "FAIL", f"Exception: {e}")


async def check_4_allow_path(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 4: Allow path - small refund."""
    print("\n--- Check 4: Allow Path (amount=30) ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 30, "customer_id": "c_1"},
                "idempotency_key": f"allow-test-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 4, "Allow path", "FAIL",
                      f"Check failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "allowed":
            add_result(ctx, 4, "Allow path", "FAIL",
                      f"Expected decision=allowed, got {data.get('decision')}")
            return

        add_result(ctx, 4, "Allow path", "PASS",
                  f"decision=allowed, action_id={data.get('action_id')}")

    except Exception as e:
        add_result(ctx, 4, "Allow path", "FAIL", f"Exception: {e}")


async def check_5_pending_path(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 5: Pending path - medium refund."""
    print("\n--- Check 5: Pending Path (amount=200) ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 200, "customer_id": "c_2"},
                "idempotency_key": f"pending-test-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 5, "Pending path", "FAIL",
                      f"Check failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "pending":
            add_result(ctx, 5, "Pending path", "FAIL",
                      f"Expected decision=pending, got {data.get('decision')}")
            return

        ctx.pending_action_id = data.get("action_id", "")

        # Verify approval_request was created in DB
        session = await get_db_session()
        try:
            result = await session.execute(
                select(ApprovalRequest).where(ApprovalRequest.action_id == ctx.pending_action_id)
            )
            approval_req = result.scalar_one_or_none()

            if not approval_req:
                add_result(ctx, 5, "Pending path", "FAIL",
                          "No approval_request row created in DB")
                return

            if approval_req.status.value != "pending":
                add_result(ctx, 5, "Pending path", "FAIL",
                          f"Expected approval_request status=pending, got {approval_req.status.value}")
                return
        finally:
            await session.close()

        add_result(ctx, 5, "Pending path", "PASS",
                  f"decision=pending, action_id={ctx.pending_action_id}, approval_request created")

    except Exception as e:
        add_result(ctx, 5, "Pending path", "FAIL", f"Exception: {e}")


async def check_6_poll_pending(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 6: Polling pending action."""
    print("\n--- Check 6: Poll Pending Action ---")

    try:
        resp = await client.get(
            f"{API_BASE_URL}/v1/check/{ctx.pending_action_id}",
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 6, "Poll pending action", "FAIL",
                      f"Poll failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "pending":
            add_result(ctx, 6, "Poll pending action", "FAIL",
                      f"Expected decision=pending, got {data.get('decision')}")
            return

        if data.get("action_id") != ctx.pending_action_id:
            add_result(ctx, 6, "Poll pending action", "FAIL",
                      f"action_id mismatch: expected {ctx.pending_action_id}, got {data.get('action_id')}")
            return

        add_result(ctx, 6, "Poll pending action", "PASS",
                  f"decision=pending, action_id matches")

    except Exception as e:
        add_result(ctx, 6, "Poll pending action", "FAIL", f"Exception: {e}")


async def check_7_approve_action(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 7: Approve a pending action."""
    print("\n--- Check 7: Approve Pending Action ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/v1/actions/{ctx.pending_action_id}/decide",
            json={"decision": "approved", "user_id": ctx.user_id},
        )

        if resp.status_code != 200:
            add_result(ctx, 7, "Approve pending action", "FAIL",
                      f"Decide failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "approved":
            add_result(ctx, 7, "Approve pending action", "FAIL",
                      f"Expected decision=approved, got {data.get('decision')}")
            return

        # Verify DB state
        session = await get_db_session()
        try:
            # Check action
            action_result = await session.execute(
                select(Action).where(Action.id == ctx.pending_action_id)
            )
            action = action_result.scalar_one_or_none()

            if not action or action.decision.value != "approved":
                add_result(ctx, 7, "Approve pending action", "FAIL",
                          f"Action decision in DB: {action.decision.value if action else 'None'}")
                return

            if not action.decided_at:
                add_result(ctx, 7, "Approve pending action", "FAIL",
                          "decided_at not populated")
                return

            # Check approval_request
            ar_result = await session.execute(
                select(ApprovalRequest).where(ApprovalRequest.action_id == ctx.pending_action_id)
            )
            ar = ar_result.scalar_one_or_none()

            if not ar or ar.status.value != "approved":
                add_result(ctx, 7, "Approve pending action", "FAIL",
                          f"ApprovalRequest status: {ar.status.value if ar else 'None'}")
                return
        finally:
            await session.close()

        add_result(ctx, 7, "Approve pending action", "PASS",
                  "decision=approved, decided_at populated, approval_request updated")

    except Exception as e:
        add_result(ctx, 7, "Approve pending action", "FAIL", f"Exception: {e}")


async def check_8_poll_after_approval(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 8: Polling after approval."""
    print("\n--- Check 8: Poll After Approval ---")

    try:
        resp = await client.get(
            f"{API_BASE_URL}/v1/check/{ctx.pending_action_id}",
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 8, "Poll after approval", "FAIL",
                      f"Poll failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "approved":
            add_result(ctx, 8, "Poll after approval", "FAIL",
                      f"Expected decision=approved, got {data.get('decision')}")
            return

        add_result(ctx, 8, "Poll after approval", "PASS",
                  "decision=approved")

    except Exception as e:
        add_result(ctx, 8, "Poll after approval", "FAIL", f"Exception: {e}")


async def check_9_explicit_deny(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 9: Explicit deny path - delete_account."""
    print("\n--- Check 9: Explicit Deny Path (delete_account) ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "delete_account",
                "payload": {"user_id": "u_1"},
                "idempotency_key": f"deny-test-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 9, "Explicit deny path", "FAIL",
                      f"Check failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "denied":
            add_result(ctx, 9, "Explicit deny path", "FAIL",
                      f"Expected decision=denied, got {data.get('decision')}")
            return

        reason = data.get("reason", "")
        if "never allowed" not in reason.lower():
            add_result(ctx, 9, "Explicit deny path", "PARTIAL",
                      f"Expected reason to mention 'never allowed', got: {reason}")
            return

        add_result(ctx, 9, "Explicit deny path", "PASS",
                  f"decision=denied, reason='{reason}'")

    except Exception as e:
        add_result(ctx, 9, "Explicit deny path", "FAIL", f"Exception: {e}")


async def check_10_default_deny(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 10: Default deny - action not in policy."""
    print("\n--- Check 10: Default Deny (transfer_funds not in policy) ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "transfer_funds",
                "payload": {"amount": 100},
                "idempotency_key": f"default-deny-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 10, "Default deny", "FAIL",
                      f"Check failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "denied":
            add_result(ctx, 10, "Default deny", "FAIL",
                      f"Expected decision=denied, got {data.get('decision')}")
            return

        add_result(ctx, 10, "Default deny", "PASS",
                  f"decision=denied, reason='{data.get('reason', '')}'")

    except Exception as e:
        add_result(ctx, 10, "Default deny", "FAIL", f"Exception: {e}")


async def check_11_threshold_deny(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 11: Threshold deny - amount > 500."""
    print("\n--- Check 11: Threshold Deny (amount=9999) ---")

    try:
        resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 9999, "customer_id": "c_3"},
                "idempotency_key": f"threshold-deny-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200:
            add_result(ctx, 11, "Threshold deny", "FAIL",
                      f"Check failed: {resp.status_code} - {resp.text}")
            return

        data = resp.json()

        if data.get("decision") != "denied":
            add_result(ctx, 11, "Threshold deny", "FAIL",
                      f"Expected decision=denied, got {data.get('decision')}")
            return

        reason = data.get("reason", "")
        if "exceeds" not in reason.lower() and "maximum" not in reason.lower():
            add_result(ctx, 11, "Threshold deny", "PARTIAL",
                      f"Expected reason about exceeds/maximum, got: {reason}")
            return

        add_result(ctx, 11, "Threshold deny", "PASS",
                  f"decision=denied, reason='{reason}'")

    except Exception as e:
        add_result(ctx, 11, "Threshold deny", "FAIL", f"Exception: {e}")


async def check_12_auto_expiry(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 12: Auto-expiry of pending actions."""
    print("\n--- Check 12: Auto-Expiry of Pending Actions ---")
    print("    (This test takes ~40 seconds to wait for background job)")

    try:
        # Create a pending action
        resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 200, "customer_id": "c_expiry"},
                "idempotency_key": f"expiry-test-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if resp.status_code != 200 or resp.json().get("decision") != "pending":
            add_result(ctx, 12, "Auto-expiry", "FAIL",
                      f"Failed to create pending action: {resp.text}")
            return

        action_id = resp.json()["action_id"]
        ctx.expiry_test_action_id = action_id

        # Update expires_at to 1 minute in the past via direct DB access
        session = await get_db_session()
        try:
            past_time = datetime.now(UTC) - timedelta(minutes=1)
            await session.execute(
                update(ApprovalRequest)
                .where(ApprovalRequest.action_id == action_id)
                .values(expires_at=past_time)
            )
            await session.commit()
        finally:
            await session.close()

        print("    Set expires_at to past, waiting 35 seconds for background job...")

        # Wait for background job (runs every 30s)
        await asyncio.sleep(35)

        # Poll the action
        poll_resp = await client.get(
            f"{API_BASE_URL}/v1/check/{action_id}",
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        if poll_resp.status_code != 200:
            add_result(ctx, 12, "Auto-expiry", "FAIL",
                      f"Poll failed: {poll_resp.status_code} - {poll_resp.text}")
            return

        data = poll_resp.json()

        # Should be rejected due to expiry
        if data.get("decision") == "rejected":
            reason = data.get("reason", "")
            if "timeout" in reason.lower() or "expired" in reason.lower():
                add_result(ctx, 12, "Auto-expiry", "PASS",
                          f"decision=rejected, reason mentions timeout/expiry")
            else:
                add_result(ctx, 12, "Auto-expiry", "PARTIAL",
                          f"decision=rejected but reason unclear: {reason}")
            return

        if data.get("decision") == "denied":
            # The mapped response might show "denied" for rejected
            add_result(ctx, 12, "Auto-expiry", "PASS",
                      f"decision=denied (mapped from rejected), expiry worked")
            return

        if data.get("decision") == "pending":
            # Wait another 30 seconds and try again
            print("    Still pending, waiting another 30 seconds...")
            await asyncio.sleep(30)

            poll_resp2 = await client.get(
                f"{API_BASE_URL}/v1/check/{action_id}",
                headers={"Authorization": f"Bearer {ctx.api_key}"},
            )
            data2 = poll_resp2.json()

            if data2.get("decision") == "pending":
                add_result(ctx, 12, "Auto-expiry", "FAIL",
                          "Action still pending after 65 seconds - background job may be broken")
            else:
                add_result(ctx, 12, "Auto-expiry", "PASS",
                          f"Expiry worked on second check: decision={data2.get('decision')}")
            return

        add_result(ctx, 12, "Auto-expiry", "FAIL",
                  f"Unexpected decision: {data.get('decision')}")

    except Exception as e:
        add_result(ctx, 12, "Auto-expiry", "FAIL", f"Exception: {e}")


async def check_13_policy_rollback(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 13: Policy versioning + rollback."""
    print("\n--- Check 13: Policy Versioning + Rollback ---")

    try:
        # Create v2 policy that denies small refunds
        v2_resp = await client.post(
            f"{API_BASE_URL}/agents/{ctx.agent_id}/policies",
            json={"source_yaml": POLICY_V2_YAML},
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

        if v2_resp.status_code != 201:
            add_result(ctx, 13, "Policy rollback", "FAIL",
                      f"v2 creation failed: {v2_resp.status_code} - {v2_resp.text}")
            return

        v2_data = v2_resp.json()
        if v2_data.get("version") != 2:
            add_result(ctx, 13, "Policy rollback", "FAIL",
                      f"Expected v2, got version={v2_data.get('version')}")
            return

        # Test with v2 active - amount=30 should be DENIED
        check1_resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 30, "customer_id": "c_rollback_1"},
                "idempotency_key": f"rollback-v2-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        check1_data = check1_resp.json()
        if check1_data.get("decision") != "denied":
            add_result(ctx, 13, "Policy rollback", "FAIL",
                      f"With v2 active, expected denied, got {check1_data.get('decision')}")
            return

        # Rollback to v1
        rollback_resp = await client.post(
            f"{API_BASE_URL}/agents/{ctx.agent_id}/policies/1/activate",
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

        if rollback_resp.status_code != 200:
            add_result(ctx, 13, "Policy rollback", "FAIL",
                      f"Rollback failed: {rollback_resp.status_code} - {rollback_resp.text}")
            return

        # Test with v1 active - amount=30 should be ALLOWED
        check2_resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 30, "customer_id": "c_rollback_2"},
                "idempotency_key": f"rollback-v1-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        check2_data = check2_resp.json()
        if check2_data.get("decision") != "allowed":
            add_result(ctx, 13, "Policy rollback", "FAIL",
                      f"After rollback to v1, expected allowed, got {check2_data.get('decision')}")
            return

        add_result(ctx, 13, "Policy rollback", "PASS",
                  "v2 denied amount=30, rollback to v1 allowed amount=30")

    except Exception as e:
        add_result(ctx, 13, "Policy rollback", "FAIL", f"Exception: {e}")


async def check_14_cache_invalidation(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 14: Cache invalidation within 30s."""
    print("\n--- Check 14: Cache Invalidation ---")

    try:
        # v1 should be active from check 13
        # Activate v2 again
        await client.post(
            f"{API_BASE_URL}/agents/{ctx.agent_id}/policies/2/activate",
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

        # Immediately check - should return denied if cache invalidated
        immediate_resp = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 30, "customer_id": "c_cache_1"},
                "idempotency_key": f"cache-immediate-{uuid.uuid4()}",
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        immediate_data = immediate_resp.json()
        immediate_decision = immediate_data.get("decision")

        cache_invalidated_immediately = immediate_decision == "denied"

        if cache_invalidated_immediately:
            add_result(ctx, 14, "Cache invalidation", "PASS",
                      "Cache invalidated immediately on policy change")
        else:
            # Wait 35 seconds for cache TTL
            print("    Cache not immediately invalidated, waiting 35s for TTL...")
            await asyncio.sleep(35)

            delayed_resp = await client.post(
                f"{API_BASE_URL}/v1/check",
                json={
                    "action_name": "issue_refund",
                    "payload": {"amount": 30, "customer_id": "c_cache_2"},
                    "idempotency_key": f"cache-delayed-{uuid.uuid4()}",
                },
                headers={"Authorization": f"Bearer {ctx.api_key}"},
            )

            delayed_data = delayed_resp.json()

            if delayed_data.get("decision") == "denied":
                add_result(ctx, 14, "Cache invalidation", "PARTIAL",
                          f"Immediate: {immediate_decision} (stale cache), After 35s: denied (TTL expired). "
                          "Cache relies on 30s TTL, not immediate invalidation on policy change")
            else:
                add_result(ctx, 14, "Cache invalidation", "FAIL",
                          f"Even after 35s, decision was {delayed_data.get('decision')}, expected denied")

        # Restore v1 for subsequent tests
        await client.post(
            f"{API_BASE_URL}/agents/{ctx.agent_id}/policies/1/activate",
            headers={"Authorization": f"Bearer {ctx.jwt_token}"},
        )

    except Exception as e:
        add_result(ctx, 14, "Cache invalidation", "FAIL", f"Exception: {e}")


async def check_15_latency(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 15: Latency check - 100 sequential calls."""
    print("\n--- Check 15: Latency Check (100 calls) ---")

    try:
        latencies = []

        for i in range(100):
            start = time.perf_counter()
            resp = await client.post(
                f"{API_BASE_URL}/v1/check",
                json={
                    "action_name": "issue_refund",
                    "payload": {"amount": 30, "customer_id": f"c_latency_{i}"},
                    "idempotency_key": f"latency-{uuid.uuid4()}",
                },
                headers={"Authorization": f"Bearer {ctx.api_key}"},
            )
            end = time.perf_counter()

            if resp.status_code == 200:
                latencies.append((end - start) * 1000)  # Convert to ms

        if len(latencies) < 100:
            add_result(ctx, 15, "Latency check", "FAIL",
                      f"Only {len(latencies)}/100 requests succeeded")
            return

        latencies.sort()
        p50 = latencies[49]
        p95 = latencies[94]
        p99 = latencies[98]

        notes = f"p50={p50:.1f}ms, p95={p95:.1f}ms, p99={p99:.1f}ms"

        if p50 < 50:
            add_result(ctx, 15, "Latency check", "PASS", notes)
        else:
            add_result(ctx, 15, "Latency check", "FAIL",
                      f"{notes} - p50 >= 50ms target")

    except Exception as e:
        add_result(ctx, 15, "Latency check", "FAIL", f"Exception: {e}")


async def check_16_idempotency(client: httpx.AsyncClient, ctx: TestContext) -> None:
    """Check 16: Idempotency still works."""
    print("\n--- Check 16: Idempotency ---")

    try:
        idempotency_key = f"idempotency-test-{uuid.uuid4()}"

        # First call - should create pending action
        resp1 = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 200, "customer_id": "c_idem"},
                "idempotency_key": idempotency_key,
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        data1 = resp1.json()
        action_id_1 = data1.get("action_id")

        # Second call with same key
        resp2 = await client.post(
            f"{API_BASE_URL}/v1/check",
            json={
                "action_name": "issue_refund",
                "payload": {"amount": 200, "customer_id": "c_idem"},
                "idempotency_key": idempotency_key,
            },
            headers={"Authorization": f"Bearer {ctx.api_key}"},
        )

        data2 = resp2.json()
        action_id_2 = data2.get("action_id")

        # Verify same action_id
        if action_id_1 != action_id_2:
            add_result(ctx, 16, "Idempotency", "FAIL",
                      f"Different action_ids: {action_id_1} vs {action_id_2}")
            return

        # Verify only one row in DB
        session = await get_db_session()
        try:
            action_result = await session.execute(
                select(Action).where(Action.idempotency_key == idempotency_key)
            )
            actions = action_result.scalars().all()

            if len(actions) != 1:
                add_result(ctx, 16, "Idempotency", "FAIL",
                          f"Expected 1 action row, found {len(actions)}")
                return

            # Verify only one approval_request
            ar_result = await session.execute(
                select(ApprovalRequest).where(ApprovalRequest.action_id == action_id_1)
            )
            approval_requests = ar_result.scalars().all()

            if len(approval_requests) != 1:
                add_result(ctx, 16, "Idempotency", "FAIL",
                          f"Expected 1 approval_request, found {len(approval_requests)}")
                return
        finally:
            await session.close()

        add_result(ctx, 16, "Idempotency", "PASS",
                  "Same action_id, 1 action row, 1 approval_request")

    except Exception as e:
        add_result(ctx, 16, "Idempotency", "FAIL", f"Exception: {e}")


def print_results_table(ctx: TestContext) -> None:
    """Print the final results table."""
    print("\n" + "=" * 80)
    print("VERIFICATION RESULTS")
    print("=" * 80)
    print()
    print("| # | Check | Status | Notes |")
    print("|---|-------|--------|-------|")

    for r in ctx.results:
        symbol = "✅" if r.status == "PASS" else "❌" if r.status == "FAIL" else "⚠️"
        status_str = f"{symbol} {r.status}"
        notes = r.notes[:60] + "..." if len(r.notes) > 60 else r.notes
        print(f"| {r.number} | {r.name} | {status_str} | {notes} |")

    print()

    # Summary
    passed = sum(1 for r in ctx.results if r.status == "PASS")
    failed = sum(1 for r in ctx.results if r.status == "FAIL")
    partial = sum(1 for r in ctx.results if r.status == "PARTIAL")
    total = len(ctx.results)

    print("## Summary")
    print(f"- **Total checks**: {total}")
    print(f"- **Passed**: {passed}")
    print(f"- **Failed**: {failed}")
    print(f"- **Partial**: {partial}")
    print()

    # Bugs found
    bugs = [r for r in ctx.results if r.status == "FAIL"]
    if bugs:
        print("## Bugs Found")
        for b in bugs:
            print(f"- **Check {b.number} ({b.name})**: {b.notes}")
        print()

    # Spec ambiguities
    partials = [r for r in ctx.results if r.status == "PARTIAL"]
    if partials:
        print("## Spec Ambiguities / Partial Passes")
        for p in partials:
            print(f"- **Check {p.number} ({p.name})**: {p.notes}")
        print()

    # Ready for Prompt 3?
    print("## Prompt 3 Readiness")
    if failed == 0:
        print("✅ **System is ready for Prompt 3** - All checks passed.")
    else:
        print("❌ **Blockers for Prompt 3:**")
        for b in bugs:
            print(f"  - Check {b.number}: {b.name}")

    print()
    print(f"## Test Data Cleanup")
    print(f"- Test org_id: `{ctx.org_id}`")
    print(f"- Test user email: `{TEST_EMAIL}`")
    print("- Data left in database for manual inspection. Clean up with:")
    print(f"  DELETE FROM organizations WHERE id = '{ctx.org_id}';")


async def main() -> None:
    """Run all verification checks."""
    print("=" * 80)
    print("TOLLGATE PROMPT 2 VERIFICATION SCRIPT")
    print("=" * 80)
    print(f"API: {API_BASE_URL}")
    print(f"Test email: {TEST_EMAIL}")
    print(f"Test org: {TEST_ORG_NAME}")
    print()

    # Verify API is running
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            health = await client.get(f"{API_BASE_URL}/health")
            if health.status_code != 200:
                print("❌ API health check failed!")
                sys.exit(1)
            print("✅ API is healthy")
        except Exception as e:
            print(f"❌ Cannot connect to API: {e}")
            sys.exit(1)

    ctx = TestContext()

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Run all checks
        await check_1_signup_and_agent(client, ctx)

        if not ctx.agent_id:
            print("\n❌ Cannot continue without agent. Aborting.")
            print_results_table(ctx)
            sys.exit(1)

        await check_2_upload_policy(client, ctx)
        await check_3_get_active_policy(client, ctx)
        await check_4_allow_path(client, ctx)
        await check_5_pending_path(client, ctx)
        await check_6_poll_pending(client, ctx)
        await check_7_approve_action(client, ctx)
        await check_8_poll_after_approval(client, ctx)
        await check_9_explicit_deny(client, ctx)
        await check_10_default_deny(client, ctx)
        await check_11_threshold_deny(client, ctx)
        await check_12_auto_expiry(client, ctx)
        await check_13_policy_rollback(client, ctx)
        await check_14_cache_invalidation(client, ctx)
        await check_15_latency(client, ctx)
        await check_16_idempotency(client, ctx)

    print_results_table(ctx)


if __name__ == "__main__":
    asyncio.run(main())
