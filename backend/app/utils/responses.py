"""
SavyaNT Sales Order & Inventory Management System
Standardized API Responses and Serialization Utilities

Ensures consistent JSON response format across all backend endpoints:
{
    "success": true | false,
    "data": ...,
    "message": "...",
    "error": "...",
    "meta": { "total": 100, "page": 1, ... }
}
"""

from typing import Any
from flask import jsonify, Response


def success_response(
    data: Any = None,
    message: str | None = None,
    meta: dict[str, Any] | None = None,
    status_code: int = 200,
) -> tuple[Response, int]:
    """Generates a standardized successful API response."""
    payload: dict[str, Any] = {"success": True}
    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status_code


def error_response(
    message: str,
    error_code: str | None = None,
    details: Any = None,
    status_code: int = 400,
) -> tuple[Response, int]:
    """Generates a standardized error API response."""
    payload: dict[str, Any] = {
        "success": False,
        "error": message,
    }
    if error_code is not None:
        payload["error_code"] = error_code
    if details is not None:
        payload["details"] = details
    return jsonify(payload), status_code
