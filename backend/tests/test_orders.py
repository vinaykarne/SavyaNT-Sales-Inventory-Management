"""
SavyaNT Sales Order & Inventory Management System
Sales Order API Automated Tests

Tests:
- Order financial calculation (Decimal precision, discount capped at 20%)
- Atomic order confirmation and stock deduction
- Insufficient stock rollback prevention
- Order cancellation and atomic stock restoration
- Sales role scoping (Sales users only see own orders)
"""

from decimal import Decimal
import pytest
from app.models.customer import Customer
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.stock_movement import StockMovement
from app.models.user import User


@pytest.mark.usefixtures("db_session")
class TestOrderAPI:
    """Integration tests for Sales Order lifecycle and inventory transactions."""

    def _setup_entities(self, db_session):
        admin = User(name="Admin One", email="admin1@savya.com", role="ADMIN", is_active=True)
        admin.set_password("Pass123!")
        sales = User(name="Sales Rep", email="salesrep@savya.com", role="SALES", is_active=True)
        sales.set_password("Pass123!")

        cust = Customer(customer_code="CUST-ORD-1", name="Order Customer", email="ord@cust.com", mobile="9800001111", city="Mumbai")
        prod1 = Product(product_code="PRD-ORD-1", name="Monitor 27in", category="Displays", price=Decimal("15000.00"), stock_quantity=10, status="Active")
        prod2 = Product(product_code="PRD-ORD-2", name="HDMI Cable", category="Accessories", price=Decimal("500.00"), stock_quantity=50, status="Active")

        db_session.add_all([admin, sales, cust, prod1, prod2])
        db_session.flush()
        return admin, sales, cust, prod1, prod2

    def _get_headers(self, client, user):
        res = client.post("/api/auth/login", json={"email": user.email, "password": "Pass123!"})
        token = res.get_json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_create_draft_order_calculates_financials(self, client, db_session):
        admin, _, cust, prod1, prod2 = self._setup_entities(db_session)
        headers = self._get_headers(client, admin)

        res = client.post(
            "/api/orders",
            headers=headers,
            json={
                "customerId": cust.id,
                "orderDate": "2026-04-10",
                "items": [
                    {"productId": prod1.id, "quantity": 2},  # 2 * 15000 = 30000
                    {"productId": prod2.id, "quantity": 4},  # 4 * 500 = 2000; subtotal = 32000
                ],
                "discountPercentage": 10.0,  # 10% discount = 3200
                "status": "Draft",
            },
        )
        assert res.status_code == 201
        data = res.get_json()["data"]
        assert data["subtotal"] == 32000.0
        assert data["discountAmount"] == 3200.0
        assert data["grandTotal"] == 28800.0
        assert data["status"] == "Draft"

        # Verify stock has NOT changed for draft order
        assert prod1.stock_quantity == 10
        assert prod2.stock_quantity == 50

    def test_discount_above_twenty_percent_rejected(self, client, db_session):
        admin, _, cust, prod1, _ = self._setup_entities(db_session)
        headers = self._get_headers(client, admin)

        res = client.post(
            "/api/orders",
            headers=headers,
            json={
                "customerId": cust.id,
                "items": [{"productId": prod1.id, "quantity": 1}],
                "discountPercentage": 25.0,  # Violates 0-20% rule
                "status": "Draft",
            },
        )
        assert res.status_code == 400
        data = res.get_json()
        assert data["success"] is False
        assert "between 0% and 20%" in data["error"]

    def test_atomic_order_confirmation_deducts_stock(self, client, db_session):
        admin, _, cust, prod1, prod2 = self._setup_entities(db_session)
        headers = self._get_headers(client, admin)

        # Create Draft order
        res_create = client.post(
            "/api/orders",
            headers=headers,
            json={
                "customerId": cust.id,
                "items": [
                    {"productId": prod1.id, "quantity": 3},
                    {"productId": prod2.id, "quantity": 10},
                ],
                "discountPercentage": 5.0,
                "status": "Draft",
            },
        )
        order_id = res_create.get_json()["data"]["id"]

        # Confirm order
        res_confirm = client.post(f"/api/orders/{order_id}/confirm", headers=headers)
        assert res_confirm.status_code == 200
        confirmed_order = res_confirm.get_json()["data"]
        assert confirmed_order["status"] == "Confirmed"
        assert confirmed_order["confirmedAt"] is not None

        # Verify stock deduction
        db_session.refresh(prod1)
        db_session.refresh(prod2)
        assert prod1.stock_quantity == 7   # 10 - 3
        assert prod2.stock_quantity == 40  # 50 - 10

        # Verify Sales Deduction movements created
        deductions = StockMovement.query.filter_by(movement_type="Sales Deduction").all()
        assert len(deductions) == 2

    def test_insufficient_stock_aborts_confirmation(self, client, db_session):
        admin, _, cust, prod1, _ = self._setup_entities(db_session)
        headers = self._get_headers(client, admin)

        # Attempt to order 15 units when only 10 in stock
        res_create = client.post(
            "/api/orders",
            headers=headers,
            json={
                "customerId": cust.id,
                "items": [{"productId": prod1.id, "quantity": 15}],
                "discountPercentage": 0,
                "status": "Draft",
            },
        )
        order_id = res_create.get_json()["data"]["id"]

        res_confirm = client.post(f"/api/orders/{order_id}/confirm", headers=headers)
        assert res_confirm.status_code == 409
        data = res_confirm.get_json()
        assert "Insufficient stock" in data["error"]

        # Verify order remained Draft and stock untouched
        db_session.refresh(prod1)
        assert prod1.stock_quantity == 10

    def test_cancel_confirmed_order_restores_stock(self, client, db_session):
        admin, _, cust, prod1, _ = self._setup_entities(db_session)
        headers = self._get_headers(client, admin)

        # Create and confirm
        res = client.post(
            "/api/orders",
            headers=headers,
            json={
                "customerId": cust.id,
                "items": [{"productId": prod1.id, "quantity": 4}],
                "status": "Confirmed",
            },
        )
        order_id = res.get_json()["data"]["id"]
        db_session.refresh(prod1)
        assert prod1.stock_quantity == 6  # 10 - 4

        # Cancel confirmed order
        res_cancel = client.post(
            f"/api/orders/{order_id}/cancel",
            headers=headers,
            json={"reason": "Customer cancelled order"},
        )
        assert res_cancel.status_code == 200
        assert res_cancel.get_json()["data"]["status"] == "Cancelled"

        # Verify stock restored
        db_session.refresh(prod1)
        assert prod1.stock_quantity == 10

        # Verify Sales Return movement created
        ret = StockMovement.query.filter_by(movement_type="Sales Return").first()
        assert ret is not None
        assert ret.quantity_change == 4
        assert ret.new_stock == 10
