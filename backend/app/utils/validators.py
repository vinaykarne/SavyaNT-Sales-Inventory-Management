"""
SavyaNT Sales Order & Inventory Management System
Input Validation Utilities

Provides validation functions for email, mobile, currency, discounts, and order items.
"""

from decimal import Decimal, InvalidOperation
import re
from app.utils.exceptions import ValidationError

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_REGEX = re.compile(r"^\+?[0-9\s\-()]{7,20}$")


def validate_email(email: str) -> str:
    """Validates email format and returns normalized lowercase email string."""
    if not email or not isinstance(email, str):
        raise ValidationError("Email address is required.")
    email_clean = email.strip().lower()
    if not EMAIL_REGEX.match(email_clean):
        raise ValidationError("Invalid email address format.")
    return email_clean


def validate_mobile(mobile: str) -> str:
    """Validates phone number format."""
    if not mobile or not isinstance(mobile, str):
        raise ValidationError("Mobile number is required.")
    mobile_clean = mobile.strip()
    if not PHONE_REGEX.match(mobile_clean):
        raise ValidationError("Invalid mobile number format. Must contain between 7 and 20 valid phone characters.")
    return mobile_clean


def validate_decimal_amount(value: any, field_name: str = "Amount", min_val: Decimal = Decimal("0.00")) -> Decimal:
    """Converts and validates positive or non-negative decimal currency amount."""
    if value is None:
        raise ValidationError(f"{field_name} is required.")
    try:
        dec = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"{field_name} must be a valid numeric amount.")
    if dec < min_val:
        raise ValidationError(f"{field_name} cannot be less than {min_val}.")
    return dec.quantize(Decimal("0.01"))


def validate_discount_percentage(discount: any) -> Decimal:
    """Validates that discount percentage is between 0.00% and 20.00%."""
    if discount is None:
        return Decimal("0.00")
    try:
        dec = Decimal(str(discount))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Discount percentage must be a valid numeric value.")
    if dec < Decimal("0.00") or dec > Decimal("20.00"):
        raise ValidationError("Discount percentage must be strictly between 0% and 20%.")
    return dec.quantize(Decimal("0.01"))


def validate_positive_integer(value: any, field_name: str = "Quantity") -> int:
    """Validates strictly positive integer (> 0)."""
    if value is None:
        raise ValidationError(f"{field_name} is required.")
    try:
        val = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be an integer.")
    if val <= 0:
        raise ValidationError(f"{field_name} must be strictly greater than 0.")
    return val


def validate_nonnegative_integer(value: any, field_name: str = "Quantity") -> int:
    """Validates non-negative integer (>= 0)."""
    if value is None:
        return 0
    try:
        val = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be an integer.")
    if val < 0:
        raise ValidationError(f"{field_name} cannot be negative.")
    return val
