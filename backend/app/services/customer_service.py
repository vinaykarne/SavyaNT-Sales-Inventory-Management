"""
SavyaNT Sales Order & Inventory Management System
Customer Business Service

Handles customer records, uniqueness constraints, search filtering, pagination,
and referential integrity enforcement on deletion.
"""

from sqlalchemy import or_
from app.extensions import db
from app.models.customer import Customer
from app.models.sales_order import SalesOrder
from app.utils.concurrency import generate_customer_code
from app.utils.exceptions import (
    BusinessConflictError,
    ResourceNotFoundError,
    ValidationError,
)
from app.utils.validators import validate_email, validate_mobile


class CustomerService:
    """Manages customer lifecycle and constraints."""

    @staticmethod
    def list_customers(
        page: int = 1,
        per_page: int = 10,
        search: str | None = None,
        status: str | None = None,
    ) -> tuple[list[dict], dict]:
        """Lists customers with optional search filtering and pagination."""
        query = Customer.query
        
        if status and status.lower() != "all":
            query = query.filter(Customer.status == status)
            
        if search:
            search_term = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    Customer.name.ilike(search_term),
                    Customer.customer_code.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.city.ilike(search_term),
                    Customer.mobile.ilike(search_term),
                )
            )
            
        query = query.order_by(Customer.created_at.desc(), Customer.id.desc())
        
        # Paginate results
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        items = [c.to_dict() for c in paginated.items]
        
        meta = {
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "pages": paginated.pages,
        }
        return items, meta

    @staticmethod
    def get_all_active() -> list[dict]:
        """Returns all active customers without pagination for order creation dropdowns."""
        customers = Customer.query.filter_by(status="Active").order_by(Customer.name.asc()).all()
        return [c.to_dict() for c in customers]

    @staticmethod
    def get_by_id_or_code(identifier: str | int) -> Customer:
        """Finds a customer by either their database integer ID or string customer_code."""
        customer = None
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            customer = Customer.query.get(int(identifier))
        if not customer and isinstance(identifier, str):
            customer = Customer.query.filter_by(customer_code=identifier.strip()).first()
        if not customer:
            raise ResourceNotFoundError(f"Customer '{identifier}' was not found.")
        return customer

    @staticmethod
    def create_customer(data: dict) -> dict:
        """Creates a new customer with validation and duplicate prevention."""
        name = data.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            raise ValidationError("Customer name is required.")
            
        email = validate_email(data.get("email"))
        mobile = validate_mobile(data.get("mobile"))
        city = (data.get("city") or "").strip()
        if not city:
            raise ValidationError("City is required.")
            
        status = data.get("status", "Active")
        if status not in ("Active", "Inactive"):
            raise ValidationError("Status must be either 'Active' or 'Inactive'.")
            
        # Check unique email constraint
        existing_email = Customer.query.filter_by(email=email).first()
        if existing_email:
            raise BusinessConflictError(f"A customer with email '{email}' already exists.")
            
        customer_code = data.get("customer_code") or data.get("customerCode")
        if not customer_code:
            customer_code = generate_customer_code()
        else:
            customer_code = customer_code.strip()
            existing_code = Customer.query.filter_by(customer_code=customer_code).first()
            if existing_code:
                raise BusinessConflictError(f"Customer code '{customer_code}' is already in use.")

        new_customer = Customer(
            customer_code=customer_code,
            name=name.strip(),
            email=email,
            mobile=mobile,
            city=city,
            status=status,
        )
        
        db.session.add(new_customer)
        db.session.commit()
        return new_customer.to_dict()

    @staticmethod
    def update_customer(identifier: str | int, data: dict) -> dict:
        """Updates an existing customer record."""
        customer = CustomerService.get_by_id_or_code(identifier)
        
        if "name" in data:
            name = data.get("name")
            if not name or not name.strip():
                raise ValidationError("Customer name cannot be empty.")
            customer.name = name.strip()
            
        if "email" in data:
            email = validate_email(data.get("email"))
            if email != customer.email:
                conflict = Customer.query.filter_by(email=email).first()
                if conflict and conflict.id != customer.id:
                    raise BusinessConflictError(f"A customer with email '{email}' already exists.")
                customer.email = email
                
        if "mobile" in data:
            customer.mobile = validate_mobile(data.get("mobile"))
            
        if "city" in data:
            city = (data.get("city") or "").strip()
            if not city:
                raise ValidationError("City cannot be empty.")
            customer.city = city
            
        if "status" in data:
            status = data.get("status")
            if status not in ("Active", "Inactive"):
                raise ValidationError("Status must be either 'Active' or 'Inactive'.")
            customer.status = status

        db.session.commit()
        return customer.to_dict()

    @staticmethod
    def delete_customer(identifier: str | int) -> None:
        """Deletes a customer safely, blocking deletion if referenced in sales orders."""
        customer = CustomerService.get_by_id_or_code(identifier)
        
        # Enforce ON DELETE RESTRICT business check
        order_count = SalesOrder.query.filter_by(customer_id=customer.id).count()
        if order_count > 0:
            raise BusinessConflictError(
                f"Cannot delete customer '{customer.name}' ({customer.customer_code}): "
                f"Referenced by {order_count} existing sales order(s). "
                "You may change their status to 'Inactive' instead to preserve historical records."
            )
            
        db.session.delete(customer)
        db.session.commit()

    @staticmethod
    def toggle_status(identifier: str | int) -> dict:
        """Toggles a customer's active status."""
        customer = CustomerService.get_by_id_or_code(identifier)
        customer.status = "Inactive" if customer.status == "Active" else "Active"
        db.session.commit()
        return customer.to_dict()
