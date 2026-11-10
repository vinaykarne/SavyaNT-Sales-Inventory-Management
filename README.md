# SavyaNT Sales Order & Inventory Management System

**Technical Assessment Submission — Fresher / Trainee Software Developer Role**  
**Architecture:** Decoupled Full-Stack Web Application (Python Flask + MySQL 8.0 Backend & React 19 + TypeScript Frontend)

---

## 1. Project Overview

The **SavyaNT Sales Order & Inventory Management System** is an enterprise-grade ERP application designed for managing customers, catalog products, sales order lifecycles, and inventory movements.

### Key Functional Capabilities
- **Role-Based Access Control (RBAC):** Dedicated permissions for `ADMIN` (full CRUD, manual stock adjustments, CSV imports, user management) and `SALES` (scoped strictly to own orders, active customer and product views).
- **Exact Financial Calculations:** Independent backend calculation of line item amounts, subtotals, discount deductions (strictly constrained between 0.00% and 20.00%), and grand totals using Python's `Decimal` type to eliminate IEEE-754 binary floating-point drift.
- **Transaction-Safe Inventory Auditing:** Atomic order confirmation with deadlock-free row-level locking (`SELECT ... FOR UPDATE`), automatic stock deduction, and immediate audit logging. Order cancellation atomically restores stock with audited `Sales Return` movements.
- **Historical Price Protection:** Order items record the unit price (`rate`) at sale time, ensuring future catalog price changes never alter past order records.
- **Referential Integrity Protection:** Foreign keys use `ON DELETE RESTRICT` to protect customers and products with historical orders against accidental deletion.
- **All-or-Nothing CSV Import:** Admin product import rejects entire batches and rolls back the database transaction if any single row fails validation.

---

## 2. Technology Stack

### Backend
- **Language:** Python 3.10+
- **Web Framework:** Flask 3.x
- **ORM & Database Toolkit:** Flask-SQLAlchemy 3.x / SQLAlchemy 2.x
- **Database Driver:** PyMySQL 1.1+
- **Schema Migration Engine:** Flask-Migrate / Alembic
- **Authentication & Tokens:** Flask-JWT-Extended 4.x
- **Password Security:** Werkzeug (`scrypt` / `pbkdf2` password hashing)
- **CORS Handling:** Flask-CORS
- **Test Automation:** Pytest

### Database
- **Engine:** MySQL 8.0.16+
- **Storage Engine:** InnoDB
- **Character Set / Collation:** `utf8mb4` / `utf8mb4_unicode_ci`
- **Integrity Mechanisms:** Foreign key constraints, table-level CHECK constraints, unique indexes, row-level locking (`SELECT ... FOR UPDATE`)

### Frontend
- **Framework:** React 19
- **Language:** TypeScript 5.7+
- **Build System & Dev Server:** Vite 6+ / 8+
- **Styling:** Tailwind CSS 4.x
- **Icons:** Lucide React
- **HTTP Client:** Centralized fetch-based API client with automatic JWT token management

---

## 3. Project Folder Structure

