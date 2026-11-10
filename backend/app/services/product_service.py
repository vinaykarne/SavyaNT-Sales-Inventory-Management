"""
SavyaNT Sales Order & Inventory Management System
Product Business Service

Handles product lifecycle, uniqueness constraints, Decimal pricing, pagination,
historical order protection, and mandatory Opening Stock movement generation.
"""

from decimal import Decimal
from sqlalchemy import or_
from app.extensions import db
from app.models.product import Product
from app.models.sales_order_item import SalesOrderItem
from app.models.stock_movement import StockMovement
from app.utils.concurrency import generate_movement_code
from app.utils.exceptions import (
    BusinessConflictError,
    ResourceNotFoundError,
    ValidationError,
)
from app.utils.validators import validate_decimal_amount, validate_nonnegative_integer


class ProductService:
    """Manages products and enforces the critical invariant that ordinary editing never silently mutates stock."""

    @staticmethod
    def list_products(
        page: int = 1,
        per_page: int = 10,
        search: str | None = None,
        category: str | None = None,
        status: str | None = None,
    ) -> tuple[list[dict], dict]:
        """Lists products with optional search, category, and status filters."""
        query = Product.query
        
        if status and status.lower() != "all":
            query = query.filter(Product.status == status)
            
        if category and category.lower() != "all":
            query = query.filter(Product.category == category)
            
        if search:
            search_term = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    Product.name.ilike(search_term),
                    Product.product_code.ilike(search_term),
                    Product.category.ilike(search_term),
                )
            )
            
        query = query.order_by(Product.created_at.desc(), Product.id.desc())
        
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        items = [p.to_dict() for p in paginated.items]
        
        meta = {
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "pages": paginated.pages,
        }
        return items, meta

    @staticmethod
    def get_all_active() -> list[dict]:
        """Returns active products for sales order item selection."""
        products = Product.query.filter_by(status="Active").order_by(Product.name.asc()).all()
        return [p.to_dict() for p in products]

    @staticmethod
    def get_by_id_or_code(identifier: str | int) -> Product:
        """Finds a product by integer ID or string product_code."""
        product = None
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            product = Product.query.get(int(identifier))
        if not product and isinstance(identifier, str):
            product = Product.query.filter_by(product_code=identifier.strip()).first()
        if not product:
            raise ResourceNotFoundError(f"Product '{identifier}' was not found.")
        return product

    @staticmethod
    def create_product(data: dict, current_user_id: int | None = None) -> dict:
        """Creates a new product. If initial stock > 0, atomically records an Opening Stock movement."""
        product_code = data.get("product_code") or data.get("productCode")
        if not product_code or not isinstance(product_code, str) or not product_code.strip():
            raise ValidationError("Product code is required.")
        product_code = product_code.strip().upper()
        
        # Check uniqueness of product_code
        if Product.query.filter_by(product_code=product_code).first():
            raise BusinessConflictError(f"Product code '{product_code}' is already registered.")
            
        name = data.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            raise ValidationError("Product name is required.")
            
        category = (data.get("category") or "General").strip()
        price = validate_decimal_amount(data.get("price"), field_name="Product Price", min_val=Decimal("0.00"))
        
        raw_stock = data.get("stock_quantity") or data.get("stockQuantity") or 0
        stock_quantity = validate_nonnegative_integer(raw_stock, field_name="Stock Quantity")
        
        status = data.get("status", "Active")
        if status not in ("Active", "Inactive"):
            raise ValidationError("Status must be either 'Active' or 'Inactive'.")

        product = Product(
            product_code=product_code,
            name=name.strip(),
            category=category,
            price=price,
            stock_quantity=stock_quantity,
            status=status,
        )
        db.session.add(product)
        db.session.flush()  # Allocate product.id

        # CRITICAL INVARIANT: If initial stock > 0, atomically create Opening Stock movement
        if stock_quantity > 0:
            mov_code = generate_movement_code()
            opening_mov = StockMovement(
                movement_code=mov_code,
                product_id=product.id,
                movement_type="Opening Stock",
                quantity_change=stock_quantity,
                previous_stock=0,
                new_stock=stock_quantity,
                reason="Initial product creation opening balance",
                created_by=current_user_id,
            )
            db.session.add(opening_mov)

        db.session.commit()
        return product.to_dict()

    @staticmethod
    def update_product(identifier: str | int, data: dict) -> dict:
        """Updates product metadata.
        
        CRITICAL RULE: Ordinary product updates are strictly prohibited from mutating stock quantities.
        Stock modifications must use the dedicated Inventory Adjustment service.
        """
        product = ProductService.get_by_id_or_code(identifier)
        
        # If client attempts to mutate stock_quantity directly via PUT /products, reject or ignore
        incoming_stock = data.get("stock_quantity") or data.get("stockQuantity")
        if incoming_stock is not None:
            parsed_stock = validate_nonnegative_integer(incoming_stock, field_name="Stock Quantity")
            if parsed_stock != product.stock_quantity:
                raise ValidationError(
                    "Direct modification of stock quantity via product editing is prohibited. "
                    "Use the dedicated Inventory Adjustment endpoint (/api/inventory/adjust) to record auditable stock changes."
                )

        if "name" in data:
            name = data.get("name")
            if not name or not name.strip():
                raise ValidationError("Product name cannot be empty.")
            product.name = name.strip()
            
        if "category" in data:
            product.category = (data.get("category") or "General").strip()
            
        if "price" in data:
            product.price = validate_decimal_amount(data.get("price"), field_name="Product Price", min_val=Decimal("0.00"))
            
        if "status" in data:
            status = data.get("status")
            if status not in ("Active", "Inactive"):
                raise ValidationError("Status must be either 'Active' or 'Inactive'.")
            product.status = status

        db.session.commit()
        return product.to_dict()

    @staticmethod
    def delete_product(identifier: str | int) -> None:
        """Deletes a product safely, blocking deletion if referenced in sales orders."""
        product = ProductService.get_by_id_or_code(identifier)
        
        # Check order items reference
        referenced_in_orders = SalesOrderItem.query.filter_by(product_id=product.id).count()
        if referenced_in_orders > 0:
            raise BusinessConflictError(
                f"Cannot delete product '{product.name}' ({product.product_code}): "
                f"Referenced in {referenced_in_orders} historical sales order line item(s). "
                "Change status to 'Inactive' instead."
            )
            
        # Clean up any initial opening stock movements if not linked to orders
        movements = StockMovement.query.filter_by(product_id=product.id).all()
        for mov in movements:
            db.session.delete(mov)
            
        db.session.delete(product)
        db.session.commit()
