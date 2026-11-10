"""
SavyaNT Sales Order & Inventory Management System
Authentication & Authorization Automated Tests

Tests:
- Valid login
- Invalid password
- Missing credentials
- Disabled account
- Token expiration / format
- Role-based route protection
"""

import pytest
from app.models.user import User


class TestAuthPureUnit:
    """Pure unit tests for User authentication methods."""

    def test_user_password_verification(self):
        user = User(name="Test User", email="test@savya.com", role="SALES")
        user.set_password("CorrectPass123!")
        assert user.check_password("CorrectPass123!") is True
        assert user.check_password("WrongPass") is False

    def test_user_deactivation_flag(self):
        user = User(name="Disabled User", email="disabled@savya.com", role="SALES", is_active=False)
        assert user.is_active is False


@pytest.mark.usefixtures("db_session")
class TestAuthIntegration:
    """Database-backed integration tests for auth endpoints."""

    def test_login_successful_and_token_issued(self, client, db_session):
        user = User(name="Admin User", email="admin.test@savya.com", role="ADMIN", is_active=True)
        user.set_password("AdminPass123!")
        db_session.add(user)
        db_session.flush()

        res = client.post(
            "/api/auth/login",
            json={"email": "admin.test@savya.com", "password": "AdminPass123!"},
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert "token" in data["data"]
        assert data["data"]["user"]["email"] == "admin.test@savya.com"
        assert data["data"]["user"]["role"] == "ADMIN"

    def test_login_invalid_password_returns_401(self, client, db_session):
        user = User(name="Sales User", email="sales.test@savya.com", role="SALES", is_active=True)
        user.set_password("CorrectPass123!")
        db_session.add(user)
        db_session.flush()

        res = client.post(
            "/api/auth/login",
            json={"email": "sales.test@savya.com", "password": "WrongPassword!"},
        )
        assert res.status_code == 401
        data = res.get_json()
        assert data["success"] is False
        assert "Invalid email or password" in data["error"]

    def test_login_disabled_account_returns_403(self, client, db_session):
        user = User(name="Inactive User", email="inactive@savya.com", role="SALES", is_active=False)
        user.set_password("Password123!")
        db_session.add(user)
        db_session.flush()

        res = client.post(
            "/api/auth/login",
            json={"email": "inactive@savya.com", "password": "Password123!"},
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert "deactivated" in data["error"]

    def test_login_missing_credentials_returns_400(self, client):
        res = client.post("/api/auth/login", json={})
        assert res.status_code == 400
        data = res.get_json()
        assert data["success"] is False

    def test_protected_route_without_token_returns_401(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401
        data = res.get_json()
        assert data["success"] is False