```
├── backend/
│   ├── app/
│   │   ├── __init__.py           # Flask Application Factory & Blueprints
│   │   ├── config.py             # Config classes (Dev, Testing, Prod) & safety checks
│   │   ├── extensions.py         # SQLAlchemy, Migrate, JWT, CORS instances
│   │   ├── models/               # Six SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── customer.py
│   │   │   ├── product.py
│   │   │   ├── sales_order.py
│   │   │   ├── sales_order_item.py
│   │   │   └── stock_movement.py
│   │   ├── services/             # Domain business logic & transactions
│   │   │   ├── auth_service.py
│   │   │   ├── customer_service.py
│   │   │   ├── product_service.py
│   │   │   ├── order_service.py
│   │   │   ├── inventory_service.py
│   │   │   ├── report_service.py
│   │   │   └── csv_service.py
│   │   ├── routes/               # Modular Flask API route blueprints
│   │   │   ├── auth_routes.py
│   │   │   ├── customer_routes.py
│   │   │   ├── product_routes.py
│   │   │   ├── order_routes.py
│   │   │   ├── inventory_routes.py
│   │   │   └── report_routes.py
│   │   └── utils/                # Auth decorators, concurrency safe generators, validators
│   │       ├── auth_decorators.py
│   │       ├── concurrency.py
│   │       ├── validators.py
│   │       ├── responses.py
│   │       └── exceptions.py
│   ├── migrations/               # Alembic database migrations
│   ├── sql/                      # Safe SQL DDL, reset scripts, and analytical queries
│   │   ├── schema.sql            # Non-destructive initial creation script
│   │   ├── reset_schema.sql      # Isolated destructive reset script (for testing)
│   │   └── queries.sql           # Five required SQL queries
│   ├── tests/                    # Comprehensive pytest automated test suite
│   ├── run.py                    # Backend application startup script
│   ├── seed.py                   # Idempotent database seed script
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Backend environment template
├── src/                          # React + TypeScript Frontend
│   ├── components/               # UI components (DataTable, Modal, Navbar, Sidebar)
│   ├── context/                  # AuthContext, ToastContext
│   ├── pages/                    # Views (Dashboard, Customers, Products, Orders, etc.)
│   ├── services/                 # Centralized apiClient and API service bridges
│   ├── types/                    # TypeScript interfaces & enums
│   └── utils/                    # Calculations, formatters, validators
├── API_DOCUMENTATION.md          # Complete REST API specification
├── DEBUGGING.md                  # Detailed debugging exercise analysis
├── AI_USAGE.md                   # AI assistance transparency disclosure
├── DEMO_SCRIPT.md                # 6–8 minute interview presentation walkthrough
├── package.json                  # Frontend dependencies and scripts
└── vite.config.ts                # Vite configuration with /api backend proxy
```

---

## 4. Prerequisites (Windows Development Environment)

Before running the application on Windows, verify that the following tools are installed:

1. **Python:** Version 3.10, 3.11, or 3.12 (Check via `python --version`)
2. **Node.js:** Version 18, 20, or 22 LTS (Check via `node --version`)
3. **MySQL Server:** Version 8.0+ (Check via `mysql --version`)
4. **Git:** (Check via `git --version`)
5. **Windows PowerShell** or **Windows Terminal**

---

## 5. Step-by-Step Windows Installation & Setup Guide

### Step 5.1: Create the MySQL Database
Open PowerShell and log in to MySQL:
```powershell
mysql -u root -p
```
Run the following SQL commands to create the application database, test database, and user:
```sql
CREATE DATABASE IF NOT EXISTS savya_inventory_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS savya_inventory_test_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'savya_user'@'localhost' IDENTIFIED BY 'SavyaSecurePass2026!';
GRANT ALL PRIVILEGES ON savya_inventory_db.* TO 'savya_user'@'localhost';
GRANT ALL PRIVILEGES ON savya_inventory_test_db.* TO 'savya_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### Step 5.2: Configure Python Virtual Environment & Install Dependencies
Open a PowerShell window, navigate to the `backend` directory:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*(If PowerShell restricts script execution, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

Install all required Python packages:
```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

