"""
SavyaNT Sales Order & Inventory Management System
Reporting and Analytics API Routes

Exposes:
- GET /api/dashboard/summary
- GET /api/reports/sales
- GET /api/reports/inventory
- GET /api/reports/top-products
- GET /api/reports/customers
"""

from flask import Blueprint, request
from app.services.report_service import ReportService
from app.utils.auth_decorators import sales_or_admin_required
from app.utils.responses import success_response

report_bp = Blueprint("reports", __name__, url_prefix="/api")


@report_bp.route("/dashboard/summary", methods=["GET"])
@sales_or_admin_required
def get_dashboard_summary():
    """Returns dashboard overview statistics."""
    summary = ReportService.get_dashboard_summary()
    return success_response(data=summary, message="Dashboard summary retrieved.")


@report_bp.route("/reports/sales", methods=["GET"])
@sales_or_admin_required
def get_sales_report():
    """Returns sales breakdown and daily revenue totals from Confirmed orders."""
    date_from = request.args.get("date_from") or request.args.get("dateFrom")
    date_to = request.args.get("date_to") or request.args.get("dateTo")
    report = ReportService.get_sales_report(date_from=date_from, date_to=date_to)
    return success_response(data=report, message="Sales report retrieved.")


@report_bp.route("/reports/inventory", methods=["GET"])
@sales_or_admin_required
def get_inventory_report():
    """Returns inventory valuation categorized by product groups."""
    report = ReportService.get_inventory_valuation_report()
    return success_response(data=report, message="Inventory valuation report retrieved.")


@report_bp.route("/reports/top-products", methods=["GET"])
@sales_or_admin_required
def get_top_products():
    """Returns top-selling products by quantity and revenue."""
    limit = int(request.args.get("limit", 10))
    products = ReportService.get_top_products_report(limit=limit)
    return success_response(data=products, message="Top selling products retrieved.")


@report_bp.route("/reports/customers", methods=["GET"])
@sales_or_admin_required
def get_customer_report():
    """Returns customer purchase summary ranked by confirmed sales spend."""
    limit = int(request.args.get("limit", 10))
    customers = ReportService.get_customer_sales_report(limit=limit)
    return success_response(data=customers, message="Customer sales report retrieved.")
