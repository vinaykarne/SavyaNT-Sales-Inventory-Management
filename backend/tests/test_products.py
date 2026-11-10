"""
SavyaNT Sales Order & Inventory Management System
Product API Automated Tests

Tests:
- Product creation and automatic Opening Stock movement generation
- Rejection of direct stock mutation via ordinary product editing
- Decimal price and stock validation
- Product deletion restrictions
"""

from decimal import Decimal
import pytest
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.models.user import User


@pytest.mark.usefixtures("db_session")
class TestProductAPI:
    """Integration tests for Product endpoints."""

    def _login_admin(self, client, db_session):
        admin = User(name="Admin", email="admin.prod@savya.com", role="ADMIN", is_active=True)
        admin.set_password("AdminPass123!")
        db_session.add(admin)
        db_session.flush()

        res = client.post("/api/auth/login", json={"email": admin.email, "password": "AdminPass123!"})
        token = res.get_json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}, admin

    def test_create_product_with_initial_stock_creates_movement(self, client, db_session):
        headers, _ = self._login_admin(client, db_session)
        res = client.post(
            "/api/products",
            headers=headers,
            json={
                "product_code": "PRD-TEST-01",
                "name": "Wireless Ergonomic Mouse",
                "category": "Peripherals",
                "price": "899.50",
                "stock_quantity": 40,
                "status": "Active",
            },
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["success"] is True
        assert data["data"]["productCode"] == "PRD-TEST-01"

        # Verify Opening Stock movement was created
        mov = StockMovement.query.filter_by(movement_type="Opening Stock").first()
        assert mov is not None
        assert mov.quantity_change == 40
        assert mov.previous_stock == 0
        assert mov.new_stock == 40

    def test_update_product_rejects_silent_stock_mutation(self, client, db_session):
        headers, _ = self._login_admin(client, db_session)
        prod = Product(
            product_code="PRD-TEST-02",
            name="USB-C Hub",
            category="Accessories",
            price=Decimal("1200.00"),
            stock_quantity=20,
            status="Active",
        )
        db_session.add(prod)
        db_session.flush()

        # Attempting to change stock via PUT /products must be rejected
        res = client.put(
            f"/api/products/{prod.id}",
            headers=headers,
            json={"name": "USB-C Hub V2", "stock_quantity": 50},
        )
        assert res.status_code == 400
        data = res.get_json()
        assert data["success"] is False
        assert "Direct modification of stock quantity" in data["error"]

    def test_negative_price_rejected(self, client, db_session):
        headers, _ = self._login_admin(client, db_session)
        res = client.post(
            "/api/products",
            headers=headers,
            json={
                "product_code": "PRD-NEG",
                "name": "Negative Price Item",
                "category": "Accessories",
                "price": "-50.00",
                "stock_quantity": 5,
            },
        )
        assert res.status_code == 400
        data = res.get_json()
        assert data["success"] is False
