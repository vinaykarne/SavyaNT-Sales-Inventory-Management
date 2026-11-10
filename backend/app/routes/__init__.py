"""
SavyaNT Sales Order & Inventory Management System
Flask API Routes Package
"""

from app.routes.auth_routes import auth_bp
from app.routes.customer_routes import customer_bp
from app.routes.product_routes import product_bp
from app.routes.order_routes import order_bp
from app.routes.inventory_routes import inventory_bp
from app.routes.report_routes import report_bp

__all__ = [
    "auth_bp",
    "customer_bp",
    "product_bp",
    "order_bp",
    "inventory_bp",
    "report_bp",
]
