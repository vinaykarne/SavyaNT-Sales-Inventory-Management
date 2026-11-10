"""
SavyaNT Sales Order & Inventory Management System
Application Runner / WSGI Entry Point

Usage:
    python run.py
"""

import os
from app import create_app

# Instantiate application using environment configuration
app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug_mode = os.getenv("FLASK_DEBUG", "1") == "1"
    
    print("=" * 70)
    print(" SavyaNT Sales Order & Inventory Management System - Flask Backend")
    print(f" Server running on: http://127.0.0.1:{port}")
    print(f" Health check URL: http://127.0.0.1:{port}/health")
    print(f" API Base URL:     http://127.0.0.1:{port}/api")
    print(f" Debug mode:       {debug_mode}")
    print("=" * 70)
    
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
