"""
SavyaNT Sales Order & Inventory Management System
Stock Movement Audit Model

Represents immutable warehouse inventory audit entries for tracking opening stock,
manual adjustments, sales deductions, and returns with complete user & order attribution.
"""

from datetime import datetime, timezone
from typing import Any
from app.extensions import db


class StockMovement(db.Model):
    """Immutable audit ledger record for every inventory change."""
    
    __tablename__ = "stock_movements"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    movement_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    related_order_id = db.Column(
        db.Integer,
        db.ForeignKey("sales_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    movement_type = db.Column(db.String(50), nullable=False, index=True)
    quantity_change = db.Column(db.Integer, nullable=False)
    previous_stock = db.Column(db.Integer, nullable=False)
    new_stock = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    
    # Relationships
    product = db.relationship("Product", back_populates="stock_movements")
    related_order = db.relationship("SalesOrder", back_populates="stock_movements")
    creator = db.relationship("User", back_populates="stock_movements")
    
    __table_args__ = (
        db.CheckConstraint(
            "movement_type IN ('Opening Stock', 'Stock Increase', 'Stock Decrease', 'Sales Deduction', 'Sales Return')",
            name="chk_movement_type",
        ),
        db.CheckConstraint("previous_stock >= 0", name="chk_movement_prev_stock_nonnegative"),
        db.CheckConstraint("new_stock >= 0", name="chk_movement_new_stock_nonnegative"),
    )
    
    def to_dict(self) -> dict[str, Any]:
        """Serializes stock movement matching frontend StockMovement interface."""
        return {
            "id": self.movement_code or str(self.id),
            "dbId": self.id,
            "movementCode": self.movement_code,
            "movement_code": self.movement_code,
            "productId": self.product.product_code if self.product else str(self.product_id),
            "product_id": self.product_id,
            "productCode": self.product.product_code if self.product else "",
            "product_code": self.product.product_code if self.product else "",
            "productName": self.product.name if self.product else "",
            "movementType": self.movement_type,
            "movement_type": self.movement_type,
            "quantityChange": self.quantity_change,
            "quantity_change": self.quantity_change,
            "previousStock": self.previous_stock,
            "previous_stock": self.previous_stock,
            "newStock": self.new_stock,
            "new_stock": self.new_stock,
            "relatedOrderId": self.related_order.order_number if self.related_order else (str(self.related_order_id) if self.related_order_id else None),
            "related_order_id": self.related_order_id,
            "relatedOrderNumber": self.related_order.order_number if self.related_order else None,
            "reason": self.reason,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "createdBy": self.creator.name if self.creator else str(self.created_by),
            "created_by": self.created_by,
        }

    def __repr__(self) -> str:
        return f"<StockMovement id={self.id} code='{self.movement_code}' product_id={self.product_id} type='{self.movement_type}' change={self.quantity_change}>"
