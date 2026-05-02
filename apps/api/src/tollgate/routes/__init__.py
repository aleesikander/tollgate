"""API routes."""

from fastapi import APIRouter

from tollgate.routes import agents, auth, health
from tollgate.routes.v1 import check

# Main router
router = APIRouter()

# Include sub-routers
router.include_router(health.router, tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(agents.router, prefix="/agents", tags=["agents"])
router.include_router(check.router, prefix="/v1", tags=["v1"])
