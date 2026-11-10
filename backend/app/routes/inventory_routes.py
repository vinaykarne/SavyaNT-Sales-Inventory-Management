"""
SavyaNT Sales Order & Inventory Management System
Inventory API Routes

Exposes:
- GET  /api/inventory
- GET  /api/inventory/movements
- GET  /api/inventory/movements/<product_id>
- POST /api/inventory/adjust
"""

from flask import Blueprint, g, request
from app.services.inventory_service import InventoryService
from app.utils.auth_decorators import admin_required, sales_or_admin_required
from app.utils.responses import success_response

inventory_bp = Blueprint("inventory", __name__, url_prefix="/api/inventory")


@inventory_bp.route("", methods=["GET"])
@sales_or_admin_required
def get_inventory():
    """Returns inventory status, valuation, and stock levels for all products."""
    summary = InventoryService.get_inventory_summary()
    return success_response(data=summary, message="Inventory summary retrieved.")


@inventory_bp.route("/movements", methods=["GET"])
@sales_or_admin_required
def list_movements():
    """Lists stock movements with pagination and filter support."""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    movement_type = request.args.get("movement_type") or request.args.get("movementType")
    date_from = request.args.get("date_from") or request.args.get("dateFrom")
    date_to = request.args.get("date_to") or request.args.get("dateTo")
    raw_pid = request.args.get("product_id") or request.args.get("productId")
    
    product_id = int(raw_pid) if raw_pid and raw_pid.isdigit() else None

    movements, meta = InventoryService.list_movements(
        product_id=product_id,
        movement_type=movement_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    return success_response(data=movements, meta=meta, message="Stock movements retrieved.")


@inventory_bp.route("/movements/<product_id>", methods=["GET"])
@sales_or_admin_required
def get_product_movements(product_id):
    """Returns stock movement history for a specific product."""
    movements = InventoryService.get_product_movements(product_id)
    return success_response(data=movements, message=f"Stock movements for product '{product_id}' retrieved.")


@inventory_bp.route("/adjust", methods=["POST"])
@admin_required
def adjust_inventory():
    """Performs an atomic inventory adjustment (Admin role only)."""
    data = request.get_json(silent=True) or {}
    current_user = g.current_user
    result = InventoryService.adjust_stock(data, current_user_id=current_user.id)
    return success_response(
        data=result,
        message=f"Stock adjusted successfully for product '{result['product']['name']}'.",
    )
