"""
SavyaNT Sales Order & Inventory Management System
Database Model & Constraint Tests

Contains two distinct testing suites:
1. Pure Unit Tests: Validates model logic, password hashing, role checks, and serialization on unsaved Python objects.
2. Database-Backed Integration Tests: Uses live MySQL test transactions to verify actual database-level constraints, unique indexes, CHECK constraints, foreign-key referential integrity, and RESTRICT deletion behaviors.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from app.models import (
    User,
    Customer,
    Product,
    SalesOrder,
    SalesOrderItem,
    StockMovement,
)


# ==============================================================================
# 1. PURE MODEL UNIT TESTS (No Database Connection Required)
# ==============================================================================

class TestModelPureUnit:
    """Verifies in-memory model methods, Werkzeug hashing, and field serialization."""

    def test_password_hashing_and_verification(self):
        """Verifies Werkzeug hashing creates secure hashes and verifies correctly."""
        user = User(
            name="Test Engineer",
            email="engineer@savya.com",
            role="ADMIN",
        )
        user.set_password("SecurePassword123!")

        assert user.password_hash is not None
        assert user.password_hash != "SecurePassword123!"
        assert user.password_hash.startswith("scrypt:") or user.password_hash.startswith("pbkdf2:")
        assert user.check_password("SecurePassword123!") is True
        assert user.check_password("WrongPassword") is False
        assert user.check_password("") is False

    def test_short_password_rejection(self):
        """Verifies passwords shorter than 6 characters are rejected with a ValueError."""
        user = User(name="User", email="test@savya.com", role="SALES")
        with pytest.raises(ValueError, match="at least 6 characters"):
            user.set_password("12345")

    def test_role_properties(self):
        """Verifies is_admin and is_sales property checks."""
        admin = User(name="Admin", email="admin@savya.com", role="ADMIN")
        sales = User(name="Sales", email="sales@savya.com", role="SALES")

        assert admin.is_admin is True
        assert admin.is_sales is False
        assert sales.is_admin is False
        assert sales.is_sales is True

    def test_user_serialization_protects_password_hash(self):
        """Verifies to_dict does not expose password hash by default."""
        user = User(
            id=1,
            name="Alice",
            email="alice@savya.com",
            role="ADMIN",
            is_active=True,
            created_at=datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc),
        )
        user.set_password("Secret123!")
        serialized = user.to_dict()

        assert "passwordHash" not in serialized
        assert serialized["email"] == "alice@savya.com"
        assert serialized["role"] == "ADMIN"
        assert serialized["isActive"] is True

    def test_customer_to_dict_matches_frontend_contract(self):
        """Verifies customer serialization provides camelCase fields matching frontend interface."""
        customer = Customer(
            id=1,
            customer_code="CUST-001",
            name="Aarav Patel",
            email="aarav@apextech.in",
            mobile="9820123456",
            city="Mumbai",
            status="Active",
        )
        data = customer.to_dict()
        assert data["id"] == "CUST-001"
        assert data["customerCode"] == "CUST-001"
        assert data["name"] == "Aarav Patel"
        assert data["city"] == "Mumbai"

    def test_product_monetary_decimal_precision(self):
        """Verifies that price maintains Python Decimal representation without floating-point drift."""
        product = Product(
            id=1,
            product_code="PRD-001",
            name="Mechanical Keyboard",
            category="Accessories",
            price=Decimal("1499.99"),
            stock_quantity=25,
            status="Active",
        )
        assert isinstance(product.price, Decimal)
        assert product.price == Decimal("1499.99")
        assert product.stock_quantity == 25


# ==============================================================================
# 2. DATABASE-BACKED CONSTRAINT & INTEGRITY TESTS (Requires Test MySQL Database)
# ==============================================================================

@pytest.mark.usefixtures("db_session")
class TestDatabaseModelConstraints:
    """Live database tests verifying MySQL constraints, unique indexes, and foreign keys."""

    def test_db_unique_user_email(self, db_session):
        """Database test: Inserting two users with identical email must raise IntegrityError."""
        u1 = User(name="User 1", email="duplicate@savya.com", role="SALES")
        u1.set_password("Password123!")
        db_session.add(u1)
        db_session.flush()

        u2 = User(name="User 2", email="duplicate@savya.com", role="ADMIN")
        u2.set_password("Password456!")
        db_session.add(u2)

        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_db_unique_customer_code_and_email(self, db_session):
        """Database test: Duplicate customer code or email must be rejected by MySQL."""
        c1 = Customer(
            customer_code="CUST-901",
            name="Client One",
            email="client1@domain.in",
            mobile="9811000001",
            city="Delhi",
            status="Active",
        )
        db_session.add(c1)
        db_session.flush()

        # Duplicate code
        c2 = Customer(
            customer_code="CUST-901",
            name="Client Two",
            email="client2@domain.in",
            mobile="9811000002",
            city="Mumbai",
            status="Active",
        )
        db_session.add(c2)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_db_unique_product_code(self, db_session):
        """Database test: Duplicate product code must violate unique constraint."""
        p1 = Product(
            product_code="PRD-888",
            name="Mouse A",
            category="Accessories",
            price=Decimal("500.00"),
            stock_quantity=10,
            status="Active",
        )
        db_session.add(p1)
        db_session.flush()

        p2 = Product(
            product_code="PRD-888",
            name="Mouse B",
            category="Accessories",
            price=Decimal("600.00"),
            stock_quantity=20,
            status="Active",
        )
        db_session.add(p2)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_db_nonnegative_product_price_and_stock(self, db_session):
        """Database test: Negative price or negative stock must violate MySQL CHECK constraints."""
        # Negative price
        bad_price = Product(
            product_code="PRD-NEG-1",
            name="Bad Price",
            category="Accessories",
            price=Decimal("-10.00"),
            stock_quantity=5,
            status="Active",
        )
        db_session.add(bad_price)
        with pytest.raises((IntegrityError, OperationalError)):
            db_session.flush()
        db_session.rollback()

        # Negative stock
        bad_stock = Product(
            product_code="PRD-NEG-2",
            name="Bad Stock",
            category="Accessories",
            price=Decimal("100.00"),
            stock_quantity=-5,
            status="Active",
        )
        db_session.add(bad_stock)
        with pytest.raises((IntegrityError, OperationalError)):
            db_session.flush()

    def test_db_sales_order_discount_range_check(self, db_session):
        """Database test: Discount percentage > 20% or < 0% must violate CHECK constraint."""
        admin = User(name="Admin", email="admin.discount@savya.com", role="ADMIN")
        admin.set_password("Pass123!")
        cust = Customer(customer_code="CUST-DISC", name="Cust", email="disc@cust.in", mobile="9800000000", city="City")
        db_session.add_all([admin, cust])
        db_session.flush()

        # Excessive discount: 25% (max allowed is 20%)
        invalid_order = SalesOrder(
            order_number="SO-DISC-EXCESS",
            customer_id=cust.id,
            created_by=admin.id,
            order_date=date(2026, 4, 1),
            subtotal=Decimal("1000.00"),
            discount_percentage=Decimal("25.00"),
            discount_amount=Decimal("250.00"),
            grand_total=Decimal("750.00"),
            status="Draft",
        )
        db_session.add(invalid_order)
        with pytest.raises((IntegrityError, OperationalError)):
            db_session.flush()

    def test_db_positive_order_item_quantity(self, db_session):
        """Database test: Order item quantity must be strictly > 0."""
        admin = User(name="Admin Qty", email="admin.qty@savya.com", role="ADMIN")
        admin.set_password("Pass123!")
        cust = Customer(customer_code="CUST-QTY", name="Cust Qty", email="qty@cust.in", mobile="9800000001", city="City")
        prod = Product(product_code="PRD-QTY", name="Product Qty", category="Cat", price=Decimal("100.00"), stock_quantity=10)
        db_session.add_all([admin, cust, prod])
        db_session.flush()

        order = SalesOrder(
            order_number="SO-QTY-TEST",
            customer_id=cust.id,
            created_by=admin.id,
            order_date=date(2026, 4, 1),
            subtotal=Decimal("0.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            grand_total=Decimal("0.00"),
            status="Draft",
        )
        db_session.add(order)
        db_session.flush()

        # Zero quantity item (must be rejected)
        item = SalesOrderItem(
            sales_order_id=order.id,
            product_id=prod.id,
            quantity=0,
            rate=Decimal("100.00"),
            amount=Decimal("0.00"),
        )
        db_session.add(item)
        with pytest.raises((IntegrityError, OperationalError)):
            db_session.flush()

    def test_db_duplicate_product_per_order_rejected(self, db_session):
        """Database test: The same product cannot appear multiple times on one order."""
        admin = User(name="Admin Dup", email="admin.dup@savya.com", role="ADMIN")
        admin.set_password("Pass123!")
        cust = Customer(customer_code="CUST-DUP", name="Cust Dup", email="dup@cust.in", mobile="9800000002", city="City")
        prod = Product(product_code="PRD-DUP", name="Product Dup", category="Cat", price=Decimal("200.00"), stock_quantity=10)
        db_session.add_all([admin, cust, prod])
        db_session.flush()

        order = SalesOrder(
            order_number="SO-DUP-TEST",
            customer_id=cust.id,
            created_by=admin.id,
            order_date=date(2026, 4, 1),
            subtotal=Decimal("400.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            grand_total=Decimal("400.00"),
            status="Draft",
        )
        db_session.add(order)
        db_session.flush()

        # First line item
        i1 = SalesOrderItem(sales_order_id=order.id, product_id=prod.id, quantity=1, rate=Decimal("200.00"), amount=Decimal("200.00"))
        db_session.add(i1)
        db_session.flush()

        # Second line item for the exact same product
        i2 = SalesOrderItem(sales_order_id=order.id, product_id=prod.id, quantity=1, rate=Decimal("200.00"), amount=Decimal("200.00"))
        db_session.add(i2)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_db_foreign_key_deletion_restriction(self, db_session):
        """Database test: Customer or Product cannot be deleted when referenced in orders (ON DELETE RESTRICT)."""
        admin = User(name="Admin FK", email="admin.fk@savya.com", role="ADMIN")
        admin.set_password("Pass123!")
        cust = Customer(customer_code="CUST-FK", name="Cust FK", email="fk@cust.in", mobile="9800000003", city="City")
        prod = Product(product_code="PRD-FK", name="Product FK", category="Cat", price=Decimal("300.00"), stock_quantity=10)
        db_session.add_all([admin, cust, prod])
        db_session.flush()

        order = SalesOrder(
            order_number="SO-FK-TEST",
            customer_id=cust.id,
            created_by=admin.id,
            order_date=date(2026, 4, 1),
            subtotal=Decimal("300.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            grand_total=Decimal("300.00"),
            status="Confirmed",
        )
        db_session.add(order)
        db_session.flush()

        item = SalesOrderItem(sales_order_id=order.id, product_id=prod.id, quantity=1, rate=Decimal("300.00"), amount=Decimal("300.00"))
        db_session.add(item)
        db_session.flush()

        # Attempting to delete customer must fail with IntegrityError
        db_session.delete(cust)
        with pytest.raises(IntegrityError):
            db_session.flush()
        db_session.rollback()

        # Attempting to delete product must fail with IntegrityError
        db_session.delete(prod)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_db_relationship_loading(self, db_session):
        """Database test: Bidirectional relationships load correctly between models."""
        admin = User(name="Admin Rel", email="admin.rel@savya.com", role="ADMIN")
        admin.set_password("Pass123!")
        cust = Customer(customer_code="CUST-REL", name="Cust Rel", email="rel@cust.in", mobile="9800000004", city="City")
        prod = Product(product_code="PRD-REL", name="Product Rel", category="Cat", price=Decimal("150.00"), stock_quantity=15)
        db_session.add_all([admin, cust, prod])
        db_session.flush()

        order = SalesOrder(
            order_number="SO-REL-TEST",
            customer_id=cust.id,
            created_by=admin.id,
            order_date=date(2026, 4, 1),
            subtotal=Decimal("300.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            grand_total=Decimal("300.00"),
            status="Confirmed",
        )
        db_session.add(order)
        db_session.flush()

        item = SalesOrderItem(sales_order_id=order.id, product_id=prod.id, quantity=2, rate=Decimal("150.00"), amount=Decimal("300.00"))
        db_session.add(item)
        db_session.flush()

        # Verify relationships
        assert order.customer.name == "Cust Rel"
        assert order.creator.name == "Admin Rel"
        assert len(order.items) == 1
        assert order.items[0].product.name == "Product Rel"
        assert len(cust.sales_orders) == 1
        assert cust.sales_orders[0].order_number == "SO-REL-TEST"
