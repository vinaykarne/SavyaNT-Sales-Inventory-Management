"""
SavyaNT Sales Order & Inventory Management System
Concurrency-Safe Sequence Generation Utilities

Generates sequential, unique order numbers (SO-YYYY-XXXX) and stock movement codes (MOV-XXXX)
using database locks to eliminate duplicate key race conditions during concurrent requests.
"""

from datetime import datetime, timezone
import re
from sqlalchemy import func
from app.extensions import db
from app.models.sales_order import SalesOrder
from app.models.stock_movement import StockMovement


def generate_order_number() -> str:
    """Generates a sequential order number format: SO-YYYY-XXXX.
    
    Uses row-level locking or max sequence extraction within the active transaction
    to guarantee monotonic uniqueness without race conditions.
    """
    current_year = datetime.now(timezone.utc).year
    prefix = f"SO-{current_year}-"
    
    # Query highest existing order number for the current year
    highest_order = (
        db.session.query(SalesOrder.order_number)
        .filter(SalesOrder.order_number.like(f"{prefix}%"))
        .order_by(SalesOrder.id.desc())
        .with_for_update()
        .first()
    )
    
    next_seq = 1
    if highest_order and highest_order[0]:
        match = re.search(r"SO-\d{4}-(\d+)", highest_order[0])
        if match:
            next_seq = int(match.group(1)) + 1
            
    # Extra safety check against already existing number
    while True:
        candidate = f"{prefix}{next_seq:04d}"
        exists = db.session.query(SalesOrder.id).filter_by(order_number=candidate).first()
        if not exists:
            return candidate
        next_seq += 1


def generate_movement_code() -> str:
    """Generates a sequential stock movement code format: MOV-XXXX.
    
    Uses row-level locking within the active transaction to guarantee uniqueness.
    """
    highest_mov = (
        db.session.query(StockMovement.movement_code)
        .order_by(StockMovement.id.desc())
        .with_for_update()
        .first()
    )
    
    next_seq = 1
    if highest_mov and highest_mov[0]:
        match = re.search(r"MOV-(\d+)", highest_mov[0])
        if match:
            next_seq = int(match.group(1)) + 1
            
    while True:
        candidate = f"MOV-{next_seq:04d}"
        exists = db.session.query(StockMovement.id).filter_by(movement_code=candidate).first()
        if not exists:
            return candidate
        next_seq += 1


def generate_customer_code() -> str:
    """Generates a sequential customer code format: CUST-XXX."""
    from app.models.customer import Customer
    highest_cust = (
        db.session.query(Customer.customer_code)
        .order_by(Customer.id.desc())
        .with_for_update()
        .first()
    )
    
    next_seq = 1
    if highest_cust and highest_cust[0]:
        match = re.search(r"CUST-(\d+)", highest_cust[0])
        if match:
            next_seq = int(match.group(1)) + 1
            
    while True:
        candidate = f"CUST-{next_seq:03d}"
        exists = db.session.query(Customer.id).filter_by(customer_code=candidate).first()
        if not exists:
            return candidate
        next_seq += 1
