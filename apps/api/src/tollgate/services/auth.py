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

    def create_reset_token(self, user: User) -> str:
        """Create a short-lived password reset token.

        Uses the user's hashed_password as part of the signing secret so the
        token is automatically invalidated once the password changes.
        """
        secret = self.settings.jwt_secret + user.hashed_password
        expires = datetime.now(UTC) + timedelta(minutes=15)
        payload: dict[str, Any] = {
            "sub": str(user.id),
            "type": "reset",
            "exp": expires,
        }
        return jwt.encode(payload, secret, algorithm="HS256")

    def verify_reset_token(self, token: str, user: User) -> bool:
        """Verify a password reset token against a user."""
        secret = self.settings.jwt_secret + user.hashed_password
        try:
            payload: dict[str, Any] = jwt.decode(token, secret, algorithms=["HS256"])
            return payload.get("type") == "reset" and payload.get("sub") == str(user.id)
        except jwt.InvalidTokenError:
            return False

    async def google_oauth_login(self, id_token: str) -> tuple[User, str]:
        """Verify a Google ID token and return (user, jwt).

        Creates the user and a personal org on first sign-in.
        Links the google_sub to an existing email/password account if the
        email already exists.
        """
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        settings = get_settings()
        if not settings.google_client_id:
            raise AuthError("GOOGLE_NOT_CONFIGURED", "Google login is not configured")

        try:
            idinfo = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                settings.google_client_id,
            )
        except Exception:
            raise AuthError("INVALID_GOOGLE_TOKEN", "Invalid Google token")

        google_sub: str = idinfo["sub"]
        email: str = idinfo["email"]
        name: str = idinfo.get("name") or email.split("@")[0]

        # Try by google_sub first (returning Google user)
        result = await self.session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalar_one_or_none()
        if user:
            token = self.create_jwt_token(user)
            return user, token

        # Try by email (existing password account — link Google sub)
        result = await self.session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_sub = google_sub
            await self.session.flush()
            token = self.create_jwt_token(user)
            logger.info("google_linked_existing_user", user_id=str(user.id))
            return user, token

        # New user — create org and owner
        org = Organization(
            name=f"{name}'s workspace",
            slug=self._generate_slug(name),
        )
        self.session.add(org)
        await self.session.flush()

        user = User(
            org_id=org.id,
            email=email,
            hashed_password=None,
            google_sub=google_sub,
            role=UserRole.OWNER,
        )
        self.session.add(user)
        await self.session.flush()

        logger.info("google_created_user", user_id=str(user.id), org_id=str(org.id))
        token = self.create_jwt_token(user)
        return user, token

    async def reset_password(self, token: str, new_password: str) -> None:
        """Reset a user's password using a valid reset token."""
        # Decode without verification to extract sub (user_id)
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            user_id = uuid.UUID(unverified["sub"])
        except Exception:
            raise AuthError("INVALID_TOKEN", "Invalid reset token")

        user = await self.get_user_by_id(user_id)
        if not user:
            raise AuthError("INVALID_TOKEN", "Invalid reset token")

        if not self.verify_reset_token(token, user):
            raise AuthError("INVALID_TOKEN", "Reset token is invalid or has expired")

        user.hashed_password = self._hash_password(new_password)
        await self.session.flush()
        logger.info("password_reset", user_id=str(user.id))