### Step 5.3: Configure Backend Environment Variables
Copy `.env.example` to `.env` in the `backend/` directory:
```powershell
Copy-Item .env.example .env
```
Open `backend/.env` in Notepad or VS Code and set your database credentials:
```ini
FLASK_APP=run.py
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=savya-production-random-secret-key-replace-me-1234
JWT_SECRET_KEY=savya-jwt-random-secret-key-replace-me-5678

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=savya_user
DB_PASSWORD=SavyaSecurePass2026!
DB_NAME=savya_inventory_db

DATABASE_URL=mysql+pymysql://savya_user:SavyaSecurePass2026!@127.0.0.1:3306/savya_inventory_db?charset=utf8mb4
TEST_DATABASE_URL=mysql+pymysql://savya_user:SavyaSecurePass2026!@127.0.0.1:3306/savya_inventory_test_db?charset=utf8mb4

CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

---

### Step 5.4: Run Database Migrations & Seed Sample Data
Execute Alembic migrations to apply all tables, indexes, and constraints to MySQL:
```powershell
flask db upgrade
```
*(Alternatively, you can initialize the tables using `mysql -u savya_user -p savya_inventory_db < sql\schema.sql`)*

Run the idempotent database seed script to populate demo users, customers, products, and initial stock movements:
```powershell
python seed.py
```

---

### Step 5.5: Start the Flask Backend Server
```powershell
python run.py
```
*The backend server will start at `http://127.0.0.1:5000`.* Verify health in a browser or curl:
```powershell
curl http://127.0.0.1:5000/api/health
```

---

### Step 5.6: Configure & Start the React Frontend
Open a **second PowerShell window** at the project root:
```powershell
npm install
npm run dev
```
*The frontend development server will launch at `http://localhost:3000`.*

---

## 6. Accessing the Application

Open your browser to: **`http://localhost:3000`**

### Pre-Configured Demo Credentials (Created by `seed.py`)

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@savya.com` | `Admin123` | Full CRUD, Manual Stock Adjustments, CSV Import, All Reports |
| **Sales** | `sales@savya.com` | `Sales123` | View active catalog, Create & manage own orders, Catalog browse |

*Note: You can click the one-click demo role badges on the login screen for instant credentials fill.*

---

## 7. Running Automated Tests

To run the complete automated test suite on your machine:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest -v
```

To run a specific test suite:
```powershell
pytest tests/test_orders.py -v
pytest tests/test_models.py -v
pytest tests/test_inventory.py -v
```

---

## 8. Five Required Analytical SQL Queries

A dedicated file `backend/sql/queries.sql` contains the five requested SQL queries:
1. **Total Confirmed Sales by Customer** (Aggregated gross, discount, and net revenue strictly from Confirmed orders).
2. **Top-Selling Products by Quantity** (Volume sold, revenue, and current stock on hand).
3. **Low-Stock Product Alert Report** (Identifies items `<= 10` units with inventory valuation).
4. **Monthly Confirmed Sales Totals** (Monthly recognized revenue, orders count, and average order value).
5. **Customers with No Confirmed Orders** (Prospects with zero confirmed sales for marketing re-engagement).

Execute them against your MySQL database:
```powershell
mysql -u savya_user -p savya_inventory_db < backend\sql\queries.sql
```

---

## 9. Troubleshooting Common Windows Issues

### Issue A: `Access Denied for user 'root'@'localhost'`
- **Fix:** Verify your MySQL password in `backend/.env`. If you set a root password during MySQL installation, ensure `DB_PASSWORD` matches that value.

### Issue B: `Script execution is disabled on this system` in PowerShell
- **Fix:** Run this one-time command in your PowerShell terminal:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

### Issue C: `Port 5000 already in use`
- **Fix:** If port 5000 is occupied, set `PORT=5001` in `backend/.env` and adjust the proxy target in `vite.config.ts`.

---

## 10. Handover Verification Checklist

- [x] Flask backend compiles cleanly with 0 syntax or import errors.
- [x] React frontend compiles with 0 TypeScript errors (`tsc --noEmit`).
- [x] Zero floating-point drift: all currency calculations use `Decimal` with `ROUND_HALF_UP`.
- [x] Discount percentages strictly capped between 0.00% and 20.00%.
- [x] Atomic order confirmation and cancellation with deadlock-free row locking (`with_for_update()`).
- [x] All five required SQL queries documented in `backend/sql/queries.sql`.
- [x] Debugging exercise fully analyzed in `DEBUGGING.md`.
- [x] Full API documentation provided in `API_DOCUMENTATION.md`.
- [x] AI assistance disclosed in `AI_USAGE.md`.
- [x] Realistic 6–8 minute interview demonstration script provided in `DEMO_SCRIPT.md`.
