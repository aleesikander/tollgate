"""Authentication service."""

import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.config import get_settings
from tollgate.logging import get_logger
from tollgate.models import Organization, User, UserRole

logger = get_logger(__name__)


class AuthError(Exception):
    """Base authentication error."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class AuthService:
    """Service for authentication operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()

    def _hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode(), salt).decode()

    def _verify_password(self, password: str, hashed: str) -> bool:
        """Verify a password against a hash."""
        return bcrypt.checkpw(password.encode(), hashed.encode())

    def _generate_slug(self, name: str) -> str:
        """Generate a URL-safe slug from a name."""
        # Convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        # Add random suffix to ensure uniqueness
        suffix = uuid.uuid4().hex[:8]
        return f"{slug}-{suffix}"

    def create_jwt_token(self, user: User) -> str:
        """Create a JWT token for a user."""
        expires = datetime.now(UTC) + timedelta(days=self.settings.jwt_expiry_days)
        payload: dict[str, Any] = {
            "sub": str(user.id),
            "org_id": str(user.org_id),
            "role": user.role.value,
            "exp": expires,
        }
        return jwt.encode(payload, self.settings.jwt_secret, algorithm="HS256")

    def verify_jwt_token(self, token: str) -> dict[str, Any]:
        """Verify and decode a JWT token."""
        try:
            payload: dict[str, Any] = jwt.decode(
                token, self.settings.jwt_secret, algorithms=["HS256"]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthError("TOKEN_EXPIRED", "Token has expired")
        except jwt.InvalidTokenError:
            raise AuthError("INVALID_TOKEN", "Invalid token")

    async def create_organization_and_owner(
        self,
        email: str,
        password: str,
        org_name: str,
    ) -> tuple[Organization, User, str]:
        """Create an organization and its owner user atomically.

        Returns the organization, user, and JWT token.
        """
        # Check if email already exists
        existing = await self.session.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise AuthError("EMAIL_EXISTS", "Email already registered")

        # Create organization
        org = Organization(
            name=org_name,
            slug=self._generate_slug(org_name),
        )
        self.session.add(org)
        await self.session.flush()

        # Create owner user
        user = User(
            org_id=org.id,
            email=email,
            hashed_password=self._hash_password(password),
            role=UserRole.OWNER,
        )
        self.session.add(user)
        await self.session.flush()

        logger.info("created_organization_and_owner", org_id=str(org.id), user_id=str(user.id))

        # Generate token
        token = self.create_jwt_token(user)

        return org, user, token

    async def authenticate_user(self, email: str, password: str) -> tuple[User, str]:
        """Authenticate a user and return user and JWT token."""
        result = await self.session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user or not self._verify_password(password, user.hashed_password):
            raise AuthError("INVALID_CREDENTIALS", "Invalid email or password")

        logger.info("user_authenticated", user_id=str(user.id))
        token = self.create_jwt_token(user)

        return user, token

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        """Get a user by ID."""
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
