"""
SavyaNT Sales Order & Inventory Management System
Sales Order Model

Represents sales orders with decimal financial tracking, 0-20% discount bounds,
Draft/Confirmed/Cancelled lifecycle state machine, and relationship integrity.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from app.extensions import db


class SalesOrder(db.Model):
    """Sales order header entity with status lifecycle and locked totals."""
    
    __tablename__ = "sales_orders"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    customer_id = db.Column(
        db.Integer,
        db.ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_date = db.Column(db.Date, nullable=False, index=True)
    
    # Financial fields: DECIMAL(12, 2) and percentage (0 to 20%)
    subtotal = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    discount_percentage = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    discount_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    grand_total = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    
    # Order Status Lifecycle: Draft -> Confirmed / Cancelled
    status = db.Column(db.String(20), nullable=False, default="Draft", server_default="Draft", index=True)
    notes = db.Column(db.Text, nullable=True)
    
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
    confirmed_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    customer = db.relationship("Customer", back_populates="sales_orders")
    creator = db.relationship("User", back_populates="sales_orders")
    items = db.relationship(
        "SalesOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    stock_movements = db.relationship(
        "StockMovement",
        back_populates="related_order",
        lazy="select",
    )
    
    __table_args__ = (
        db.CheckConstraint("status IN ('Draft', 'Confirmed', 'Cancelled')", name="chk_order_status"),
        db.CheckConstraint("discount_percentage >= 0 AND discount_percentage <= 20", name="chk_order_discount_range"),
        db.CheckConstraint("subtotal >= 0", name="chk_order_subtotal_nonnegative"),
        db.CheckConstraint("discount_amount >= 0", name="chk_order_discount_amount_nonnegative"),
        db.CheckConstraint("grand_total >= 0", name="chk_order_grand_total_nonnegative"),
    )
    
    def to_dict(self, include_items: bool = True) -> dict[str, Any]:
        """Serializes sales order matching frontend SalesOrder interface."""
        data = {
            "id": self.order_number or str(self.id),
            "dbId": self.id,
            "orderNumber": self.order_number,
            "order_number": self.order_number,
            "customerId": self.customer.customer_code if self.customer else str(self.customer_id),
            "customer_id": self.customer_id,
            "customerName": self.customer.name if self.customer else "",
            "orderDate": self.order_date.isoformat() if self.order_date else None,
            "order_date": self.order_date.isoformat() if self.order_date else None,
            "subtotal": float(self.subtotal) if self.subtotal is not None else 0.0,
            "discountPercentage": float(self.discount_percentage) if self.discount_percentage is not None else 0.0,
            "discount_percentage": float(self.discount_percentage) if self.discount_percentage is not None else 0.0,
            "discountAmount": float(self.discount_amount) if self.discount_amount is not None else 0.0,
            "discount_amount": float(self.discount_amount) if self.discount_amount is not None else 0.0,
            "grandTotal": float(self.grand_total) if self.grand_total is not None else 0.0,
            "grand_total": float(self.grand_total) if self.grand_total is not None else 0.0,
            "status": self.status,
            "notes": self.notes,
            "createdBy": self.creator.name if self.creator else str(self.created_by),
            "created_by": self.created_by,
            "createdByRole": self.creator.role if self.creator else "SALES",
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "confirmedAt": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "cancelledAt": self.cancelled_at.isoformat() if self.cancelled_at else None,
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data

    def __repr__(self) -> str:
        return f"<SalesOrder id={self.id} number='{self.order_number}' status='{self.status}' total={self.grand_total}>"
