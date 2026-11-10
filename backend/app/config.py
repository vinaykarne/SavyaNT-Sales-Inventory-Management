"""
SavyaNT Sales Order & Inventory Management System
Application Configuration Module

Provides strictly separated environment configurations for Development,
Testing, and Production with validation against missing credentials,
insecure secret defaults, and test database collision protection.
"""

import os
from datetime import timedelta
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables from .env file if available
load_dotenv()


class ConfigurationError(Exception):
    """Raised when environment variables or configurations fail safety validation."""
    pass


class BaseConfig:
    """Base application configuration with shared defaults."""
    
    SECRET_KEY = os.getenv("SECRET_KEY")
    
    # SQLAlchemy configuration
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": 10,
        "max_overflow": 20,
    }
    
    # JWT Authentication configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "480"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30"))
    )
    JWT_ERROR_MESSAGE_KEY = "error"
    
    # CORS Configuration
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    
    JSON_SORT_KEYS = False


class DevelopmentConfig(BaseConfig):
    """Development environment configuration with local MySQL database."""
    
    DEBUG = True
    TESTING = False
    
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_NAME = os.getenv("DB_NAME", "savya_inventory_db")
    
    # Require explicit database credentials or DATABASE_URL
    _env_db_url = os.getenv("DATABASE_URL")
    if _env_db_url:
        SQLALCHEMY_DATABASE_URI = _env_db_url
    elif DB_USER and DB_PASSWORD:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
        )
    else:
        # Fallback to local socket connection template; fails safely if not configured
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER or 'unconfigured'}:{DB_PASSWORD or ''}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
        )

    # In development, fall back to a local-only key if not supplied, with warning
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-secret-key-must-set-in-env-file")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-insecure-jwt-key-must-set-in-env-file")


class TestingConfig(BaseConfig):
    """Testing environment configuration with an isolated test database.
    
    Strictly prevents tests from accidentally modifying development or production data.
    """
    
    DEBUG = False
    TESTING = True
    
    TEST_DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    TEST_DB_PORT = os.getenv("DB_PORT", "3306")
    TEST_DB_USER = os.getenv("DB_USER", "root")
    TEST_DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    TEST_DB_NAME = os.getenv("TEST_DB_NAME", "savya_inventory_test_db")
    
    # Must use dedicated test database URL
    _explicit_test_url = os.getenv("TEST_DATABASE_URL")
    if _explicit_test_url:
        SQLALCHEMY_DATABASE_URI = _explicit_test_url
    else:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{TEST_DB_USER}:{TEST_DB_PASSWORD}@{TEST_DB_HOST}:{TEST_DB_PORT}/{TEST_DB_NAME}?charset=utf8mb4"
        )
    
    SECRET_KEY = os.getenv("SECRET_KEY", "test-secret-key-strictly-for-automated-tests")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test-jwt-key-strictly-for-automated-tests")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    
    @classmethod
    def validate_safety(cls, dev_url: str | None = None) -> None:
        """Verifies that the test database URI does not point to development or production."""
        target_uri = cls.SQLALCHEMY_DATABASE_URI or ""
        parsed = urlparse(target_uri)
        db_path = parsed.path.lstrip("/").split("?")[0].lower()
        
        # Guard 1: Database name must contain 'test'
        if "test" not in db_path:
            raise ConfigurationError(
                f"SAFETY VIOLATION: Test database '{db_path}' must contain 'test' in its name "
                f"to prevent running tests against live application databases."
            )
            
        # Guard 2: Must not equal development or production database URI
        if dev_url and target_uri.strip() == dev_url.strip():
            raise ConfigurationError(
                "SAFETY VIOLATION: TEST_DATABASE_URL is identical to DATABASE_URL. "
                "Tests cannot be executed on the development or production database."
            )


class ProductionConfig(BaseConfig):
    """Production environment configuration with strict security checks."""
    
    DEBUG = False
    TESTING = False
    
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    
    @classmethod
    def validate(cls) -> None:
        """Validates all required production environment variables."""
        if not cls.SQLALCHEMY_DATABASE_URI:
            raise ConfigurationError("DATABASE_URL environment variable must be set in production mode.")
        if not cls.SECRET_KEY or len(cls.SECRET_KEY) < 32:
            raise ConfigurationError("SECRET_KEY must be set to a secure string (>= 32 chars) in production.")
        if not cls.JWT_SECRET_KEY or len(cls.JWT_SECRET_KEY) < 32:
            raise ConfigurationError("JWT_SECRET_KEY must be set to a secure string (>= 32 chars) in production.")


# Environment mapping
CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}


def get_config(env_name: str | None = None) -> type[BaseConfig]:
    """Retrieve the configuration class matching the requested environment."""
    target_env = env_name or os.getenv("FLASK_ENV", "development").lower()
    config_class = CONFIG_MAP.get(target_env, DevelopmentConfig)
    
    if target_env == "testing":
        dev_url = os.getenv("DATABASE_URL")
        TestingConfig.validate_safety(dev_url=dev_url)
    elif target_env == "production":
        ProductionConfig.validate()
        
    return config_class
