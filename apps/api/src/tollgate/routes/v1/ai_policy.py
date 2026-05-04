"""AI-powered policy generation endpoint."""

import uuid
from typing import Any

import anthropic
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from tollgate.config import get_settings
from tollgate.dependencies import AuthenticatedUser, DBSession
from tollgate.models.action import Action
from tollgate.services.agent import AgentService

router = APIRouter()

POLICY_DSL_SPEC = """
You generate Tollgate policy YAML. The schema is:

version: 1
rules:
  - action: <action_name>          # exact action name (string)
    when:                          # optional conditions on payload fields
      <field>: { eq: <value> }
      <field>: { neq: <value> }
      <field>: { gt: <number> }
      <field>: { gte: <number> }
      <field>: { lt: <number> }
      <field>: { lte: <number> }
      <field>: { in: [v1, v2] }
      <field>: { not_in: [v1, v2] }
    decide: allow | deny | require_approval
    approvers: ["#slack-channel"]  # only when decide: require_approval
    reason: "explanation"          # optional, shown on deny
default: allow | deny              # fallback for unmatched actions

Rules are evaluated top to bottom. First match wins.
Only include `when` if there are conditions. Omit it for unconditional rules.
Only include `approvers` when decide is require_approval.
Always end with a `default:` line.
""".strip()


class GeneratePolicyRequest(BaseModel):
    prompt: str
    agent_id: uuid.UUID
    current_yaml: str | None = None


class GeneratePolicyResponse(BaseModel):
    yaml: str
    observed_actions: list[str]


@router.post("/ai/policy", response_model=GeneratePolicyResponse)
async def generate_policy(
    request: GeneratePolicyRequest,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> GeneratePolicyResponse:
    """Generate a policy YAML from a plain-English prompt using Claude."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_NOT_CONFIGURED", "message": "ANTHROPIC_API_KEY is not set"}},
        )

    # Verify agent belongs to this org
    agent_service = AgentService(session)
    agent = await agent_service.get_agent(request.agent_id, current_user.org_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "AGENT_NOT_FOUND", "message": "Agent not found"}},
        )

    # Fetch last 20 audit entries to extract observed actions + payload shapes
    result = await session.execute(
        select(Action)
        .where(Action.agent_id == request.agent_id)
        .order_by(Action.created_at.desc())
        .limit(20)
    )
    recent_actions = list(result.scalars().all())

    # Build a concise context: unique action names + example payloads
    seen: dict[str, dict[str, Any]] = {}
    for action in recent_actions:
        if action.action_name not in seen:
            seen[action.action_name] = action.payload or {}

    observed_actions = list(seen.keys())

    if seen:
        context_lines = [
            "Observed actions from this agent — use these exact names and field names for any rules that match:",
        ]
        for name, payload in seen.items():
            fields = ", ".join(f"{k}: {type(v).__name__}" for k, v in payload.items()) if payload else "no fields"
            context_lines.append(f"  - {name}({fields})")
        context_lines.append(
            "For any actions mentioned in the prompt that are NOT in the list above, still generate rules using "
            "the action name exactly as the user states it."
        )
        agent_context = "\n".join(context_lines)
    else:
        agent_context = "No actions observed yet. Generate rules using the action names exactly as stated in the prompt."

    # Build the prompt
    system_prompt = f"""You are a Tollgate policy generator. Given a plain-English description of security rules, you output valid Tollgate policy YAML and nothing else — no explanation, no markdown fences, just the raw YAML.

{POLICY_DSL_SPEC}

{agent_context}"""

    user_message = request.prompt
    if request.current_yaml:
        user_message = f"Current policy:\n```yaml\n{request.current_yaml}\n```\n\nUpdate it based on this instruction: {request.prompt}"

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences if the model added them despite instructions
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return GeneratePolicyResponse(yaml=raw, observed_actions=observed_actions)
