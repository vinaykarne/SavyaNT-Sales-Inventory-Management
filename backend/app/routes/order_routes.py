"""
SavyaNT Sales Order & Inventory Management System
Sales Order API Routes

Exposes:
- GET  /api/orders
- GET  /api/orders/<id>
- POST /api/orders
- PUT  /api/orders/<id>
- POST /api/orders/<id>/confirm
- POST /api/orders/<id>/cancel
"""

from flask import Blueprint, g, request
from app.services.order_service import OrderService
from app.utils.auth_decorators import sales_or_admin_required
from app.utils.responses import success_response

order_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


@order_bp.route("", methods=["GET"])
@sales_or_admin_required
def list_orders():
    """Lists sales orders with role-based scoping (SALES users strictly scoped to own orders)."""
    current_user = g.current_user
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    filters = {
        "status": request.args.get("status"),
        "search": request.args.get("search"),
        "date_from": request.args.get("date_from") or request.args.get("dateFrom"),
        "date_to": request.args.get("date_to") or request.args.get("dateTo"),
        "created_by": request.args.get("created_by") or request.args.get("createdBy"),
    }

    orders, meta = OrderService.list_orders(
        filters=filters,
        current_user=current_user,
        page=page,
        per_page=per_page,
    )
    return success_response(data=orders, meta=meta, message="Sales orders retrieved.")


@order_bp.route("/<identifier>", methods=["GET"])
@sales_or_admin_required
def get_order(identifier):
    """Retrieves order details with line items and customer information."""
    current_user = g.current_user
    order = OrderService.get_order_by_id_or_number(identifier, current_user=current_user)
    return success_response(data=order.to_dict(), message="Order details retrieved.")


@order_bp.route("", methods=["POST"])
@sales_or_admin_required
def create_order():
    """Creates a sales order with independent backend financial calculation."""
    data = request.get_json(silent=True) or {}
    current_user = g.current_user
    order = OrderService.create_order(data, current_user=current_user)
    return success_response(data=order, message="Sales order created successfully.", status_code=201)


@order_bp.route("/<identifier>", methods=["PUT"])
@sales_or_admin_required
def update_order(identifier):
    """Updates a Draft sales order (Confirmed or Cancelled orders are strictly immutable)."""
    data = request.get_json(silent=True) or {}
    current_user = g.current_user
    order = OrderService.update_order(identifier, data, current_user=current_user)
    return success_response(data=order, message="Sales order updated successfully.")


@order_bp.route("/<identifier>/confirm", methods=["POST"])
@sales_or_admin_required
def confirm_order(identifier):
    """Atomically confirms a Draft order, locking rows and deducting stock."""
    current_user = g.current_user
    order = OrderService.confirm_order(identifier, current_user=current_user)
    return success_response(data=order, message=f"Order '{order['orderNumber']}' confirmed successfully. Stock deducted.")


@order_bp.route("/<identifier>/cancel", methods=["POST"])
@sales_or_admin_required
def cancel_order(identifier):
    """Cancels an order. If previously confirmed, atomically restores stock with Sales Return movements."""
    data = request.get_json(silent=True) or {}
    reason = data.get("reason")
    current_user = g.current_user
    order = OrderService.cancel_order(identifier, current_user=current_user, reason=reason)
    return success_response(data=order, message=f"Order '{order['orderNumber']}' cancelled successfully.")
