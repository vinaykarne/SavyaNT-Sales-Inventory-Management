"""
SavyaNT Sales Order & Inventory Management System
Customer Model

Represents customer master data with validation constraints, status tracking,
and protection against deletion if referenced by sales orders.
"""

from datetime import datetime, timezone
from typing import Any
from app.extensions import db


class Customer(db.Model):
    """Customer entity with contact details and status."""
    
    __tablename__ = "customers"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    email = db.Column(db.String(191), unique=True, nullable=False, index=True)
    mobile = db.Column(db.String(20), nullable=False, index=True)
    city = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Active", server_default="Active")
    
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
    
    # Relationships: Deletion prohibited if referenced in sales orders
    sales_orders = db.relationship(
        "SalesOrder",
        back_populates="customer",
        lazy="select",
        passive_deletes=False,
    )
    
    __table_args__ = (
        db.CheckConstraint("status IN ('Active', 'Inactive')", name="chk_customer_status"),
    )
    
    @property
    def is_active(self) -> bool:
        return self.status == "Active"
    
    def to_dict(self) -> dict[str, Any]:
        """Serializes customer record matching frontend Customer interface."""
        return {
            "id": self.customer_code or str(self.id),
            "dbId": self.id,
            "customerCode": self.customer_code,
            "customer_code": self.customer_code,
            "name": self.name,
            "email": self.email,
            "mobile": self.mobile,
            "city": self.city,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Customer id={self.id} code='{self.customer_code}' name='{self.name}'>"
