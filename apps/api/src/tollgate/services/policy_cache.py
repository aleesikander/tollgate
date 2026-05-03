"""In-memory policy cache with TTL."""

import time
import uuid
from dataclasses import dataclass
from typing import Any


@dataclass
class CachedPolicy:
    """Cached policy entry."""

    policy_id: uuid.UUID
    version: int
    parsed_json: dict[str, Any]
    cached_at: float


class PolicyCache:
    """Thread-safe in-memory cache for policies with TTL."""

    def __init__(self, ttl_seconds: float = 30.0) -> None:
        """Initialize cache with TTL.

        Args:
            ttl_seconds: Time-to-live for cache entries in seconds
        """
        self._cache: dict[uuid.UUID, CachedPolicy] = {}
        self._ttl = ttl_seconds

    def get(self, agent_id: uuid.UUID) -> CachedPolicy | None:
        """Get cached policy for an agent.

        Args:
            agent_id: Agent ID to look up

        Returns:
            CachedPolicy if found and not expired, None otherwise
        """
        entry = self._cache.get(agent_id)
        if entry is None:
            return None

        # Check if expired
        if time.time() - entry.cached_at > self._ttl:
            del self._cache[agent_id]
            return None

        return entry

    def set(
        self,
        agent_id: uuid.UUID,
        policy_id: uuid.UUID,
        version: int,
        parsed_json: dict[str, Any],
    ) -> None:
        """Cache a policy for an agent.

        Args:
            agent_id: Agent ID
            policy_id: Policy ID
            version: Policy version
            parsed_json: Parsed policy JSON
        """
        self._cache[agent_id] = CachedPolicy(
            policy_id=policy_id,
            version=version,
            parsed_json=parsed_json,
            cached_at=time.time(),
        )

    def invalidate(self, agent_id: uuid.UUID) -> None:
        """Invalidate cache for an agent.

        Args:
            agent_id: Agent ID to invalidate
        """
        self._cache.pop(agent_id, None)

    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()


# Global cache instance
_policy_cache = PolicyCache()


def get_policy_cache() -> PolicyCache:
    """Get the global policy cache instance."""
    return _policy_cache
