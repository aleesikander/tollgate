"""Background tasks for Tollgate."""

import asyncio

from tollgate.database import get_session_context
from tollgate.logging import get_logger
from tollgate.services.approval import ApprovalService

logger = get_logger(__name__)

# Task reference for cleanup
_expiry_task: asyncio.Task[None] | None = None


async def expire_approvals_loop(interval_seconds: float = 30.0) -> None:
    """Background loop that expires pending approvals.

    Runs every interval_seconds and marks expired pending approvals as rejected.

    Args:
        interval_seconds: How often to check for expired approvals
    """
    logger.info("expiry_task_started", interval=interval_seconds)

    while True:
        try:
            await asyncio.sleep(interval_seconds)

            async with get_session_context() as session:
                approval_service = ApprovalService(session)
                expired_count = await approval_service.expire_pending_approvals()

                if expired_count > 0:
                    logger.info("expired_pending_approvals", count=expired_count)

        except asyncio.CancelledError:
            logger.info("expiry_task_cancelled")
            raise
        except Exception as e:
            logger.error("expiry_task_error", error=str(e))
            # Continue running despite errors
            await asyncio.sleep(interval_seconds)


def start_background_tasks() -> None:
    """Start all background tasks."""
    global _expiry_task
    _expiry_task = asyncio.create_task(expire_approvals_loop())
    logger.info("background_tasks_started")


async def stop_background_tasks() -> None:
    """Stop all background tasks."""
    global _expiry_task
    if _expiry_task:
        _expiry_task.cancel()
        try:
            await _expiry_task
        except asyncio.CancelledError:
            pass
        _expiry_task = None
    logger.info("background_tasks_stopped")
