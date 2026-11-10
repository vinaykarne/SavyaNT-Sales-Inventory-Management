"""
SavyaNT Sales Order & Inventory Management System
Customer API Routes

Exposes:
- GET    /api/customers
- GET    /api/customers/active
- GET    /api/customers/<id>
- POST   /api/customers
- PUT    /api/customers/<id>
- DELETE /api/customers/<id>
- POST   /api/customers/<id>/toggle-status
"""

from flask import Blueprint, request
from app.services.customer_service import CustomerService
from app.utils.auth_decorators import admin_required, sales_or_admin_required
from app.utils.responses import success_response

customer_bp = Blueprint("customers", __name__, url_prefix="/api/customers")


@customer_bp.route("", methods=["GET"])
@sales_or_admin_required
def list_customers():
    """Lists customers with pagination, status, and search filters."""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    search = request.args.get("search")
    status = request.args.get("status")

    customers, meta = CustomerService.list_customers(
        page=page,
        per_page=per_page,
        search=search,
        status=status,
    )
    return success_response(data=customers, meta=meta, message="Customers retrieved.")


@customer_bp.route("/active", methods=["GET"])
@sales_or_admin_required
def list_active_customers():
    """Returns all active customers for order creation forms."""
    customers = CustomerService.get_all_active()
    return success_response(data=customers, message="Active customers retrieved.")


@customer_bp.route("/<identifier>", methods=["GET"])
@sales_or_admin_required
def get_customer(identifier):
    """Retrieves customer details by ID or customer code."""
    customer = CustomerService.get_by_id_or_code(identifier)
    return success_response(data=customer.to_dict(), message="Customer details retrieved.")


@customer_bp.route("", methods=["POST"])
@admin_required
def create_customer():
    """Creates a new customer (Admin role only)."""
    data = request.get_json(silent=True) or {}
    customer = CustomerService.create_customer(data)
    return success_response(data=customer, message="Customer created successfully.", status_code=201)


@customer_bp.route("/<identifier>", methods=["PUT"])
@admin_required
def update_customer(identifier):
    """Updates an existing customer (Admin role only)."""
    data = request.get_json(silent=True) or {}
    customer = CustomerService.update_customer(identifier, data)
    return success_response(data=customer, message="Customer updated successfully.")


@customer_bp.route("/<identifier>", methods=["DELETE"])
@admin_required
def delete_customer(identifier):
    """Deletes a customer if not referenced by sales orders (Admin role only)."""
    CustomerService.delete_customer(identifier)
    return success_response(data=None, message="Customer deleted successfully.")


@customer_bp.route("/<identifier>/toggle-status", methods=["POST"])
@admin_required
def toggle_customer_status(identifier):
    """Toggles active/inactive status of a customer (Admin role only)."""
    customer = CustomerService.toggle_status(identifier)
    return success_response(data=customer, message=f"Customer status updated to {customer['status']}.")
