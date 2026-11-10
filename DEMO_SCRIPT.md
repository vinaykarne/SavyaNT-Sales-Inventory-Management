# SavyaNT Sales Order & Inventory Management System
## Technical Interview Demonstration Script (`DEMO_SCRIPT.md`)

**Total Target Duration:** 6 – 8 Minutes  
**Target Audience:** Technical Hiring Manager / Senior Engineering Evaluators  
**Role:** Fresher / Trainee Software Developer Technical Assessment  

---

## Equipment & Environment Preparation
- **Terminal 1:** Running Python Flask Backend (`python run.py`) on `http://127.0.0.1:5000`
- **Terminal 2:** Running React + Vite Frontend (`npm run dev`) on `http://localhost:3000`
- **Browser:** Chrome/Edge opened at `http://localhost:3000`
- **Database Client (Optional):** MySQL Workbench / DBeaver open to `savya_inventory_db`

---

## Walkthrough Breakdown

### Step 1: Project Introduction & High-Level Architecture (0:00 – 1:00)
- **Spoken Narration:**
  > *"Good morning/afternoon. Today I am presenting my technical assignment: the SavyaNT Sales Order and Inventory Management System. The application is built using a clean, decoupled architecture: a modern React 19 and TypeScript frontend styled with Tailwind CSS, communicating with a production-grade Python Flask REST API backed by MySQL 8.0 with InnoDB tables.
  >
  > Key architectural highlights include strict role-based access control (Admin vs Sales), Decimal financial precision with zero floating-point drift, and transaction-safe inventory movements with deadlock-free row locking."*
- **Visual Action:**
  - Show the browser at the login page (`/login`).
  - Briefly show the project folder structure in VS Code (`/backend` with models, services, routes, migrations, and `/src` with React components and API services).

---

### Step 2: Authentication & Role-Based Access Control (1:00 – 1:45)
- **Spoken Narration:**
  > *"Let's begin with authentication. The system supports two distinct roles: Administrator and Sales User. Passwords are never stored in plaintext; they are hashed using Werkzeug's secure scrypt algorithm, and sessions are governed by JSON Web Tokens.
  >
  > I'll first log in using the Admin credentials: `admin@savya.com`."*
- **Visual Action:**
  - Click the **Admin Role** one-click demo badge or enter `admin@savya.com` / `Admin123`.
  - Click **Sign In to Dashboard**.
  - Land on `/dashboard`. Point out the live stat cards (Total Customers, Total Products, Confirmed Sales, Low Stock Alerts).

---

### Step 3: Customer Management & Referential Integrity (1:45 – 2:30)
- **Spoken Narration:**
  > *"Under the Customers module, Administrators have full CRUD capabilities. Every customer requires a unique email and mobile number.
  >
  > Notice that referential integrity is strictly enforced at the database level using `ON DELETE RESTRICT`. If an Admin attempts to delete a customer who has existing sales orders, the backend blocks the operation with a 409 Conflict, recommending that their status be set to Inactive instead to safeguard historical audit trails."*
- **Visual Action:**
  - Navigate to **Customers** (`/customers`).
  - Click **Add Customer**, enter name `"Reliance Retail"`, email `"contact@relianceretail.in"`, city `"Mumbai"`. Click **Save Customer**.
  - Show the newly added customer appearing in the list with generated code `CUST-009`.
  - Attempt to click **Delete** on a customer with existing orders (`Apex Technologies India`). Show the error toast: *"Cannot delete customer: Referenced by existing sales orders. Please mark as Inactive instead."*

---

### Step 4: Product Catalog & Opening Stock Auditing (2:30 – 3:30)
- **Spoken Narration:**
  > *"Now let's examine Product Management. All prices use MySQL `DECIMAL(12,2)` rather than floating-point numbers.
  >
  > A critical invariant enforced by our Python backend is that ordinary product editing can never silently modify stock on hand. When a product is created with initial inventory, the system atomically records an 'Opening Stock' movement in the audit ledger. Subsequent stock adjustments must proceed through the dedicated Inventory Adjustment service."*
- **Visual Action:**
  - Navigate to **Products** (`/products`).
  - Filter by category `"Peripherals"`.
  - Click **Add Product**: code `PRD-301`, name `Mechanical Numpad`, price `₹1,999.00`, stock `25`. Save product.
  - Navigate to **Inventory** (`/inventory`) and show the newly logged **Opening Stock** movement for `PRD-301` with `+25` units.

---

