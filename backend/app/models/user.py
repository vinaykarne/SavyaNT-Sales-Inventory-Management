"""
SavyaNT Sales Order & Inventory Management System
User Model

Represents system users (Admin and Sales User) with secure Werkzeug password
hashing, role-based authorization markers, and relationship definitions.
"""

from datetime import datetime, timezone
from typing import Any
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class User(db.Model):
    """User entity supporting ADMIN and SALES roles."""
    
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(191), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="SALES", server_default="SALES")
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.text("1"))
    
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    
    # Relationships
    sales_orders = db.relationship(
        "SalesOrder",
        back_populates="creator",
        lazy="select",
        passive_deletes=False,
    )
    stock_movements = db.relationship(
        "StockMovement",
        back_populates="creator",
        lazy="select",
        passive_deletes=False,
    )
    
    __table_args__ = (
        db.CheckConstraint("role IN ('ADMIN', 'SALES')", name="chk_user_role"),
    )
    
    def set_password(self, password: str) -> None:
        """Hashes plaintext password securely using Werkzeug."""
        if not password or len(password) < 6:
            raise ValueError("Password must be at least 6 characters long.")
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password: str) -> bool:
        """Verifies password against stored hash."""
        if not self.password_hash or not password:
            return False
        return check_password_hash(self.password_hash, password)
    
    @property
    def is_admin(self) -> bool:
        """Returns True if user has the ADMIN role."""
        return self.role.upper() == "ADMIN"
    
    @property
    def is_sales(self) -> bool:
        """Returns True if user has the SALES role."""
        return self.role.upper() == "SALES"
    
    def to_dict(self, include_sensitive: bool = False) -> dict[str, Any]:
        """Serializes user record into frontend-compatible format."""
        data = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "isActive": self.is_active,
            "is_active": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sensitive:
            data["passwordHash"] = self.password_hash
        return data

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
