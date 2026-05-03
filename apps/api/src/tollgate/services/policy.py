"""Policy service for managing agent policies."""

import uuid
from typing import Any

import yaml  # type: ignore[import-untyped]
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.logging import get_logger
from tollgate.models import Policy

logger = get_logger(__name__)


class PolicyError(Exception):
    """Base policy error."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class PolicyService:
    """Service for policy operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _validate_policy_yaml(self, source_yaml: str) -> dict[str, Any]:
        """Validate and parse policy YAML.

        Args:
            source_yaml: Raw YAML string

        Returns:
            Parsed policy dictionary

        Raises:
            PolicyError: If YAML is invalid or doesn't match schema
        """
        try:
            parsed = yaml.safe_load(source_yaml)
        except yaml.YAMLError as e:
            raise PolicyError("INVALID_YAML", f"Failed to parse YAML: {e}")

        if not isinstance(parsed, dict):
            raise PolicyError("INVALID_SCHEMA", "Policy must be a YAML object")

        # Validate version
        version = parsed.get("version")
        if version != 1:
            raise PolicyError("INVALID_VERSION", "Policy version must be 1")

        # Validate rules
        rules = parsed.get("rules", [])
        if not isinstance(rules, list):
            raise PolicyError("INVALID_SCHEMA", "Rules must be a list")

        for i, rule in enumerate(rules):
            self._validate_rule(rule, i)

        # Validate default
        default = parsed.get("default", "deny")
        if default not in ("allow", "deny"):
            raise PolicyError("INVALID_DEFAULT", "Default must be 'allow' or 'deny'")

        return parsed

    def _validate_rule(self, rule: Any, index: int) -> None:
        """Validate a single rule.

        Args:
            rule: Rule dictionary
            index: Rule index for error messages

        Raises:
            PolicyError: If rule is invalid
        """
        if not isinstance(rule, dict):
            raise PolicyError("INVALID_RULE", f"Rule {index} must be an object")

        # Action is required
        if "action" not in rule:
            raise PolicyError("MISSING_ACTION", f"Rule {index} is missing 'action' field")

        # Decide is required
        decide = rule.get("decide")
        if decide not in ("allow", "deny", "require_approval"):
            raise PolicyError(
                "INVALID_DECIDE",
                f"Rule {index} 'decide' must be 'allow', 'deny', or 'require_approval'",
            )

        # Validate when clause if present
        when = rule.get("when", {})
        if not isinstance(when, dict):
            raise PolicyError("INVALID_WHEN", f"Rule {index} 'when' must be an object")

        for field, condition in when.items():
            if isinstance(condition, dict):
                self._validate_condition(condition, index, field)

        # Validate approvers if require_approval
        if decide == "require_approval":
            approvers = rule.get("approvers", [])
            if not isinstance(approvers, list) or len(approvers) == 0:
                raise PolicyError(
                    "MISSING_APPROVERS",
                    f"Rule {index} with 'require_approval' must have non-empty 'approvers' list",
                )

    def _validate_condition(self, condition: dict[str, Any], rule_index: int, field: str) -> None:
        """Validate a condition dictionary.

        Args:
            condition: Condition with operators
            rule_index: Rule index for error messages
            field: Field name for error messages

        Raises:
            PolicyError: If condition has invalid operators
        """
        valid_operators = {"eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "matches"}

        for operator in condition.keys():
            if operator not in valid_operators:
                raise PolicyError(
                    "INVALID_OPERATOR",
                    f"Rule {rule_index} field '{field}' has invalid operator '{operator}'",
                )

    async def create_policy(
        self,
        agent_id: uuid.UUID,
        source_yaml: str,
        created_by_user_id: uuid.UUID,
    ) -> Policy:
        """Create a new policy for an agent.

        Validates the YAML, deactivates current active policy, and creates a new active version.

        Args:
            agent_id: Agent ID
            source_yaml: Policy YAML source
            created_by_user_id: User creating the policy

        Returns:
            The created Policy
        """
        # Validate and parse YAML
        parsed_json = self._validate_policy_yaml(source_yaml)

        # Get next version number
        result = await self.session.execute(
            select(func.coalesce(func.max(Policy.version), 0)).where(Policy.agent_id == agent_id)
        )
        max_version = result.scalar() or 0
        new_version = max_version + 1

        # Deactivate current active policy
        await self.session.execute(
            update(Policy)
            .where(Policy.agent_id == agent_id, Policy.is_active == True)  # noqa: E712
            .values(is_active=False)
        )

        # Create new policy
        policy = Policy(
            agent_id=agent_id,
            version=new_version,
            source_yaml=source_yaml,
            parsed_json=parsed_json,
            is_active=True,
            created_by_user_id=created_by_user_id,
        )
        self.session.add(policy)
        await self.session.flush()

        logger.info(
            "policy_created",
            agent_id=str(agent_id),
            version=new_version,
        )

        return policy

    async def list_policies(self, agent_id: uuid.UUID) -> list[Policy]:
        """List all policies for an agent, newest first."""
        result = await self.session.execute(
            select(Policy)
            .where(Policy.agent_id == agent_id)
            .order_by(Policy.version.desc())
        )
        return list(result.scalars().all())

    async def get_active_policy(self, agent_id: uuid.UUID) -> Policy | None:
        """Get the active policy for an agent."""
        result = await self.session.execute(
            select(Policy).where(
                Policy.agent_id == agent_id,
                Policy.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def get_policy_by_version(self, agent_id: uuid.UUID, version: int) -> Policy | None:
        """Get a specific policy version."""
        result = await self.session.execute(
            select(Policy).where(
                Policy.agent_id == agent_id,
                Policy.version == version,
            )
        )
        return result.scalar_one_or_none()

    async def activate_policy_version(self, agent_id: uuid.UUID, version: int) -> Policy | None:
        """Activate a specific policy version (rollback).

        Args:
            agent_id: Agent ID
            version: Version number to activate

        Returns:
            The activated policy, or None if not found
        """
        # Get the policy to activate
        policy = await self.get_policy_by_version(agent_id, version)
        if not policy:
            return None

        # Deactivate all policies for this agent
        await self.session.execute(
            update(Policy)
            .where(Policy.agent_id == agent_id)
            .values(is_active=False)
        )

        # Activate the requested version
        policy.is_active = True
        await self.session.flush()

        logger.info(
            "policy_activated",
            agent_id=str(agent_id),
            version=version,
        )

        return policy