### Step 5: Multi-Item Sales Order & Discount Validation (3:30 – 4:45)
- **Spoken Narration:**
  > *"Next, let's create a multi-item Sales Order. The frontend provides real-time calculated estimates, but the Flask backend independently calculates all financial totals using Python's `Decimal` class with `ROUND_HALF_UP` currency rounding:
  > - Each line amount is quantity times rate.
  > - Subtotal is the sum of line amounts.
  > - Discount percentage is constrained from 0% to 20%. If an order submits 25%, the backend rejects it.
  > - Grand total equals subtotal minus discount.
  >
  > We also lock in the sale-time rate on each `SalesOrderItem` row so that future catalog price updates never alter past orders."*
- **Visual Action:**
  - Navigate to **Orders** (`/orders`) -> Click **Create New Order** (`/orders/create`).
  - Select customer `"Apex Technologies India"`.
  - Add Line Item 1: `Mechanical Keyboard` (Qty: 2).
  - Add Line Item 2: `Wireless Ergonomic Mouse` (Qty: 3).
  - Set Discount to `10.0%`.
  - Point out Subtotal, 10% Discount Amount, and Grand Total.
  - Click **Save as Draft**.
  - Show the order saved with status **Draft** (Order Number `SO-2026-XXXX`).
  - Verify that product stock has **NOT** changed because the order is still a Draft.

---

### Step 6: Atomic Order Confirmation & Concurrency-Safe Stock Deduction (4:45 – 5:45)
- **Spoken Narration:**
  > *"Now we demonstrate the core transaction requirement: Atomic Confirmation.
  > When confirming an order:
  > 1. The database starts a transaction and acquires row-level locks on the order and product rows using MySQL `SELECT ... FOR UPDATE`.
  > 2. Products are locked in ascending ID order to eliminate circular lock deadlock risks under high concurrency.
  > 3. The backend checks available stock for every line item. If even one product has insufficient stock, the entire confirmation rolls back—zero partial deductions.
  > 4. If all items have sufficient stock, quantities are deducted, 'Sales Deduction' movements are created, and order status becomes Confirmed."*
- **Visual Action:**
  - Click **Confirm Order** on the Draft order. Confirm in modal.
  - Notice status immediately updates to **Confirmed** with green badge.
  - Navigate to **Inventory** (`/inventory`): show the stock of both items reduced by 2 and 3 units respectively, with audited **Sales Deduction** records referencing the Order Number.

---

### Step 7: Order Cancellation & Atomic Stock Restoration (5:45 – 6:30)
- **Spoken Narration:**
  > *"What happens if a customer cancels a confirmed order?
  > In the Orders view, we click Cancel Order. The backend starts a transaction, locks the affected product records, restores the exact deducted inventory back to the products, and creates matching 'Sales Return' stock movements.
  > Cancelled orders can never be confirmed again, ensuring strict idempotency."*
- **Visual Action:**
  - Go to **Orders** -> Click **Cancel Order** on the confirmed order. Provide reason: `"Client project postponed"`.
  - Order status changes to **Cancelled**.
  - Open **Inventory** -> Point out the **Sales Return** movements and verify that product stock was restored to its original quantity.

---

### Step 8: Bulk CSV Product Import & All-or-Nothing Rollback (6:30 – 7:15)
- **Spoken Narration:**
  > *"For bulk operations, Administrators have access to CSV Import. The specification requires strict all-or-nothing transactional integrity:
  > If a CSV file has 100 valid rows and 1 invalid row—such as a negative price or duplicate code—the backend rejects the entire batch and imports zero rows, reporting specific row errors."*
- **Visual Action:**
  - Navigate to **CSV Import** (`/import`).
  - Click **Download Invalid Sample CSV** to demonstrate error catching. Upload it: show the detailed error breakdown (Negative price on Row 3, duplicate code on Row 2).
  - Click **Download Valid Sample CSV** and upload it: show all rows passing validation. Click **Commit Import**: all rows imported with Opening Stock records created.

---

### Step 9: Analytics Reports & SQL Verification (7:15 – 7:45)
- **Spoken Narration:**
  > *"Under Reports, our dashboard provides real aggregate metrics. Notice that total revenue only counts Confirmed sales, excluding Draft and Cancelled orders.
  > We have also provided the five required SQL queries in `backend/sql/queries.sql` covering customer revenue rankings, top products by volume, low-stock reorder triggers, and monthly sales trends."*
- **Visual Action:**
  - Navigate to **Reports** (`/reports`): show Sales Summary, Customer Spending Leaderboard, and Low Stock Reorder reports.

---

### Step 10: Conclusion & Automated Tests (7:45 – 8:15)
- **Spoken Narration:**
  > *"To conclude, the application is backed by comprehensive automated test suites covering authentication, model constraints, order financial calculations, discount range capping, and CSV rollbacks.
  >
  > All source code, setup scripts, PowerShell commands, and documentation are prepared in the repository for Windows handover. Thank you, and I look forward to your questions."*
- **Visual Action:**
  - Briefly switch to terminal and show `README.md` and test files. Offer to answer questions.
