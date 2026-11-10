"""
SavyaNT Sales Order & Inventory Management System
Reporting & Analytics Service

Calculates real SQL-aggregated financial and inventory metrics, dashboard summaries,
and top product/customer performance based strictly on Confirmed orders.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import func, desc, and_
from app.extensions import db
from app.models.customer import Customer
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.stock_movement import StockMovement


class ReportService:
    """Computes real-time reporting metrics and analytics."""

    @staticmethod
    def get_dashboard_summary(low_stock_threshold: int = 10) -> dict:
        """Aggregates high-level metrics for dashboard stat cards and charts."""
        total_customers = Customer.query.count()
        active_customers = Customer.query.filter_by(status="Active").count()

        total_products = Product.query.count()
        low_stock_products = Product.query.filter(
            Product.stock_quantity <= low_stock_threshold,
            Product.status == "Active",
        ).count()

        total_orders = SalesOrder.query.count()
        confirmed_orders = SalesOrder.query.filter_by(status="Confirmed").count()
        draft_orders = SalesOrder.query.filter_by(status="Draft").count()
        cancelled_orders = SalesOrder.query.filter_by(status="Cancelled").count()

        # Confirmed sales revenue sum
        sales_sum = (
            db.session.query(func.coalesce(func.sum(SalesOrder.grand_total), 0))
            .filter(SalesOrder.status == "Confirmed")
            .scalar()
        )
        total_revenue = float(Decimal(str(sales_sum)).quantize(Decimal("0.01")))

        # Inventory total units and valuation
        inv_stats = db.session.query(
            func.coalesce(func.sum(Product.stock_quantity), 0),
            func.coalesce(func.sum(Product.price * Product.stock_quantity), 0),
        ).first()
        total_inventory_units = int(inv_stats[0]) if inv_stats else 0
        total_inventory_valuation = float(Decimal(str(inv_stats[1])).quantize(Decimal("0.01"))) if inv_stats else 0.0

        # Recent 5 orders
        recent_orders = (
            SalesOrder.query.order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
            .limit(5)
            .all()
        )

        return {
            "totalCustomers": total_customers,
            "activeCustomers": active_customers,
            "totalProducts": total_products,
            "lowStockCount": low_stock_products,
            "totalOrders": total_orders,
            "confirmedOrders": confirmed_orders,
            "draftOrders": draft_orders,
            "cancelledOrders": cancelled_orders,
            "totalRevenue": total_revenue,
            "inventoryUnits": total_inventory_units,
            "inventoryValuation": total_inventory_valuation,
            "recentOrders": [o.to_dict() for o in recent_orders],
        }

    @staticmethod
    def get_sales_report(date_from: str | None = None, date_to: str | None = None) -> dict:
        """Computes daily confirmed sales metrics and overall revenue totals."""
        query = SalesOrder.query.filter(SalesOrder.status == "Confirmed")

        if date_from:
            query = query.filter(SalesOrder.order_date >= date_from)
        if date_to:
            query = query.filter(SalesOrder.order_date <= date_to)

        # Aggregate daily sales
        daily_aggregates = (
            db.session.query(
                SalesOrder.order_date,
                func.count(SalesOrder.id).label("order_count"),
                func.sum(SalesOrder.subtotal).label("total_subtotal"),
                func.sum(SalesOrder.discount_amount).label("total_discount"),
                func.sum(SalesOrder.grand_total).label("total_grand_total"),
            )
            .filter(SalesOrder.status == "Confirmed")
        )

        if date_from:
            daily_aggregates = daily_aggregates.filter(SalesOrder.order_date >= date_from)
        if date_to:
            daily_aggregates = daily_aggregates.filter(SalesOrder.order_date <= date_to)

        daily_rows = (
            daily_aggregates.group_by(SalesOrder.order_date)
            .order_by(SalesOrder.order_date.asc())
            .all()
        )

        daily_data = []
        grand_total_sum = Decimal("0.00")
        total_orders_count = 0

        for r in daily_rows:
            day_total = Decimal(str(r.total_grand_total or 0)).quantize(Decimal("0.01"))
            grand_total_sum += day_total
            total_orders_count += int(r.order_count or 0)

            daily_data.append({
                "date": r.order_date.isoformat(),
                "orderCount": int(r.order_count),
                "subtotal": float(Decimal(str(r.total_subtotal or 0)).quantize(Decimal("0.01"))),
                "discount": float(Decimal(str(r.total_discount or 0)).quantize(Decimal("0.01"))),
                "revenue": float(day_total),
            })

        return {
            "totalRevenue": float(grand_total_sum),
            "totalConfirmedOrders": total_orders_count,
            "dailyBreakdown": daily_data,
        }

    @staticmethod
    def get_top_products_report(limit: int = 10) -> list[dict]:
        """Returns top-selling products by quantity and revenue, derived strictly from Confirmed orders."""
        rows = (
            db.session.query(
                Product.id,
                Product.product_code,
                Product.name,
                Product.category,
                func.sum(SalesOrderItem.quantity).label("total_quantity"),
                func.sum(SalesOrderItem.amount).label("total_revenue"),
            )
            .join(SalesOrderItem, SalesOrderItem.product_id == Product.id)
            .join(SalesOrder, SalesOrder.id == SalesOrderItem.sales_order_id)
            .filter(SalesOrder.status == "Confirmed")
            .group_by(Product.id, Product.product_code, Product.name, Product.category)
            .order_by(desc("total_quantity"), desc("total_revenue"))
            .limit(limit)
            .all()
        )

        results = []
        for r in rows:
            results.append({
                "productId": str(r.id),
                "productCode": r.product_code,
                "productName": r.name,
                "category": r.category,
                "totalQuantitySold": int(r.total_quantity or 0),
                "totalRevenue": float(Decimal(str(r.total_revenue or 0)).quantize(Decimal("0.01"))),
            })
        return results

    @staticmethod
    def get_customer_sales_report(limit: int = 10) -> list[dict]:
        """Returns top customers by total confirmed sales spend and order count."""
        rows = (
            db.session.query(
                Customer.id,
                Customer.customer_code,
                Customer.name,
                Customer.email,
                Customer.city,
                func.count(SalesOrder.id).label("confirmed_orders_count"),
                func.sum(SalesOrder.grand_total).label("total_spent"),
            )
            .join(SalesOrder, SalesOrder.customer_id == Customer.id)
            .filter(SalesOrder.status == "Confirmed")
            .group_by(Customer.id, Customer.customer_code, Customer.name, Customer.email, Customer.city)
            .order_by(desc("total_spent"), desc("confirmed_orders_count"))
            .limit(limit)
            .all()
        )

        results = []
        for r in rows:
            results.append({
                "customerId": str(r.id),
                "customerCode": r.customer_code,
                "customerName": r.name,
                "email": r.email,
                "city": r.city,
                "confirmedOrdersCount": int(r.confirmed_orders_count or 0),
                "totalSpent": float(Decimal(str(r.total_spent or 0)).quantize(Decimal("0.01"))),
            })
        return results

    @staticmethod
    def get_inventory_valuation_report() -> dict:
        """Returns category-level and overall inventory valuation."""
        rows = (
            db.session.query(
                Product.category,
                func.count(Product.id).label("product_count"),
                func.sum(Product.stock_quantity).label("total_units"),
                func.sum(Product.price * Product.stock_quantity).label("total_valuation"),
            )
            .group_by(Product.category)
            .order_by(desc("total_valuation"))
            .all()
        )

        categories = []
        total_units_all = 0
        total_valuation_all = Decimal("0.00")

        for r in rows:
            val = Decimal(str(r.total_valuation or 0)).quantize(Decimal("0.01"))
            total_valuation_all += val
            units = int(r.total_units or 0)
            total_units_all += units

            categories.append({
                "category": r.category,
                "productCount": int(r.product_count or 0),
                "totalUnits": units,
                "valuation": float(val),
            })

        return {
            "totalUnits": total_units_all,
            "totalValuation": float(total_valuation_all),
            "byCategory": categories,
        }
