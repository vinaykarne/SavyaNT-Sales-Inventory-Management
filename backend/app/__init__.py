"""
SavyaNT Sales Order & Inventory Management System
Application Factory Module

Creates and configures the Flask application, initializes extensions,
configures CORS and JWT handlers, registers centralized error handlers,
and exposes the health check endpoint.
"""

import logging
from datetime import datetime, timezone
from flask import Flask, jsonify
from sqlalchemy import text
from werkzeug.exceptions import HTTPException

from app.config import get_config
from app.extensions import db, migrate, jwt, cors
from app.utils.exceptions import AppException
from app.utils.responses import error_response, success_response


def create_app(config_name: str | None = None) -> Flask:
    """Application factory for SavyaNT Sales Order & Inventory Backend."""
    app = Flask(__name__)
    
    # Load configuration
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    
    # Configure logging
    log_level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s in %(module)s: %(message)s"
    )
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # Initialize CORS for frontend integration
    cors_origins = app.config.get("CORS_ORIGINS", ["*"])
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    )
    
    # Import models to ensure registration with SQLAlchemy metadata
    with app.app_context():
        import app.models  # noqa: F401

    # Register error handlers
    register_error_handlers(app)
    
    # Register core health-check endpoints
    register_health_routes(app)

    # Register API blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.customer_routes import customer_bp
    from app.routes.product_routes import product_bp
    from app.routes.order_routes import order_bp
    from app.routes.inventory_routes import inventory_bp
    from app.routes.report_routes import report_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(customer_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(report_bp)
    
    return app


def register_health_routes(app: Flask) -> None:
    """Exposes health check endpoints at /health and /api/health."""
    
    def health_check():
        db_connected = False
        
        # Test database connectivity
        try:
            db.session.execute(text("SELECT 1"))
            db_connected = True
        except Exception:
            # Detailed exception logged strictly server-side, never returned to client
            app.logger.error("Database health check probe failed", exc_info=True)
            db_connected = False
            
        status_code = 200 if db_connected else 503
        
        response_data = {
            "status": "healthy" if db_connected else "degraded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "SavyaNT Sales Order & Inventory Backend",
            "environment": app.config.get("FLASK_ENV", "development"),
            "database": {
                "status": "connected" if db_connected else "unavailable",
            },
        }
        
        return success_response(
            data=response_data,
            message="Service is operational" if db_connected else "Database service is temporarily unavailable",
            status_code=status_code,
        )

    app.add_url_rule("/health", "health_root", health_check, methods=["GET"])
    app.add_url_rule("/api/health", "health_api", health_check, methods=["GET"])


def register_error_handlers(app: Flask) -> None:
    """Centralized error handling for clean JSON responses and security."""
    
    @app.errorhandler(AppException)
    def handle_app_exception(err: AppException):
        return error_response(
            message=err.message,
            error_code=err.error_code,
            details=err.details,
            status_code=err.status_code,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        return error_response(
            message=err.description,
            error_code=f"HTTP_{err.code}",
            status_code=err.code or 500,
        )

    @app.errorhandler(404)
    def handle_not_found(err):
        return error_response(
            message="Requested API endpoint or resource was not found.",
            error_code="NOT_FOUND",
            status_code=404,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(err: Exception):
        app.logger.exception(f"Unhandled server error: {err}")
        # Never expose raw stack traces or internal secrets to clients
        return error_response(
            message="An unexpected server error occurred. Please contact the system administrator.",
            error_code="INTERNAL_SERVER_ERROR",
            status_code=500,
        )
        
    # JWT Custom Error Responses
    @jwt.unauthorized_loader
    def custom_unauthorized_response(callback):
        return error_response(
            message="Missing Authorization Header. Please include Bearer token.",
            error_code="UNAUTHORIZED",
            status_code=401,
        )

    @jwt.invalid_token_loader
    def custom_invalid_token_response(callback):
        return error_response(
            message="Invalid authentication token provided.",
            error_code="INVALID_TOKEN",
            status_code=401,
        )

    @jwt.expired_token_loader
    def custom_expired_token_response(jwt_header, jwt_payload):
        return error_response(
            message="Authentication token has expired. Please log in again.",
            error_code="TOKEN_EXPIRED",
            status_code=401,
        )
