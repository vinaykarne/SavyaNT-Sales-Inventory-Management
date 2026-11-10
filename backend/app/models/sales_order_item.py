"""
SavyaNT Sales Order & Inventory Management System
Sales Order Item Model

Represents individual line items on a sales order with locked pricing at time
of creation, positive quantity checks, and duplicate-product prevention.
"""

from decimal import Decimal
from typing import Any
from app.extensions import db


class SalesOrderItem(db.Model):
    """Line item belonging to a sales order with rate snapshot."""
    
    __tablename__ = "sales_order_items"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sales_order_id = db.Column(
        db.Integer,
        db.ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity = db.Column(db.Integer, nullable=False)
    rate = db.Column(db.Numeric(12, 2), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    
    # Relationships
    order = db.relationship("SalesOrder", back_populates="items")
    product = db.relationship("Product", back_populates="order_items")
    
    __table_args__ = (
        db.UniqueConstraint("sales_order_id", "product_id", name="uq_order_product"),
        db.CheckConstraint("quantity > 0", name="chk_item_quantity_positive"),
        db.CheckConstraint("rate >= 0", name="chk_item_rate_nonnegative"),
        db.CheckConstraint("amount >= 0", name="chk_item_amount_nonnegative"),
    )
    
    def to_dict(self) -> dict[str, Any]:
        """Serializes line item matching frontend OrderItem interface."""
        return {
            "id": str(self.id),
            "dbId": self.id,
            "orderId": self.order.order_number if self.order else str(self.sales_order_id),
            "sales_order_id": self.sales_order_id,
            "productId": self.product.product_code if self.product else str(self.product_id),
            "product_id": self.product_id,
            "productCode": self.product.product_code if self.product else "",
            "product_code": self.product.product_code if self.product else "",
            "productName": self.product.name if self.product else "",
            "rate": float(self.rate) if self.rate is not None else 0.0,
            "quantity": self.quantity,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "availableStockSnapshot": self.product.stock_quantity if self.product else 0,
        }

    def __repr__(self) -> str:
        return f"<SalesOrderItem id={self.id} order_id={self.sales_order_id} product_id={self.product_id} qty={self.quantity} amount={self.amount}>"
