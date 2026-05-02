"""Tests for authentication endpoints."""

import jwt
import pytest
from httpx import AsyncClient

from tollgate.config import get_settings


@pytest.mark.asyncio
async def test_signup_success(client: AsyncClient) -> None:
    """Test successful signup creates org and user."""
    response = await client.post(
        "/auth/signup",
        json={
            "email": "newuser@example.com",
            "password": "securepassword123",
            "org_name": "New Organization",
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user_id" in data
    assert "org_id" in data

    # Verify JWT decodes correctly
    settings = get_settings()
    payload = jwt.decode(data["access_token"], settings.jwt_secret, algorithms=["HS256"])
    assert payload["sub"] == data["user_id"]
    assert payload["org_id"] == data["org_id"]
    assert payload["role"] == "owner"


@pytest.mark.asyncio
async def test_signup_duplicate_email_rejected(client: AsyncClient) -> None:
    """Test that duplicate email is rejected."""
    # First signup
    response1 = await client.post(
        "/auth/signup",
        json={
            "email": "duplicate@example.com",
            "password": "password123",
            "org_name": "Org 1",
        },
    )
    assert response1.status_code == 201

    # Second signup with same email
    response2 = await client.post(
        "/auth/signup",
        json={
            "email": "duplicate@example.com",
            "password": "password456",
            "org_name": "Org 2",
        },
    )
    assert response2.status_code == 409
    data = response2.json()
    assert data["error"]["code"] == "EMAIL_EXISTS"


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    """Test successful login."""
    # Create user first
    await client.post(
        "/auth/signup",
        json={
            "email": "login@example.com",
            "password": "password123",
            "org_name": "Test Org",
        },
    )

    # Login
    response = await client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient) -> None:
    """Test login with invalid credentials."""
    response = await client.post(
        "/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_signup_short_password_rejected(client: AsyncClient) -> None:
    """Test that short password is rejected."""
    response = await client.post(
        "/auth/signup",
        json={
            "email": "short@example.com",
            "password": "short",
            "org_name": "Test Org",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"
