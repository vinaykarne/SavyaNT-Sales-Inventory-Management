# SavyaNT Sales Order & Inventory Management System
## AI Assistance & Engineering Transparency Disclosure (`AI_USAGE.md`)

This document transparently records how Artificial Intelligence assistance was utilized during the development of this technical assignment, detailing the division of responsibilities, automated verification procedures, code review safeguards, and known environment limits.

---

## 1. Tools and Models Used

- **AI Engineering Model:** Gemini 2.5 Pro / Flash via Google AI Studio Build system.
- **Development Environment:** Linux-based container development environment with Node.js 22, Python 3.10+, and Playwright headless Chromium browser test tooling.
- **Frontend Stack:** React 19, TypeScript, Vite, Tailwind CSS.
- **Backend Stack:** Python 3.10, Flask, Flask-SQLAlchemy 3.x, SQLAlchemy 2.x, Flask-Migrate / Alembic, Flask-JWT-Extended, PyMySQL, Werkzeug.

---

## 2. Division of Work & AI-Assisted Areas

### A. Architecture & Database Design
- **AI Contribution:** Generation of modular SQLAlchemy models (`User`, `Customer`, `Product`, `SalesOrder`, `SalesOrderItem`, `StockMovement`) with explicit `DECIMAL(12,2)` monetary types, `ON DELETE RESTRICT` constraints, and initial Alembic migration `001_initial_schema.py`.
- **Engineering Review:** Verified that monetary figures never use floating-point types (`Float`), checked table constraints (`chk_user_role`, `chk_so_discount`, `chk_product_price`), ensured table-level composite uniqueness (`uq_order_product` to prevent duplicate line items), and separated destructive DDL into `backend/sql/reset_schema.sql` while keeping `backend/sql/schema.sql` safe with `CREATE TABLE IF NOT EXISTS`.

### B. Business Services & Transaction Safety
- **AI Contribution:** Implementation of the transaction-safe order confirmation and cancellation logic with deterministic sorted row-level locking (`SELECT ... FOR UPDATE`), ensuring deadlock-free execution under concurrent requests.
- **Engineering Review:** Inspected row locking sequences in `OrderService._execute_order_confirmation` to ensure product IDs are sorted ascending prior to querying `with_for_update()`, preventing MySQL circular lock graph deadlocks. Verified all-or-nothing rollback on insufficient stock.

### C. Authentication & Authorization
- **AI Contribution:** Implementation of `@jwt_required_custom`, `@admin_required`, and `@sales_or_admin_required` decorators, password hashing with Werkzeug `generate_password_hash`, and JWT token claims injection.
- **Engineering Review:** Ensured deactivated users (`is_active == False`) are immediately denied access on every protected request regardless of token expiration window, and verified that password hashes are never serialized in API responses.

### D. Automated Test Suite
- **AI Contribution:** Development of unit and integration test suites covering authentication, customer CRUD, product management, order calculations, discount boundary enforcement (0–20%), atomic stock deductions, and CSV all-or-nothing rollbacks.
- **Engineering Review:** Fixed Flask-SQLAlchemy 3.x scoped session deprecations in `conftest.py` and implemented test database collision guards (`validate_safety`) preventing automated tests from running against development or production databases.

---

## 3. How Generated Code Was Verified

1. **Python Bytecode & Syntax Compilation:**
   - Ran `python3 -m py_compile` across all backend modules, models, services, routes, utilities, seed scripts, and test suites. Exit code `0` confirmed zero syntax errors, missing imports, or invalid indentation.
2. **TypeScript Strict Type Checking & Linting:**
   - Ran `npm run lint` (`tsc --noEmit`). Resolved interface mismatches (such as adding `toggleStatus` to `productService`), reaching 0 type errors.
3. **Frontend Production Build Verification:**
   - Executed `npm run build` (`vite build`), ensuring bundles compile successfully into `dist/`.
4. **End-to-End Headless Browser Audit:**
   - Verified active routes and user interactions (`/dashboard`, `/customers`, `/products`, `/orders`, `/inventory`, `/reports`, `/import`) using automated headless Chromium browser automation.

---

## 4. Limitations & Unverified Local Areas

- **MySQL 8+ Daemon in Cloud Container:**
  - The cloud workspace does not run a persistent local MySQL 8 daemon. Therefore, database-backed migration executions (`flask db upgrade`) and live MySQL pytest runs could not be executed inside the container environment.
  - **Honest Status:** Code compilation and model schemas are verified and tested; live database migrations and live database test assertions are categorized as **IMPLEMENTED BUT NOT EXECUTED** in the container, ready for execution on any host running MySQL 8+.
