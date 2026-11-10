"""
SavyaNT Sales Order & Inventory Management System
Reporting API Automated Tests

Tests:
- Dashboard summary calculation
- Confirmed-only revenue aggregation
- Low-stock counts
- Top products report
"""

from decimal import Decimal
import pytest
from app.models.customer import Customer
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.user import User


@pytest.mark.usefixtures("db_session")
class TestReportAPI:
    """Integration tests for reporting and dashboard aggregation."""

    def _login(self, client, db_session):
        user = User(name="Manager", email="manager@savya.com", role="ADMIN", is_active=True)
        user.set_password("Pass123!")
        db_session.add(user)
        db_session.flush()

        res = client.post("/api/auth/login", json={"email": user.email, "password": "Pass123!"})
        token = res.get_json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}, user

    def test_dashboard_summary_counts_only_confirmed_sales(self, client, db_session):
        headers, admin = self._login(client, db_session)

        cust = Customer(customer_code="CUST-REP", name="Report Cust", email="rep@cust.com", mobile="9800002222", city="Surat")
        prod = Product(product_code="PRD-REP", name="USB Cable", category="Accessories", price=Decimal("300.00"), stock_quantity=8, status="Active")
        db_session.add_all([cust, prod])
        db_session.flush()

        # Confirmed Order: Grand total = 600.00
        o_confirmed = SalesOrder(
            order_number="SO-REP-01",
            customer_id=cust.id,
            created_by=admin.id,
            subtotal=Decimal("600.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            grand_total=Decimal("600.00"),
            status="Confirmed",
        )
        # Draft Order: Grand total = 900.00 (MUST NOT BE COUNTED IN TOTAL REVENUE)
        o_draft = SalesOrder(
            order_number="SO-REP-02",
            customer_id=cust.id,
            created_by=admin.id,
            subtotal=Decimal("900.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            grand_total=Decimal("900.00"),
            status="Draft",
        )
        db_session.add_all([o_confirmed, o_draft])
        db_session.flush()

        res = client.get("/api/dashboard/summary", headers=headers)
        assert res.status_code == 200
        data = res.get_json()["data"]

        assert data["totalOrders"] == 2
        assert data["confirmedOrders"] == 1
        assert data["draftOrders"] == 1
        assert data["totalRevenue"] == 600.0  # Only Confirmed sales counted!
        assert data["lowStockCount"] == 1    # prod stock is 8 (<= 10)
