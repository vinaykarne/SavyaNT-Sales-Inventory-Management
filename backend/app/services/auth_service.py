"""
SavyaNT Sales Order & Inventory Management System
Authentication Service

Handles user credential verification, JWT token issuance, and user profile management.
"""

from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User
from app.utils.exceptions import AuthenticationError, ValidationError
from app.utils.validators import validate_email


class AuthService:
    """Authentication and user session management service."""

    @staticmethod
    def login(email: str, password: str) -> dict:
        """Authenticates user credentials and generates a secure JWT access token."""
        if not email or not password:
            raise ValidationError("Email and password are required.")
            
        clean_email = validate_email(email)
        user = User.query.filter_by(email=clean_email).first()
        
        # Guard against timing attacks by performing check even if user is None
        if not user or not user.check_password(password):
            raise AuthenticationError("Invalid email or password. Please verify your credentials.", status_code=401)
            
        if not user.is_active:
            raise AuthenticationError("Your user account has been deactivated. Please contact an administrator.", status_code=403)
            
        # Additional claims embedded inside JWT
        additional_claims = {
            "email": user.email,
            "role": user.role,
            "name": user.name,
        }
        
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims,
        )
        
        return {
            "token": access_token,
            "user": user.to_dict(),
        }

    @staticmethod
    def get_user_profile(user_id: int | str) -> dict:
        """Retrieves safe user profile dictionary."""
        user = User.query.get(user_id)
        if not user:
            raise AuthenticationError("User not found.", status_code=404)
        return user.to_dict()
