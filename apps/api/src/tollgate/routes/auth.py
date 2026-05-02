"""Authentication routes."""

from fastapi import APIRouter, HTTPException, status

from tollgate.dependencies import DBSession
from tollgate.schemas import AuthResponse, LoginRequest, SignupRequest
from tollgate.services.auth import AuthError, AuthService

router = APIRouter()


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
