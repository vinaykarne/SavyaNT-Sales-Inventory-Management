"""
SavyaNT Sales Order & Inventory Management System
Authentication & Authorization Decorators

Enforces JWT verification, user activity status checks, and role-based access control (ADMIN vs SALES).
"""

from functools import wraps
from flask import g, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.user import User
from app.utils.exceptions import AuthenticationError, PermissionDeniedError


def jwt_required_custom(fn):
    """Decorator ensuring request carries a valid JWT and resolves active user into flask.g.current_user."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_identity = get_jwt_identity()
        
        # User identity in JWT can be user ID (int or str)
        user = None
        if user_identity is not None:
            user = User.query.get(user_identity)
            
        if not user:
            raise AuthenticationError("Authenticated user account was not found in the database.", status_code=401)
            
        if not user.is_active:
            raise PermissionDeniedError("Your user account has been deactivated. Please contact an administrator.", status_code=403)
            
        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Decorator requiring the authenticated user to hold the ADMIN role."""
    @wraps(fn)
    @jwt_required_custom
    def wrapper(*args, **kwargs):
        current_user: User = g.current_user
        if not current_user.is_admin:
            raise PermissionDeniedError(
                "Access denied: Administrator privileges (role 'ADMIN') are required for this action.",
                status_code=403
            )
        return fn(*args, **kwargs)
    return wrapper


def sales_or_admin_required(fn):
    """Decorator permitting both SALES and ADMIN roles."""
    @wraps(fn)
    @jwt_required_custom
    def wrapper(*args, **kwargs):
        current_user: User = g.current_user
        if not (current_user.is_admin or current_user.is_sales):
            raise PermissionDeniedError("Access denied: Invalid user role.", status_code=403)
        return fn(*args, **kwargs)
    return wrapper


def get_current_user() -> User:
    """Returns the authenticated user from Flask's g context."""
    return getattr(g, "current_user", None)
