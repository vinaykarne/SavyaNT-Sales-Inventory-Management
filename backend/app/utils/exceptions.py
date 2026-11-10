"""
SavyaNT Sales Order & Inventory Management System
Custom Exception Classes for Domain Business Logic
"""

class AppException(Exception):
    """Base application exception with status code and error details."""
    status_code: int = 400
    error_code: str = "APP_ERROR"

    def __init__(self, message: str, status_code: int | None = None, details: any = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.details = details


class ValidationError(AppException):
    """Raised when client input data violates validation rules."""
    status_code = 400
    error_code = "VALIDATION_ERROR"


class AuthenticationError(AppException):
    """Raised when user credentials are invalid or missing."""
    status_code = 401
    error_code = "AUTHENTICATION_FAILED"


class PermissionDeniedError(AppException):
    """Raised when user role or ownership prohibits resource access."""
    status_code = 403
    error_code = "PERMISSION_DENIED"


class ResourceNotFoundError(AppException):
    """Raised when requested database record does not exist."""
    status_code = 404
    error_code = "RESOURCE_NOT_FOUND"


class BusinessConflictError(AppException):
    """Raised when requested operation conflicts with current state."""
    status_code = 409
    error_code = "BUSINESS_CONFLICT"


class InsufficientStockError(AppException):
    """Raised when an order confirmation cannot be completed due to insufficient stock."""
    status_code = 409
    error_code = "INSUFFICIENT_STOCK"
