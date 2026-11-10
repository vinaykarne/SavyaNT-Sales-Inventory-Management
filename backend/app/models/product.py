"""
SavyaNT Sales Order & Inventory Management System
Product Model

Represents product catalog items with DECIMAL pricing, nonnegative stock invariants,
and foreign key protections against deletion when historical transactions exist.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from app.extensions import db


class Product(db.Model):
    """Product master entity with price and warehouse inventory quantity."""
    
    __tablename__ = "products"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    product_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    category = db.Column(db.String(100), nullable=False, index=True)
    price = db.Column(db.Numeric(12, 2), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0, server_default="0")
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
    
    # Relationships: Deletion restricted if referenced by orders or stock movements
    order_items = db.relationship(
        "SalesOrderItem",
        back_populates="product",
        lazy="select",
        passive_deletes=False,
    )
    stock_movements = db.relationship(
        "StockMovement",
        back_populates="product",
        lazy="select",
        passive_deletes=False,
    )
    
    __table_args__ = (
        db.CheckConstraint("price >= 0", name="chk_product_price_nonnegative"),
        db.CheckConstraint("stock_quantity >= 0", name="chk_product_stock_nonnegative"),
        db.CheckConstraint("status IN ('Active', 'Inactive')", name="chk_product_status"),
    )
    
    @property
    def is_active(self) -> bool:
        return self.status == "Active"
    
    def to_dict(self) -> dict[str, Any]:
        """Serializes product record into frontend-compatible format."""
        return {
            "id": self.product_code or str(self.id),
            "dbId": self.id,
            "productCode": self.product_code,
            "product_code": self.product_code,
            "name": self.name,
            "category": self.category,
            "price": float(self.price) if self.price is not None else 0.0,
            "stockQuantity": self.stock_quantity,
            "stock_quantity": self.stock_quantity,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "lastStockUpdate": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Product id={self.id} code='{self.product_code}' name='{self.name}' stock={self.stock_quantity}>"
