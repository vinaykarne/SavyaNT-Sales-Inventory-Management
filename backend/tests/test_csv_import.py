"""
SavyaNT Sales Order & Inventory Management System
CSV Import Automated Tests

Tests:
- All-or-nothing transactional bulk import
- Missing headers validation
- Duplicate code in CSV rejection
- Existing database code rejection
- Creation of Opening Stock movements
- Admin role restriction
"""

import io
import pytest
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.models.user import User


@pytest.mark.usefixtures("db_session")
class TestCSVImportAPI:
    """Integration tests for CSV product import."""

    def _login_admin(self, client, db_session):
        admin = User(name="Admin CSV", email="admin.csv@savya.com", role="ADMIN", is_active=True)
        admin.set_password("Pass123!")
        db_session.add(admin)
        db_session.flush()

        res = client.post("/api/auth/login", json={"email": admin.email, "password": "Pass123!"})
        token = res.get_json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_successful_csv_import_creates_products_and_movements(self, client, db_session):
        headers = self._login_admin(client, db_session)

        csv_content = (
            "product_code,name,category,price,stock_quantity,status\n"
            "CSV-PRD-01,Webcam 1080p,Peripherals,2499.00,15,Active\n"
            "CSV-PRD-02,Ring Light,Accessories,1200.00,20,Active\n"
        )
        data = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "products.csv")
        }

        res = client.post("/api/products/import", headers=headers, data=data, content_type="multipart/form-data")
        assert res.status_code == 201
        res_data = res.get_json()["data"]
        assert res_data["importedCount"] == 2

        # Verify products in DB
        p1 = Product.query.filter_by(product_code="CSV-PRD-01").first()
        assert p1 is not None
        assert p1.stock_quantity == 15

        # Verify Opening Stock movements
        m1 = StockMovement.query.filter_by(product_id=p1.id, movement_type="Opening Stock").first()
        assert m1 is not None
        assert m1.quantity_change == 15

    def test_all_or_nothing_rollback_on_single_invalid_row(self, client, db_session):
        headers = self._login_admin(client, db_session)

        # Row 1 valid, Row 2 has negative price
        csv_content = (
            "product_code,name,category,price,stock_quantity,status\n"
            "CSV-GOOD,Good Product,Peripherals,1000.00,10,Active\n"
            "CSV-BAD,Bad Product,Accessories,-500.00,5,Active\n"
        )
        data = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "products.csv")
        }

        res = client.post("/api/products/import", headers=headers, data=data, content_type="multipart/form-data")
        assert res.status_code == 400
        res_data = res.get_json()
        assert res_data["success"] is False
        assert "Zero products were imported" in res_data["error"]

        # Verify NOTHING was imported (all-or-nothing guarantee)
        assert Product.query.filter_by(product_code="CSV-GOOD").first() is None
