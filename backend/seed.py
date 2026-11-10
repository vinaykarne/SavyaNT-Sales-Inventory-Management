"""
SavyaNT Sales Order & Inventory Management System
Database Seed Script

Usage:
    python seed.py

Description:
    Seeds initial development data:
    - 1 Admin user (configured via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
    - 1 Sales user (configured via SEED_SALES_EMAIL / SEED_SALES_PASSWORD)
    - Sample master customers
    - Sample products with opening warehouse inventory
    - Matching 'Opening Stock' audit records in stock_movements table

Safety Guarantees:
    - Idempotent: checks for existing records before inserting. Safe to run repeatedly.
    - Never executes automatically on app startup.
    - Never prints plaintext passwords or sensitive secrets to stdout or logs.
"""

import os
import sys
from decimal import Decimal
from datetime import datetime, timezone

from app import create_app
from app.extensions import db
from app.models import User, Customer, Product, StockMovement


def seed_database():
    """Seeds the MySQL database with initial development entities."""
    app = create_app()
    
    with app.app_context():
        print("=" * 70)
        print(" Starting SavyaNT Database Seeding Process...")
        print("=" * 70)
        
        # 1. Seed Users (Credentials read from env; never output passwords to console)
        admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@savya.com").strip().lower()
        admin_pass = os.getenv("SEED_ADMIN_PASSWORD", "AdminPassword123!")
        sales_email = os.getenv("SEED_SALES_EMAIL", "sales@savya.com").strip().lower()
        sales_pass = os.getenv("SEED_SALES_PASSWORD", "SalesPassword123!")
        
        admin_user = User.query.filter_by(email=admin_email).first()
        if not admin_user:
            admin_user = User(
                name="Admin User",
                email=admin_email,
                role="ADMIN",
                is_active=True,
            )
            admin_user.set_password(admin_pass)
            db.session.add(admin_user)
            db.session.flush()
            print(f"[+] Created Admin User: {admin_email}")
        else:
            print(f"[-] Admin User already exists: {admin_email}")

        sales_user = User.query.filter_by(email=sales_email).first()
        if not sales_user:
            sales_user = User(
                name="Sales Executive",
                email=sales_email,
                role="SALES",
                is_active=True,
            )
            sales_user.set_password(sales_pass)
            db.session.add(sales_user)
            db.session.flush()
            print(f"[+] Created Sales User: {sales_email}")
        else:
            print(f"[-] Sales User already exists: {sales_email}")

        # 2. Seed Customers
        sample_customers = [
            {
                "code": "CUST-001",
                "name": "Aarav Patel",
                "email": "aarav.patel@apextech.in",
                "mobile": "9820123456",
                "city": "Mumbai",
                "status": "Active",
            },
            {
                "code": "CUST-002",
                "name": "Priya Sundaram",
                "email": "priya.s@chennaicorp.com",
                "mobile": "9444012345",
                "city": "Chennai",
                "status": "Active",
            },
            {
                "code": "CUST-003",
                "name": "Vikram Malhotra",
                "email": "vikram@delhitraders.co.in",
                "mobile": "9811098765",
                "city": "Delhi",
                "status": "Active",
            },
            {
                "code": "CUST-004",
                "name": "Ananya Deshmukh",
                "email": "ananya.d@punedigital.org",
                "mobile": "9765432109",
                "city": "Pune",
                "status": "Active",
            },
            {
                "code": "CUST-005",
                "name": "Kavita Joshi",
                "email": "kavita.j@ahmedabadlogistics.com",
                "mobile": "9898012345",
                "city": "Ahmedabad",
                "status": "Inactive",
            },
        ]
        
        for c_data in sample_customers:
            cust = Customer.query.filter_by(customer_code=c_data["code"]).first()
            if not cust:
                cust = Customer(
                    customer_code=c_data["code"],
                    name=c_data["name"],
                    email=c_data["email"],
                    mobile=c_data["mobile"],
                    city=c_data["city"],
                    status=c_data["status"],
                )
                db.session.add(cust)
                print(f"[+] Added Customer: {c_data['code']} - {c_data['name']}")
            else:
                print(f"[-] Customer already exists: {c_data['code']}")

        db.session.flush()

        # 3. Seed Products with Opening Stock
        sample_products = [
            {
                "code": "PRD-001",
                "name": "Mechanical Gaming Keyboard",
                "category": "Accessories",
                "price": Decimal("1500.00"),
                "stock": 35,
                "status": "Active",
            },
            {
                "code": "PRD-002",
                "name": "Ergonomic Wireless Mouse",
                "category": "Accessories",
                "price": Decimal("500.00"),
                "stock": 52,
                "status": "Active",
            },
            {
                "code": "PRD-003",
                "name": "27-inch 4K IPS Monitor",
                "category": "Displays",
                "price": Decimal("24500.00"),
                "stock": 7,
                "status": "Active",
            },
            {
                "code": "PRD-004",
                "name": "Noise Cancelling Headset",
                "category": "Audio",
                "price": Decimal("3200.00"),
                "stock": 20,
                "status": "Active",
            },
            {
                "code": "PRD-005",
                "name": "1TB NVMe M.2 SSD",
                "category": "Storage",
                "price": Decimal("6800.00"),
                "stock": 25,
                "status": "Active",
            },
            {
                "code": "PRD-006",
                "name": "Bluetooth Conference Speakerphone",
                "category": "Audio",
                "price": Decimal("5400.00"),
                "stock": 0,
                "status": "Active",
            },
        ]

        # Calculate next movement code sequence dynamically to prevent collisions on repeated runs
        existing_movements = StockMovement.query.all()
        max_seq = 0
        for m in existing_movements:
            if m.movement_code and m.movement_code.startswith("MOV-"):
                try:
                    num = int(m.movement_code.split("-")[1])
                    if num > max_seq:
                        max_seq = num
                except (IndexError, ValueError):
                    pass

        mov_seq = max_seq + 1

        for p_data in sample_products:
            prod = Product.query.filter_by(product_code=p_data["code"]).first()
            if not prod:
                prod = Product(
                    product_code=p_data["code"],
                    name=p_data["name"],
                    category=p_data["category"],
                    price=p_data["price"],
                    stock_quantity=p_data["stock"],
                    status=p_data["status"],
                )
                db.session.add(prod)
                db.session.flush()
                print(f"[+] Added Product: {p_data['code']} - {p_data['name']} (Stock: {p_data['stock']})")

                # Generate Opening Stock Movement only when initial inventory > 0
                if p_data["stock"] > 0:
                    mov_code = f"MOV-{mov_seq:04d}"
                    movement = StockMovement(
                        movement_code=mov_code,
                        product_id=prod.id,
                        related_order_id=None,
                        movement_type="Opening Stock",
                        quantity_change=p_data["stock"],
                        previous_stock=0,
                        new_stock=p_data["stock"],
                        reason="Initial warehouse intake for Q1 inventory audit",
                        created_by=admin_user.id,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.session.add(movement)
                    mov_seq += 1
                    print(f"    [+] Created Stock Movement: {mov_code} (Opening Stock: +{p_data['stock']})")
            else:
                print(f"[-] Product already exists: {p_data['code']}")

        # Commit transaction
        db.session.commit()
        print("=" * 70)
        print(" Database seeding completed successfully!")
        print("=" * 70)


if __name__ == "__main__":
    try:
        seed_database()
    except Exception as exc:
        print(f"[ERROR] Seeding failed: {exc}", file=sys.stderr)
        sys.exit(1)
