"""Agent service."""

import hashlib
import hmac
import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.config import get_settings
from tollgate.logging import get_logger
from tollgate.models import Agent, AgentStatus

logger = get_logger(__name__)

# API key format: tg_live_<32 hex chars>
API_KEY_PREFIX = "tg_live_"
API_KEY_HEX_LENGTH = 32


class AgentError(Exception):
    """Base agent error."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class AgentService:
    """Service for agent operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._hmac_secret = get_settings().api_key_hmac_secret.encode()

    def _generate_api_key(self) -> str:
        """Generate a new API key."""
        random_hex = secrets.token_hex(API_KEY_HEX_LENGTH // 2)
        return f"{API_KEY_PREFIX}{random_hex}"

    def _hash_api_key(self, api_key: str) -> str:
        """Hash an API key using HMAC-SHA256.

        HMAC is used instead of bcrypt for API keys because:
        - API keys are high-entropy random strings (not user passwords)
        - HMAC verification is ~1000x faster than bcrypt
        - This enables <50ms latency for /v1/check endpoint
        """
        return hmac.new(
            self._hmac_secret,
            api_key.encode(),
            hashlib.sha256,
        ).hexdigest()

    def _verify_api_key(self, api_key: str, stored_hash: str) -> bool:
        """Verify an API key against a stored hash.

        Uses secrets.compare_digest for constant-time comparison
        to prevent timing attacks.
        """
        computed_hash = self._hash_api_key(api_key)
        return secrets.compare_digest(computed_hash, stored_hash)

    def _get_key_prefix(self, api_key: str) -> str:
        """Get the first 11 characters of an API key for display."""
        return api_key[:11]  # "tg_live_xxx"

    async def create_agent(self, org_id: uuid.UUID, name: str) -> tuple[Agent, str]:
        """Create a new agent and return the agent and API key.

        The API key is only returned once and cannot be retrieved later.
        """
        api_key = self._generate_api_key()
        api_key_hash = self._hash_api_key(api_key)
        api_key_prefix = self._get_key_prefix(api_key)

        agent = Agent(
            org_id=org_id,
            name=name,
            api_key_hash=api_key_hash,
            api_key_prefix=api_key_prefix,
            status=AgentStatus.ACTIVE,
        )
        self.session.add(agent)
        await self.session.flush()

        logger.info("agent_created", agent_id=str(agent.id), org_id=str(org_id))

        return agent, api_key

    async def list_agents(self, org_id: uuid.UUID) -> list[Agent]:
        """List all agents for an organization."""
        result = await self.session.execute(
            select(Agent).where(Agent.org_id == org_id).order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_agent(self, agent_id: uuid.UUID, org_id: uuid.UUID) -> Agent | None:
        """Get an agent by ID, ensuring it belongs to the organization."""
        result = await self.session.execute(
            select(Agent).where(Agent.id == agent_id, Agent.org_id == org_id)
        )
        return result.scalar_one_or_none()

    async def disable_agent(self, agent_id: uuid.UUID, org_id: uuid.UUID) -> Agent | None:
        """Disable an agent."""
        agent = await self.get_agent(agent_id, org_id)
        if not agent:
            return None

        agent.status = AgentStatus.DISABLED
        await self.session.flush()

        logger.info("agent_disabled", agent_id=str(agent.id))

        return agent

    async def authenticate_by_api_key(self, api_key: str) -> Agent | None:
        """Authenticate an agent by API key.

        Returns the agent if authentication succeeds, None otherwise.

        Lookup strategy:
        1. Extract prefix from key (first 11 chars)
        2. Query agent by prefix (indexed, fast)
        3. HMAC the full key and compare with stored hash
        """
        if not api_key.startswith(API_KEY_PREFIX):
            return None

        # Get the prefix to narrow down candidates
        key_prefix = self._get_key_prefix(api_key)

        # Find agents with matching prefix
        result = await self.session.execute(
            select(Agent).where(Agent.api_key_prefix == key_prefix)
        )
        agents = result.scalars().all()

        # Verify the full key against each candidate
        for agent in agents:
            if self._verify_api_key(api_key, agent.api_key_hash):
                if agent.status == AgentStatus.DISABLED:
                    logger.warning("disabled_agent_auth_attempt", agent_id=str(agent.id))
                    return None
                return agent

        return None
