"""Authentication routes."""

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from tollgate.dependencies import AuthenticatedUser, DBSession
from tollgate.models.organization import Organization
from tollgate.models.user import User
from tollgate.schemas import AuthResponse, LoginRequest, SignupRequest
from tollgate.services.auth import AuthError, AuthService

router = APIRouter()


class MeResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    org_id: uuid.UUID
    org_name: str


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: AuthenticatedUser, session: DBSession) -> MeResponse:
    """Return the current user's profile and org info."""
    user_result = await session.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one_or_none()
    org_result = await session.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_result.scalar_one_or_none()

    if not user or not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": "NOT_FOUND", "message": "User not found"}})

    return MeResponse(user_id=user.id, email=user.email, org_id=org.id, org_name=org.name)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, session: DBSession) -> AuthResponse:
    """Create a new organization and owner user."""
    auth_service = AuthService(session)
    try:
        org, user, token = await auth_service.create_organization_and_owner(
            email=request.email,
            password=request.password,
            org_name=request.org_name,
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    return AuthResponse(
        access_token=token,
        user_id=user.id,
        org_id=org.id,
    )


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(request: ForgotPasswordRequest, session: DBSession) -> ForgotPasswordResponse:
    """Generate a password reset token. In production, email the reset link."""
    from sqlalchemy import select as sa_select
    from tollgate.logging import get_logger
    _logger = get_logger(__name__)

    user_result = await session.execute(sa_select(User).where(User.email == request.email))
    user = user_result.scalar_one_or_none()

    if user:
        auth_service = AuthService(session)
        token = auth_service.create_reset_token(user)
        # In production: send email with reset link
        # For now: log so it's accessible in dev
        _logger.info("password_reset_requested", user_id=str(user.id), reset_token=token)

    # Always return the same message to prevent email enumeration
    return ForgotPasswordResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=ForgotPasswordResponse)
async def reset_password(request: ResetPasswordRequest, session: DBSession) -> ForgotPasswordResponse:
    """Reset a user's password using a valid reset token."""
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "VALIDATION_ERROR", "message": "Password must be at least 8 characters"}},
        )
    auth_service = AuthService(session)
    try:
        await auth_service.reset_password(request.token, request.new_password)
        await session.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_TOKEN", "message": "Reset link is invalid or has expired"}},
        )
    return ForgotPasswordResponse(message="Password updated successfully.")


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, session: DBSession) -> AuthResponse:
    """Authenticate a user and return a JWT token."""
    auth_service = AuthService(session)
    try:
        user, token = await auth_service.authenticate_user(
            email=request.email,
            password=request.password,
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    return AuthResponse(
        access_token=token,
        user_id=user.id,
        org_id=user.org_id,
    )
