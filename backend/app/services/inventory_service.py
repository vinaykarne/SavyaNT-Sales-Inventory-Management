"""
SavyaNT Sales Order & Inventory Management System
Inventory Service

Handles transaction-safe stock adjustments, movement auditing,
concurrency control with SELECT FOR UPDATE, and inventory valuations.
"""

from decimal import Decimal
from sqlalchemy import or_
from app.extensions import db
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.utils.concurrency import generate_movement_code
from app.utils.exceptions import (
    InsufficientStockError,
    ResourceNotFoundError,
    ValidationError,
)
from app.utils.validators import validate_positive_integer


class InventoryService:
    """Manages stock movements and atomic adjustments."""

    @staticmethod
    def get_inventory_summary(low_stock_threshold: int = 10) -> list[dict]:
        """Returns stock status for all products with valuation and low-stock indicators."""
        products = Product.query.order_by(Product.name.asc()).all()
        summary = []
        for p in products:
            valuation = (p.price * Decimal(str(p.stock_quantity))).quantize(Decimal("0.01"))
            summary.append({
                "productId": str(p.id),
                "productCode": p.product_code,
                "productName": p.name,
                "category": p.category,
                "price": float(p.price),
                "stockQuantity": p.stock_quantity,
                "status": p.status,
                "valuation": float(valuation),
                "isLowStock": p.stock_quantity <= low_stock_threshold,
                "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
            })
        return summary

    @staticmethod
    def list_movements(
        product_id: int | None = None,
        movement_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[dict], dict]:
        """Lists stock movements with filtering and pagination."""
        query = StockMovement.query
        
        if product_id is not None:
            query = query.filter(StockMovement.product_id == product_id)
            
        if movement_type and movement_type.lower() != "all":
            query = query.filter(StockMovement.movement_type == movement_type)
            
        if date_from:
            query = query.filter(StockMovement.created_at >= f"{date_from} 00:00:00")
            
        if date_to:
            query = query.filter(StockMovement.created_at <= f"{date_to} 23:59:59")
            
        query = query.order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        items = [m.to_dict() for m in paginated.items]
        
        meta = {
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "pages": paginated.pages,
        }
        return items, meta

    @staticmethod
    def get_product_movements(product_id: int | str) -> list[dict]:
        """Returns movement history for a specific product."""
        # Resolve product ID if string code given
        pid = None
        if isinstance(product_id, int) or (isinstance(product_id, str) and product_id.isdigit()):
            pid = int(product_id)
        else:
            p = Product.query.filter_by(product_code=str(product_id).strip()).first()
            if not p:
                raise ResourceNotFoundError(f"Product '{product_id}' was not found.")
            pid = p.id

        movements = (
            StockMovement.query.filter_by(product_id=pid)
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .all()
        )
        return [m.to_dict() for m in movements]

    @staticmethod
    def adjust_stock(data: dict, current_user_id: int | None = None) -> dict:
        """Performs atomic inventory adjustment (Stock Increase or Stock Decrease) with row-level locking."""
        product_identifier = data.get("product_id") or data.get("productId")
        if not product_identifier:
            raise ValidationError("Product identifier is required for stock adjustment.")
            
        movement_type = data.get("movement_type") or data.get("movementType")
        if movement_type not in ("Stock Increase", "Stock Decrease"):
            raise ValidationError("Movement type must be either 'Stock Increase' or 'Stock Decrease'.")
            
        quantity = validate_positive_integer(data.get("quantity"), field_name="Adjustment Quantity")
        reason = (data.get("reason") or "Manual inventory adjustment").strip()
        if not reason:
            raise ValidationError("A clear reason for stock adjustment is required.")

        # Resolve product id
        target_id = None
        if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and str(product_identifier).isdigit()):
            target_id = int(product_identifier)
        else:
            p = Product.query.filter_by(product_code=str(product_identifier).strip()).first()
            if not p:
                raise ResourceNotFoundError(f"Product '{product_identifier}' was not found.")
            target_id = p.id

        # ATOMIC ROW-LEVEL LOCK
        product = (
            db.session.query(Product)
            .filter_by(id=target_id)
            .with_for_update()
            .one_or_none()
        )
        if not product:
            raise ResourceNotFoundError("Product not found.")

        previous_stock = product.stock_quantity

        if movement_type == "Stock Decrease":
            if previous_stock < quantity:
                raise InsufficientStockError(
                    f"Insufficient stock for product '{product.name}' ({product.product_code}). "
                    f"Available: {previous_stock}, requested reduction: {quantity}."
                )
            new_stock = previous_stock - quantity
            quantity_change = -quantity
        else:
            new_stock = previous_stock + quantity
            quantity_change = quantity

        # Update product stock
        product.stock_quantity = new_stock

        # Record audited stock movement
        mov_code = generate_movement_code()
        movement = StockMovement(
            movement_code=mov_code,
            product_id=product.id,
            movement_type=movement_type,
            quantity_change=quantity_change,
            previous_stock=previous_stock,
            new_stock=new_stock,
            reason=reason,
            created_by=current_user_id,
        )
        db.session.add(movement)
        db.session.commit()

        return {
            "product": product.to_dict(),
            "movement": movement.to_dict(),
        }
