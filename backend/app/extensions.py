"""
SavyaNT Sales Order & Inventory Management System
Backend Application Extensions Setup

Centralized module for initializing SQLAlchemy, Flask-Migrate,
Flask-JWT-Extended, and Flask-CORS.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# Database ORM instance
db = SQLAlchemy()

# Database migration engine
migrate = Migrate()

# JWT authentication manager
jwt = JWTManager()

# Cross-Origin Resource Sharing handler
cors = CORS()
