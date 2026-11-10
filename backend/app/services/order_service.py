"""
SavyaNT Sales Order & Inventory Management System
Sales Order Business Service

Handles order lifecycle (Draft -> Confirmed -> Cancelled), independent Decimal financial calculation,
deadlock-free deterministic row-level locking, atomic stock deduction and restoration, and role permissions.
"""

from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import or_
from app.extensions import db
from app.models.customer import Customer
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.stock_movement import StockMovement
from app.models.user import User
from app.utils.concurrency import generate_movement_code, generate_order_number
from app.utils.exceptions import (
    BusinessConflictError,
    InsufficientStockError,
    PermissionDeniedError,
    ResourceNotFoundError,
    ValidationError,
)
from app.utils.validators import (
    validate_decimal_amount,
    validate_discount_percentage,
    validate_positive_integer,
)


def round_cur(val: Decimal) -> Decimal:
    """Rounds a Decimal value to 2 decimal places using standard ROUND_HALF_UP."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class OrderService:
    """Manages order creation, calculation, confirmation, cancellation, and role-based scoping."""

    @staticmethod
    def can_user_access_order(order: SalesOrder, current_user: User) -> bool:
        """Determines if a user has permission to read an order."""
        if current_user.is_admin:
            return True
        return order.created_by == current_user.id

    @staticmethod
    def can_user_modify_order(order: SalesOrder, current_user: User) -> bool:
        """Determines if a user has permission to update, confirm, or cancel an order."""
        if current_user.is_admin:
            return True
        return order.created_by == current_user.id

    @staticmethod
    def list_orders(
        filters: dict | None = None,
        current_user: User | None = None,
        page: int = 1,
        per_page: int = 10,
    ) -> tuple[list[dict], dict]:
        """Lists sales orders with role filtering, status, and date range support."""
        query = SalesOrder.query

        # SALES role is strictly limited to their own orders
        if current_user and current_user.is_sales:
            query = query.filter(SalesOrder.created_by == current_user.id)
        elif filters and filters.get("created_by"):
            query = query.filter(SalesOrder.created_by == filters.get("created_by"))

        if filters:
            status = filters.get("status")
            if status and status.lower() != "all":
                query = query.filter(SalesOrder.status == status)

            date_from = filters.get("date_from") or filters.get("dateFrom")
            if date_from:
                query = query.filter(SalesOrder.order_date >= date_from)

            date_to = filters.get("date_to") or filters.get("dateTo")
            if date_to:
                query = query.filter(SalesOrder.order_date <= date_to)

            search = filters.get("search")
            if search:
                term = f"%{search.strip().lower()}%"
                query = query.join(Customer).filter(
                    or_(
                        SalesOrder.order_number.ilike(term),
                        Customer.name.ilike(term),
                        Customer.customer_code.ilike(term),
                    )
                )

        query = query.order_by(SalesOrder.order_date.desc(), SalesOrder.id.desc())

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        items = [o.to_dict() for o in paginated.items]

        meta = {
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "pages": paginated.pages,
        }
        return items, meta

    @staticmethod
    def get_order_by_id_or_number(identifier: str | int, current_user: User | None = None) -> SalesOrder:
        """Retrieves a sales order by integer ID or order number, checking permissions."""
        order = None
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            order = SalesOrder.query.get(int(identifier))
        if not order and isinstance(identifier, str):
            order = SalesOrder.query.filter_by(order_number=identifier.strip()).first()

        if not order:
            raise ResourceNotFoundError(f"Sales order '{identifier}' was not found.")

        if current_user and not OrderService.can_user_access_order(order, current_user):
            raise PermissionDeniedError("Access denied: You do not have permission to view this order.", status_code=403)

        return order

    @staticmethod
    def _validate_and_build_items(items_raw: list[dict]) -> tuple[list[dict], Decimal]:
        """Validates line items, ensures no duplicates, loads current product prices, and calculates subtotal."""
        if not items_raw or not isinstance(items_raw, list):
            raise ValidationError("Order must contain at least one line item.")

        processed_items = []
        seen_product_ids = set()
        subtotal = Decimal("0.00")

        for idx, item in enumerate(items_raw, 1):
            prod_id_raw = item.get("productId") or item.get("product_id")
            if not prod_id_raw:
                raise ValidationError(f"Item #{idx}: Product ID is required.")

            # Resolve product
            product = None
            if isinstance(prod_id_raw, int) or (isinstance(prod_id_raw, str) and str(prod_id_raw).isdigit()):
                product = Product.query.get(int(prod_id_raw))
            else:
                product = Product.query.filter_by(product_code=str(prod_id_raw).strip()).first()

            if not product:
                raise ValidationError(f"Item #{idx}: Product '{prod_id_raw}' does not exist.")

            if product.status != "Active":
                raise ValidationError(f"Item #{idx}: Product '{product.name}' is Inactive and cannot be ordered.")

            if product.id in seen_product_ids:
                raise ValidationError(
                    f"Item #{idx}: Duplicate product '{product.name}' ({product.product_code}) detected. "
                    "Each product can only appear once per order. Adjust the quantity instead."
                )
            seen_product_ids.add(product.id)

            qty = validate_positive_integer(item.get("quantity"), field_name=f"Item #{idx} Quantity")
            
            # The backend independently determines the rate from the database product record
            rate = Decimal(str(product.price))
            line_amount = round_cur(Decimal(str(qty)) * rate)
            subtotal += line_amount

            processed_items.append({
                "product": product,
                "quantity": qty,
                "rate": rate,
                "amount": line_amount,
            })

        return processed_items, subtotal

    @staticmethod
    def create_order(data: dict, current_user: User) -> dict:
        """Creates a sales order with independent backend financial calculation and optional immediate confirmation."""
        # 1. Resolve and validate customer
        cust_id_raw = data.get("customerId") or data.get("customer_id")
        if not cust_id_raw:
            raise ValidationError("Customer selection is required.")

        customer = None
        if isinstance(cust_id_raw, int) or (isinstance(cust_id_raw, str) and str(cust_id_raw).isdigit()):
            customer = Customer.query.get(int(cust_id_raw))
        else:
            customer = Customer.query.filter_by(customer_code=str(cust_id_raw).strip()).first()

        if not customer:
            raise ValidationError("Selected customer does not exist.")

        if customer.status != "Active":
            raise ValidationError(f"Customer '{customer.name}' is Inactive. Orders cannot be created for inactive customers.")

        # 2. Parse order date
        order_date_raw = data.get("orderDate") or data.get("order_date")
        if order_date_raw:
            try:
                order_date = datetime.strptime(str(order_date_raw)[:10], "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("Invalid orderDate format. Expected YYYY-MM-DD.")
        else:
            order_date = date.today()

        # 3. Validate items and compute subtotal
        items_raw = data.get("items")
        validated_items, subtotal = OrderService._validate_and_build_items(items_raw)

        # 4. Validate discount (0% to 20%) and compute financials
        disc_pct_raw = data.get("discountPercentage") or data.get("discount_percentage") or 0
        discount_percentage = validate_discount_percentage(disc_pct_raw)
        discount_amount = round_cur(subtotal * (discount_percentage / Decimal("100.00")))
        grand_total = round_cur(subtotal - discount_amount)

        notes = (data.get("notes") or "").strip()
        requested_status = data.get("status", "Draft")
        if requested_status not in ("Draft", "Confirmed"):
            raise ValidationError("New orders must have status 'Draft' or 'Confirmed'.")

        order_number = generate_order_number()

        # 5. Persist order
        order = SalesOrder(
            order_number=order_number,
            customer_id=customer.id,
            created_by=current_user.id,
            order_date=order_date,
            subtotal=subtotal,
            discount_percentage=discount_percentage,
            discount_amount=discount_amount,
            grand_total=grand_total,
            status="Draft",  # Stored as Draft first; if Confirmed requested, confirmed below
            notes=notes,
        )
        db.session.add(order)
        db.session.flush()

        for item_info in validated_items:
            order_item = SalesOrderItem(
                sales_order_id=order.id,
                product_id=item_info["product"].id,
                quantity=item_info["quantity"],
                rate=item_info["rate"],
                amount=item_info["amount"],
            )
            db.session.add(order_item)

        # 6. If immediate confirmation requested, execute atomic confirmation
        if requested_status == "Confirmed":
            OrderService._execute_order_confirmation(order, current_user)

        db.session.commit()
        return order.to_dict()

    @staticmethod
    def update_order(identifier: str | int, data: dict, current_user: User) -> dict:
        """Updates a draft sales order. Confirmed or Cancelled orders are strictly immutable."""
        order = OrderService.get_order_by_id_or_number(identifier, current_user)

        if not OrderService.can_user_modify_order(order, current_user):
            raise PermissionDeniedError("Access denied: You do not have permission to modify this order.", status_code=403)

        if order.status != "Draft":
            raise BusinessConflictError(
                f"Order '{order.order_number}' is {order.status} and cannot be modified. "
                "Only Draft orders can be updated."
            )

        # Update customer if provided
        cust_id_raw = data.get("customerId") or data.get("customer_id")
        if cust_id_raw:
            customer = None
            if isinstance(cust_id_raw, int) or (isinstance(cust_id_raw, str) and str(cust_id_raw).isdigit()):
                customer = Customer.query.get(int(cust_id_raw))
            else:
                customer = Customer.query.filter_by(customer_code=str(cust_id_raw).strip()).first()
            if not customer:
                raise ValidationError("Customer does not exist.")
            if customer.status != "Active":
                raise ValidationError(f"Customer '{customer.name}' is Inactive.")
            order.customer_id = customer.id

        # Update order date if provided
        order_date_raw = data.get("orderDate") or data.get("order_date")
        if order_date_raw:
            try:
                order.order_date = datetime.strptime(str(order_date_raw)[:10], "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("Invalid orderDate format. Expected YYYY-MM-DD.")

        # Update items if provided
        items_raw = data.get("items")
        if items_raw is not None:
            validated_items, subtotal = OrderService._validate_and_build_items(items_raw)
            
            # Remove old items
            SalesOrderItem.query.filter_by(sales_order_id=order.id).delete()

            # Add updated items
            for item_info in validated_items:
                order_item = SalesOrderItem(
                    sales_order_id=order.id,
                    product_id=item_info["product"].id,
                    quantity=item_info["quantity"],
                    rate=item_info["rate"],
                    amount=item_info["amount"],
                )
                db.session.add(order_item)
            order.subtotal = subtotal
        else:
            subtotal = order.subtotal

        # Update discount if provided
        disc_pct_raw = data.get("discountPercentage") or data.get("discount_percentage")
        if disc_pct_raw is not None:
            order.discount_percentage = validate_discount_percentage(disc_pct_raw)

        # Recalculate totals
        order.discount_amount = round_cur(order.subtotal * (order.discount_percentage / Decimal("100.00")))
        order.grand_total = round_cur(order.subtotal - order.discount_amount)

        if "notes" in data:
            order.notes = (data.get("notes") or "").strip()

        db.session.commit()
        return order.to_dict()

    @staticmethod
    def confirm_order(identifier: str | int, current_user: User) -> dict:
        """Public endpoint to confirm an order atomically."""
        order = OrderService.get_order_by_id_or_number(identifier, current_user)

        if not OrderService.can_user_modify_order(order, current_user):
            raise PermissionDeniedError("Access denied: You do not have permission to confirm this order.", status_code=403)

        OrderService._execute_order_confirmation(order, current_user)
        db.session.commit()
        return order.to_dict()

    @staticmethod
    def _execute_order_confirmation(order: SalesOrder, current_user: User) -> None:
        """Internal atomic confirmation with deadlock-free row locking (SELECT FOR UPDATE)."""
        # 1. Lock the order row
        locked_order = (
            db.session.query(SalesOrder)
            .filter_by(id=order.id)
            .with_for_update()
            .one()
        )

        if locked_order.status == "Confirmed":
            # Idempotent or already confirmed
            return

        if locked_order.status == "Cancelled":
            raise BusinessConflictError(f"Cannot confirm order '{locked_order.order_number}': It has already been Cancelled.")

        # 2. Collect item product IDs and sort them to eliminate MySQL deadlocks
        items = SalesOrderItem.query.filter_by(sales_order_id=locked_order.id).all()
        if not items:
            raise ValidationError(f"Order '{locked_order.order_number}' has no line items.")

        # Sort product IDs ascending for deterministic locking order
        product_ids = sorted([item.product_id for item in items])

        # 3. Acquire row locks on all affected products
        locked_products = (
            db.session.query(Product)
            .filter(Product.id.in_(product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
            .all()
        )
        products_by_id = {p.id: p for p in locked_products}

        # 4. Verify sufficient stock for EVERY line item
        for item in items:
            product = products_by_id.get(item.product_id)
            if not product:
                raise ResourceNotFoundError(f"Product ID {item.product_id} not found.")

            if product.stock_quantity < item.quantity:
                raise InsufficientStockError(
                    f"Insufficient stock for '{product.name}' ({product.product_code}). "
                    f"Available: {product.stock_quantity}, Required: {item.quantity}. "
                    "Confirmation aborted; zero stock has been deducted."
                )

        # 5. Deduct stock and record audited Sales Deduction movements
        for item in items:
            product = products_by_id[item.product_id]
            prev_stock = product.stock_quantity
            new_stock = prev_stock - item.quantity

            product.stock_quantity = new_stock

            mov_code = generate_movement_code()
            movement = StockMovement(
                movement_code=mov_code,
                product_id=product.id,
                movement_type="Sales Deduction",
                quantity_change=-item.quantity,
                previous_stock=prev_stock,
                new_stock=new_stock,
                related_order_id=locked_order.id,
                reason=f"Order confirmation deduction for {locked_order.order_number}",
                created_by=current_user.id,
            )
            db.session.add(movement)

        # 6. Update order status and timestamp
        locked_order.status = "Confirmed"
        locked_order.confirmed_at = datetime.now(timezone.utc)

    @staticmethod
    def cancel_order(identifier: str | int, current_user: User, reason: str | None = None) -> dict:
        """Cancels a sales order. If confirmed, atomically restores stock with 'Sales Return' movements."""
        order = OrderService.get_order_by_id_or_number(identifier, current_user)

        if not OrderService.can_user_modify_order(order, current_user):
            raise PermissionDeniedError("Access denied: You do not have permission to cancel this order.", status_code=403)

        # 1. Lock the order row
        locked_order = (
            db.session.query(SalesOrder)
            .filter_by(id=order.id)
            .with_for_update()
            .one()
        )

        if locked_order.status == "Cancelled":
            raise BusinessConflictError(f"Order '{locked_order.order_number}' is already Cancelled.")

        # Case A: Draft order cancellation (no stock changes occurred, simply mark Cancelled)
        if locked_order.status == "Draft":
            locked_order.status = "Cancelled"
            locked_order.cancelled_at = datetime.now(timezone.utc)
            if reason:
                locked_order.notes = f"{locked_order.notes or ''} [Cancelled: {reason.strip()}]".strip()
            db.session.commit()
            return locked_order.to_dict()

        # Case B: Confirmed order cancellation -> ATOMIC RESTORATION
        items = SalesOrderItem.query.filter_by(sales_order_id=locked_order.id).all()
        product_ids = sorted([item.product_id for item in items])

        locked_products = (
            db.session.query(Product)
            .filter(Product.id.in_(product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
            .all()
        )
        products_by_id = {p.id: p for p in locked_products}

        cancel_reason = reason.strip() if reason else f"Order cancellation return for {locked_order.order_number}"

        for item in items:
            product = products_by_id.get(item.product_id)
            if not product:
                continue

            prev_stock = product.stock_quantity
            new_stock = prev_stock + item.quantity

            product.stock_quantity = new_stock

            mov_code = generate_movement_code()
            movement = StockMovement(
                movement_code=mov_code,
                product_id=product.id,
                movement_type="Sales Return",
                quantity_change=item.quantity,
                previous_stock=prev_stock,
                new_stock=new_stock,
                related_order_id=locked_order.id,
                reason=cancel_reason,
                created_by=current_user.id,
            )
            db.session.add(movement)

        locked_order.status = "Cancelled"
        locked_order.cancelled_at = datetime.now(timezone.utc)
        if reason:
            locked_order.notes = f"{locked_order.notes or ''} [Cancelled: {reason.strip()}]".strip()

        db.session.commit()
        return locked_order.to_dict()
