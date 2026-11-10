"""
SavyaNT Sales Order & Inventory Management System
Authentication API Routes

Exposes:
- POST /api/auth/login
- GET  /api/auth/me
- POST /api/auth/logout
"""

from flask import Blueprint, g, request
from app.services.auth_service import AuthService
from app.utils.auth_decorators import jwt_required_custom
from app.utils.responses import error_response, success_response

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticates user credentials and returns JWT token and profile."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")
    
    result = AuthService.login(email=email, password=password)
    return success_response(
        data=result,
        message="Authentication successful.",
        status_code=200,
    )


@auth_bp.route("/me", methods=["GET"])
@jwt_required_custom
def get_me():
    """Returns the currently authenticated user's profile."""
    current_user = g.current_user
    return success_response(
        data={"user": current_user.to_dict()},
        message="User profile retrieved.",
        status_code=200,
    )


@auth_bp.route("/logout", methods=["POST"])
@jwt_required_custom
def logout():
    """Logs out user and invalidates current client session."""
    return success_response(
        data=None,
        message="Logged out successfully.",
        status_code=200,
    )
