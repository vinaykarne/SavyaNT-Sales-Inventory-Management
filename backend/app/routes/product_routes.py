"""
SavyaNT Sales Order & Inventory Management System
Product API Routes

Exposes:
- GET    /api/products
- GET    /api/products/active
- GET    /api/products/<id>
- POST   /api/products
- PUT    /api/products/<id>
- DELETE /api/products/<id>
- POST   /api/products/import (CSV Bulk Import)
"""

from flask import Blueprint, g, request
from app.services.csv_service import CSVService
from app.services.product_service import ProductService
from app.utils.auth_decorators import admin_required, sales_or_admin_required
from app.utils.responses import success_response

product_bp = Blueprint("products", __name__, url_prefix="/api/products")


@product_bp.route("", methods=["GET"])
@sales_or_admin_required
def list_products():
    """Lists products with pagination, search, category, and status filters."""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    search = request.args.get("search")
    category = request.args.get("category")
    status = request.args.get("status")

    products, meta = ProductService.list_products(
        page=page,
        per_page=per_page,
        search=search,
        category=category,
        status=status,
    )
    return success_response(data=products, meta=meta, message="Products retrieved.")


@product_bp.route("/active", methods=["GET"])
@sales_or_admin_required
def list_active_products():
    """Returns all active products for order line item dropdowns."""
    products = ProductService.get_all_active()
    return success_response(data=products, message="Active products retrieved.")


@product_bp.route("/<identifier>", methods=["GET"])
@sales_or_admin_required
def get_product(identifier):
    """Retrieves product details by ID or product code."""
    product = ProductService.get_by_id_or_code(identifier)
    return success_response(data=product.to_dict(), message="Product details retrieved.")


@product_bp.route("", methods=["POST"])
@admin_required
def create_product():
    """Creates a new product with optional opening stock movement (Admin role only)."""
    data = request.get_json(silent=True) or {}
    current_user = g.current_user
    product = ProductService.create_product(data, current_user_id=current_user.id)
    return success_response(data=product, message="Product created successfully.", status_code=201)


@product_bp.route("/<identifier>", methods=["PUT"])
@admin_required
def update_product(identifier):
    """Updates product metadata (Admin role only; direct stock mutation is strictly prohibited)."""
    data = request.get_json(silent=True) or {}
    product = ProductService.update_product(identifier, data)
    return success_response(data=product, message="Product updated successfully.")


@product_bp.route("/<identifier>", methods=["DELETE"])
@admin_required
def delete_product(identifier):
    """Deletes a product if not referenced by sales orders (Admin role only)."""
    ProductService.delete_product(identifier)
    return success_response(data=None, message="Product deleted successfully.")


@product_bp.route("/import", methods=["POST"])
@admin_required
def import_products_csv():
    """Bulk imports products from a CSV file in a single atomic transaction (Admin role only)."""
    file_storage = request.files.get("file")
    current_user = g.current_user
    result = CSVService.import_products_csv(file_storage, current_user_id=current_user.id)
    return success_response(
        data=result,
        message=f"Successfully imported {result['importedCount']} products.",
        status_code=201,
    )
