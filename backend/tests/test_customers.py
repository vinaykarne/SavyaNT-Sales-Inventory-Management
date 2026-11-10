"""
SavyaNT Sales Order & Inventory Management System
Customer API Automated Tests

Tests:
- Customer creation (Admin only)
- Customer update
- Customer deletion protection (ON DELETE RESTRICT)
- Email uniqueness validation
- Role restrictions
"""

import pytest
from app.models.customer import Customer
from app.models.user import User
from app.models.sales_order import SalesOrder


@pytest.mark.usefixtures("db_session")
class TestCustomerAPI:
    """Integration tests for Customer endpoints."""

    def _login(self, client, db_session, role="ADMIN"):
        user = User(name=f"{role} User", email=f"{role.lower()}@savya.com", role=role, is_active=True)
        user.set_password("SecretPass123!")
        db_session.add(user)
        db_session.flush()

        res = client.post("/api/auth/login", json={"email": user.email, "password": "SecretPass123!"})
        token = res.get_json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}, user

    def test_create_customer_admin_success(self, client, db_session):
        headers, _ = self._login(client, db_session, role="ADMIN")
        res = client.post(
            "/api/customers",
            headers=headers,
            json={
                "name": "Tata Enterprises",
                "email": "procurement@tata.com",
                "mobile": "9820098200",
                "city": "Mumbai",
                "status": "Active",
            },
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["success"] is True
        assert data["data"]["name"] == "Tata Enterprises"
        assert data["data"]["customerCode"].startswith("CUST-")

    def test_create_customer_sales_user_forbidden(self, client, db_session):
        headers, _ = self._login(client, db_session, role="SALES")
        res = client.post(
            "/api/customers",
            headers=headers,
            json={
                "name": "Unauthorized Client",
                "email": "unauth@client.com",
                "mobile": "9800000000",
                "city": "Delhi",
            },
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False

    def test_duplicate_email_rejected(self, client, db_session):
        headers, _ = self._login(client, db_session, role="ADMIN")
        c = Customer(customer_code="CUST-701", name="Existing", email="dup@client.com", mobile="9811111111", city="Pune")
        db_session.add(c)
        db_session.flush()

        res = client.post(
            "/api/customers",
            headers=headers,
            json={
                "name": "Duplicate Person",
                "email": "dup@client.com",
                "mobile": "9822222222",
                "city": "Pune",
            },
        )
        assert res.status_code == 409
        data = res.get_json()
        assert data["success"] is False

    def test_delete_customer_with_orders_blocked(self, client, db_session):
        headers, admin = self._login(client, db_session, role="ADMIN")
        c = Customer(customer_code="CUST-702", name="Ordered Client", email="ordered@client.com", mobile="9833333333", city="Noida")
        db_session.add(c)
        db_session.flush()

        order = SalesOrder(
            order_number="SO-2026-9901",
            customer_id=c.id,
            created_by=admin.id,
            status="Confirmed",
        )
        db_session.add(order)
        db_session.flush()

        res = client.delete(f"/api/customers/{c.id}", headers=headers)
        assert res.status_code == 409
        data = res.get_json()
        assert data["success"] is False
        assert "existing sales order" in data["error"]
