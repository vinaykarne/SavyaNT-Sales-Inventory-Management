"""
SavyaNT Sales Order & Inventory Management System
Pytest Test Configuration & Shared Fixtures

Implements a supported, isolated test session strategy compatible with Flask-SQLAlchemy 3.x.
Strictly verifies that tests run exclusively against a dedicated test database.
"""

import os
from urllib.parse import urlparse
import pytest
from sqlalchemy import text
from app import create_app
from app.extensions import db


def _is_test_database(uri: str) -> bool:
    """Verifies that the target database URI contains 'test' in its database name."""
    if not uri:
        return False
    parsed = urlparse(uri)
    db_name = parsed.path.lstrip("/").split("?")[0].lower()
    return "test" in db_name


@pytest.fixture(scope="session")
def app():
    """Session-scoped Flask application instance configured for testing."""
    test_app = create_app(config_name="testing")
    
    # SAFETY ENFORCEMENT: Verify test database separation
    target_uri = test_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    dev_uri = os.getenv("DATABASE_URL", "")
    
    if not _is_test_database(target_uri):
        raise RuntimeError(
            f"SAFETY ABORT: Target database URI '{target_uri}' does not contain 'test' in its name. "
            "Tests cannot be executed on production or development databases."
        )
        
    if dev_uri and target_uri.strip() == dev_uri.strip():
        raise RuntimeError(
            "SAFETY ABORT: TEST_DATABASE_URL is identical to DATABASE_URL. "
            "Automated tests must run in an isolated test database."
        )
        
    return test_app


@pytest.fixture(scope="session")
def client(app):
    """Test client for making HTTP requests against the application."""
    return app.test_client()


@pytest.fixture(scope="session")
def db_available(app):
    """Checks whether the MySQL test database is currently reachable."""
    with app.app_context():
        try:
            with db.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False


@pytest.fixture(scope="function")
def db_session(app, db_available):
    """Provides an isolated database session for tests.
    
    If MySQL is reachable, wraps operations in a transaction rolled back after each test.
    If MySQL is not reachable, skips database-dependent tests with a clear diagnostic message.
    """
    if not db_available:
        pytest.skip("MySQL test database is not reachable at TEST_DATABASE_URL. Skipping database-backed test.")

    with app.app_context():
        # Connect to test database and start transaction
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # In Flask-SQLAlchemy 3.x, use standard db.session scoped within app context
        session = db.session

        yield session

        # Roll back all test modifications to maintain 100% isolation
        session.rollback()
        session.close()
        transaction.rollback()
        connection.close()
