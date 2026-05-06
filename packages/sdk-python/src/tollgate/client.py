"""Tollgate SDK client — sync and async."""

from __future__ import annotations

import inspect
import logging
import time
import uuid
from collections.abc import Callable, Generator
from contextlib import contextmanager
from functools import wraps
from typing import Any, TypeVar

import httpx

from .exceptions import (
    ActionDenied,
    ActionPending,
    TollgateAuthError,
    TollgateConnectionError,
)
from .models import Decision

logger = logging.getLogger("tollgate")

F = TypeVar("F", bound=Callable[..., Any])

_RETRY_DELAYS = (0.5, 1.0, 2.0)


def _extract_payload(func: Callable[..., Any], args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
    """Bind call args to parameter names, skipping self/cls."""
    sig = inspect.signature(func)
    try:
        bound = sig.bind(*args, **kwargs)
        bound.apply_defaults()
    except TypeError:
        return {}
    result: dict[str, Any] = {}
    params = list(sig.parameters.values())
    for param, value in bound.arguments.items():
        if params and params[0].name == param and param in ("self", "cls"):
            continue
        result[param] = value
    return result


class Tollgate:
    """Sync Tollgate client."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.usetollgate.com",
        poll_interval: float = 2.0,
        max_wait: float = 300.0,
        on_pending: Callable[[str], None] | None = None,
        fail_open: bool = False,
        timeout: float = 10.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._poll_interval = poll_interval
        self._max_wait = max_wait
        self._on_pending = on_pending
        self._fail_open = fail_open
        self._client = httpx.Client(
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}"},
        )

    def _post_check(self, action_name: str, payload: dict[str, Any], idempotency_key: str) -> Decision:
        """POST /v1/check with retry on 5xx."""
        url = f"{self._base_url}/v1/check"
        body = {"action_name": action_name, "payload": payload, "idempotency_key": idempotency_key}
        logger.debug("tollgate check action=%s idempotency_key=%s", action_name, idempotency_key)

        last_exc: Exception | None = None
        for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
            try:
                resp = self._client.post(url, json=body)
            except httpx.ConnectError as exc:
                last_exc = exc
                break
            except httpx.RequestError as exc:
                last_exc = exc
                break

            if resp.status_code in (401, 403):
                raise TollgateAuthError(resp.text)
            if resp.status_code >= 500:
                last_exc = TollgateConnectionError(f"server error {resp.status_code}")
                if delay is not None:
                    logger.debug("retrying after %ss (attempt %d)", delay, attempt)
                    time.sleep(delay)
                continue
            resp.raise_for_status()
            return Decision.model_validate(resp.json())

        if self._fail_open:
            logger.warning("tollgate unreachable, fail_open=True — allowing action=%s", action_name)
            return Decision(decision="allowed", action_id="", reason="fail_open: tollgate unreachable")
        raise TollgateConnectionError(str(last_exc)) from last_exc

    def _poll(self, action_id: str) -> Decision:
        """Poll GET /v1/check/{action_id} until resolved or timeout."""
        url = f"{self._base_url}/v1/check/{action_id}"
        deadline = time.monotonic() + self._max_wait
        while time.monotonic() < deadline:
            time.sleep(self._poll_interval)
            logger.debug("polling action_id=%s", action_id)
            try:
                resp = self._client.get(url)
                resp.raise_for_status()
            except httpx.RequestError as exc:
                if self._fail_open:
                    logger.warning("tollgate unreachable during poll, fail_open=True — allowing action_id=%s", action_id)
                    return Decision(decision="allowed", action_id=action_id, reason="fail_open: tollgate unreachable")
                raise TollgateConnectionError(str(exc)) from exc

            data: dict[str, Any] = resp.json()
            status = data.get("decision", "")
            reason: str = data.get("reason", "")
            if status in ("approved", "allowed"):
                return Decision(decision="allowed", action_id=action_id, reason=reason)
            if status in ("rejected", "denied"):
                raise ActionDenied(reason)
            # still pending — keep polling
        raise ActionPending(action_id, int(self._max_wait))

    def check_action(
        self,
        action_name: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> Decision:
        """Check whether an action is allowed by policy."""
        key = idempotency_key or str(uuid.uuid4())
        decision = self._post_check(action_name, payload, key)

        if decision.allowed:
            return decision
        if decision.denied:
            raise ActionDenied(decision.reason)
        # pending
        if self._on_pending:
            self._on_pending(decision.action_id)
        return self._poll(decision.action_id)

    @contextmanager
    def check(
        self,
        action_name: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> Generator[Decision, None, None]:
        """Context manager that checks policy before the block runs."""
        decision = self.check_action(action_name, payload, idempotency_key=idempotency_key)
        yield decision

    def guard(
        self,
        action_name: str,
        *,
        payload: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
        idempotency_key: str | None = None,
    ) -> Callable[[F], F]:
        """Decorator that checks policy before the wrapped function runs."""
        def decorator(func: F) -> F:
            @wraps(func)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                extracted = _extract_payload(func, args, kwargs)
                p = payload(extracted) if payload is not None else extracted
                self.check_action(action_name, p, idempotency_key=idempotency_key)
                return func(*args, **kwargs)
            return wrapper  # type: ignore[return-value]
        return decorator

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> "Tollgate":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


class AsyncTollgate:
    """Async Tollgate client."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.usetollgate.com",
        poll_interval: float = 2.0,
        max_wait: float = 300.0,
        on_pending: Callable[[str], None] | None = None,
        fail_open: bool = False,
        timeout: float = 10.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._poll_interval = poll_interval
        self._max_wait = max_wait
        self._on_pending = on_pending
        self._fail_open = fail_open
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}"},
        )

    async def _post_check(self, action_name: str, payload: dict[str, Any], idempotency_key: str) -> Decision:
        """POST /v1/check with retry on 5xx."""
        import asyncio

        url = f"{self._base_url}/v1/check"
        body = {"action_name": action_name, "payload": payload, "idempotency_key": idempotency_key}
        logger.debug("tollgate async check action=%s idempotency_key=%s", action_name, idempotency_key)

        last_exc: Exception | None = None
        for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
            try:
                resp = await self._client.post(url, json=body)
            except httpx.ConnectError as exc:
                last_exc = exc
                break
            except httpx.RequestError as exc:
                last_exc = exc
                break

            if resp.status_code in (401, 403):
                raise TollgateAuthError(resp.text)
            if resp.status_code >= 500:
                last_exc = TollgateConnectionError(f"server error {resp.status_code}")
                if delay is not None:
                    logger.debug("retrying after %ss (attempt %d)", delay, attempt)
                    await asyncio.sleep(delay)
                continue
            resp.raise_for_status()
            return Decision.model_validate(resp.json())

        if self._fail_open:
            logger.warning("tollgate unreachable, fail_open=True — allowing action=%s", action_name)
            return Decision(decision="allowed", action_id="", reason="fail_open: tollgate unreachable")
        raise TollgateConnectionError(str(last_exc)) from last_exc

    async def _poll(self, action_id: str) -> Decision:
        """Poll GET /v1/check/{action_id} until resolved or timeout."""
        import asyncio

        url = f"{self._base_url}/v1/check/{action_id}"
        deadline = time.monotonic() + self._max_wait
        while time.monotonic() < deadline:
            await asyncio.sleep(self._poll_interval)
            logger.debug("async polling action_id=%s", action_id)
            try:
                resp = await self._client.get(url)
                resp.raise_for_status()
            except httpx.RequestError as exc:
                if self._fail_open:
                    logger.warning("tollgate unreachable during poll, fail_open=True — allowing action_id=%s", action_id)
                    return Decision(decision="allowed", action_id=action_id, reason="fail_open: tollgate unreachable")
                raise TollgateConnectionError(str(exc)) from exc

            data: dict[str, Any] = resp.json()
            status = data.get("decision", "")
            reason: str = data.get("reason", "")
            if status in ("approved", "allowed"):
                return Decision(decision="allowed", action_id=action_id, reason=reason)
            if status in ("rejected", "denied"):
                raise ActionDenied(reason)
            # still pending — keep polling
        raise ActionPending(action_id, int(self._max_wait))

    async def check_action(
        self,
        action_name: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> Decision:
        """Check whether an action is allowed by policy."""
        key = idempotency_key or str(uuid.uuid4())
        decision = await self._post_check(action_name, payload, key)

        if decision.allowed:
            return decision
        if decision.denied:
            raise ActionDenied(decision.reason)
        if self._on_pending:
            self._on_pending(decision.action_id)
        return await self._poll(decision.action_id)

    def aguard(
        self,
        action_name: str,
        *,
        payload: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
        idempotency_key: str | None = None,
    ) -> Callable[[F], F]:
        """Async decorator that checks policy before the wrapped function runs."""
        def decorator(func: F) -> F:
            @wraps(func)
            async def wrapper(*args: Any, **kwargs: Any) -> Any:
                extracted = _extract_payload(func, args, kwargs)
                p = payload(extracted) if payload is not None else extracted
                await self.check_action(action_name, p, idempotency_key=idempotency_key)
                if inspect.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                return func(*args, **kwargs)
            return wrapper  # type: ignore[return-value]
        return decorator

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncTollgate":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()
