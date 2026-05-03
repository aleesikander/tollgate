#!/usr/bin/env python3
"""Quick latency test for /v1/check endpoint."""

import asyncio
import statistics
import time
import uuid

import httpx

API_BASE_URL = "http://localhost:8000"


async def main() -> None:
    print("Latency Test: 100 sequential /v1/check calls (allow path)")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create fresh user and agent
        email = f"latency_{int(time.time())}@test.com"
        signup_resp = await client.post(
            f"{API_BASE_URL}/auth/signup",
            json={
                "email": email,
                "password": "testpassword123",
                "org_name": f"Latency Test {int(time.time())}",
            },
        )
        token = signup_resp.json()["access_token"]

        agent_resp = await client.post(
            f"{API_BASE_URL}/agents",
            json={"name": "Latency Test Agent"},
            headers={"Authorization": f"Bearer {token}"},
        )
        api_key = agent_resp.json()["api_key"]

        # Create policy (allow small refunds)
        policy_yaml = """version: 1
rules:
  - action: issue_refund
    when: { amount: { lte: 50 } }
    decide: allow
default: deny
"""
        await client.post(
            f"{API_BASE_URL}/agents/{agent_resp.json()['id']}/policies",
            json={"source_yaml": policy_yaml},
            headers={"Authorization": f"Bearer {token}"},
        )

        print(f"Created agent with API key: {api_key[:15]}...")
        print("Running 100 /v1/check calls...")

        latencies = []
        for i in range(100):
            start = time.perf_counter()
            resp = await client.post(
                f"{API_BASE_URL}/v1/check",
                json={
                    "action_name": "issue_refund",
                    "payload": {"amount": 30, "customer_id": f"c_{i}"},
                    "idempotency_key": f"latency-{uuid.uuid4()}",
                },
                headers={"Authorization": f"Bearer {api_key}"},
            )
            end = time.perf_counter()

            if resp.status_code == 200:
                latencies.append((end - start) * 1000)

            if (i + 1) % 20 == 0:
                print(f"  Completed {i + 1}/100...")

        latencies.sort()
        p50 = latencies[49]
        p95 = latencies[94]
        p99 = latencies[98]
        avg = statistics.mean(latencies)
        min_lat = min(latencies)
        max_lat = max(latencies)

        print()
        print("Results:")
        print(f"  Min:  {min_lat:.1f}ms")
        print(f"  Avg:  {avg:.1f}ms")
        print(f"  p50:  {p50:.1f}ms")
        print(f"  p95:  {p95:.1f}ms")
        print(f"  p99:  {p99:.1f}ms")
        print(f"  Max:  {max_lat:.1f}ms")
        print()

        if p50 < 50:
            print("✅ PASS: p50 < 50ms target")
        else:
            print("❌ FAIL: p50 >= 50ms target")


if __name__ == "__main__":
    asyncio.run(main())
