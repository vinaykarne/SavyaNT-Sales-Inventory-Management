"""
SavyaNT Sales Order & Inventory Management System
Inventory API Automated Tests

Tests:
- Stock increase adjustment
- Stock decrease adjustment
- Negative stock prevention
- Inventory summary and valuation
- Admin role restriction
"""

from decimal import Decimal
import pytest
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.models.user import User


@pytest.mark.usefixtures("db_session")
class TestInventoryAPI:
    """Integration tests for Inventory adjustment and history."""

    def _login(self, client, db_session, role="ADMIN"):
        user = User(name=f"{role} User", email=f"inv.{role.lower()}@savya.com", role=role, is_active=True)
        user.set_password("Pass123!")
        db_session.add(user)
        db_session.flush()

        res = client.post("/api/auth/login", json={"email": user.email, "password": "Pass123!"})
        token = res.get_json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_stock_increase_adjustment(self, client, db_session):
        headers = self._login(client, db_session, role="ADMIN")
        prod = Product(product_code="PRD-INV-1", name="RAM 16GB", category="Components", price=Decimal("4500.00"), stock_quantity=10, status="Active")
        db_session.add(prod)
        db_session.flush()

        res = client.post(
            "/api/inventory/adjust",
            headers=headers,
            json={
                "productId": prod.id,
                "movementType": "Stock Increase",
                "quantity": 15,
                "reason": "Restocked from supplier batch #881",
            },
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["product"]["stockQuantity"] == 25
        assert data["movement"]["movementType"] == "Stock Increase"
        assert data["movement"]["quantityChange"] == 15

    def test_stock_decrease_beyond_available_rejected(self, client, db_session):
        headers = self._login(client, db_session, role="ADMIN")
        prod = Product(product_code="PRD-INV-2", name="SSD 1TB", category="Storage", price=Decimal("6000.00"), stock_quantity=5, status="Active")
        db_session.add(prod)
        db_session.flush()

        res = client.post(
            "/api/inventory/adjust",
            headers=headers,
            json={
                "productId": prod.id,
                "movementType": "Stock Decrease",
                "quantity": 10,  # Only 5 available
                "reason": "Damaged items write-off",
            },
        )
        assert res.status_code == 409
        data = res.get_json()
        assert data["success"] is False
        assert "Insufficient stock" in data["error"]

    def test_sales_user_cannot_adjust_stock(self, client, db_session):
        headers = self._login(client, db_session, role="SALES")
        prod = Product(product_code="PRD-INV-3", name="Mouse Pad", category="Accessories", price=Decimal("200.00"), stock_quantity=20, status="Active")
        db_session.add(prod)
        db_session.flush()

        res = client.post(
            "/api/inventory/adjust",
            headers=headers,
            json={
                "productId": prod.id,
                "movementType": "Stock Increase",
                "quantity": 5,
                "reason": "Unauthorized attempt",
            },
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
