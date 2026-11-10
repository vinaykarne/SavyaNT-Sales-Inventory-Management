# SavyaNT Sales Order & Inventory Management System
## REST API Specification & Endpoint Documentation

**Base URL:** `http://localhost:5000/api`  
**Authentication Scheme:** `Bearer <JWT_TOKEN>` in `Authorization` header  
**Content-Type:** `application/json` (or `multipart/form-data` for CSV import)  

---

## Standard Response Structure

### Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable operation status",
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "pages": 5
  }
}
```

### Error Response (`400`, `401`, `403`, `404`, `409`, `500`)
```json
{
  "success": false,
  "error": "Descriptive error message explaining the rejection",
  "error_code": "INSUFFICIENT_STOCK",
  "details": [ ... ]
}
```

---

## 1. Authentication Endpoints

### 1.1 User Login
- **Endpoint:** `POST /api/auth/login`
- **Auth Required:** No
- **Allowed Roles:** Public
- **Request Body:**
```json
{
  "email": "admin@savya.com",
  "password": "AdminPassword123!"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "1",
      "name": "System Administrator",
      "email": "admin@savya.com",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  },
  "message": "Authentication successful."
}
```
- **Error Response (`401 Unauthorized`):**
```json
{
  "success": false,
  "error": "Invalid email or password. Please verify your credentials.",
  "error_code": "AUTHENTICATION_FAILED"
}
```

### 1.2 Get Current User Profile
- **Endpoint:** `GET /api/auth/me`
- **Auth Required:** Yes (JWT)
- **Allowed Roles:** `ADMIN`, `SALES`
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "name": "System Administrator",
      "email": "admin@savya.com",
      "role": "ADMIN",
      "isActive": true
    }
  },
  "message": "User profile retrieved."
}
```

### 1.3 User Logout
- **Endpoint:** `POST /api/auth/logout`
- **Auth Required:** Yes (JWT)
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

## 2. Customer Endpoints

### 2.1 List Customers
- **Endpoint:** `GET /api/customers`
- **Query Params:** `page` (default 1), `per_page` (default 50), `search`, `status` (`Active` | `Inactive` | `All`)
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN`, `SALES`
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "CUST-001",
      "customerCode": "CUST-001",
      "name": "Apex Technologies India",
      "email": "aarav@apextech.in",
      "mobile": "9820123456",
      "city": "Mumbai",
      "status": "Active",
      "createdAt": "2026-02-15T10:00:00Z"
    }
  ],
  "meta": { "total": 8, "page": 1, "per_page": 50, "pages": 1 }
}
```

### 2.2 Create Customer
- **Endpoint:** `POST /api/customers`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` only
- **Request Body:**
```json
{
  "name": "Zenith Cloud Solutions",
  "email": "billing@zenithcloud.in",
  "mobile": "9819998877",
  "city": "Bengaluru",
  "status": "Active"
}
```
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": "CUST-009",
    "customerCode": "CUST-009",
    "name": "Zenith Cloud Solutions",
    "email": "billing@zenithcloud.in",
    "mobile": "9819998877",
    "city": "Bengaluru",
    "status": "Active"
  },
  "message": "Customer created successfully."
}
```
- **Error Response (`409 Conflict`):**
```json
{
  "success": false,
  "error": "A customer with email 'billing@zenithcloud.in' already exists.",
  "error_code": "BUSINESS_CONFLICT"
}
```

### 2.3 Delete Customer
- **Endpoint:** `DELETE /api/customers/:id`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` only
- **Behavior:** Enforces `ON DELETE RESTRICT`. Rejects deletion if referenced by any sales order.
- **Error Response if Ordered (`409 Conflict`):**
```json
{
  "success": false,
  "error": "Cannot delete customer 'Apex Technologies India' (CUST-001): Referenced by 3 existing sales order(s). You may change their status to 'Inactive' instead.",
  "error_code": "BUSINESS_CONFLICT"
}
```

---

## 3. Product & CSV Import Endpoints

### 3.1 List Products
- **Endpoint:** `GET /api/products`
- **Query Params:** `page`, `per_page`, `search`, `category`, `status`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN`, `SALES`

### 3.2 Create Product
- **Endpoint:** `POST /api/products`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` only
- **Invariants:** Price must be `DECIMAL(12,2) >= 0.00`. Stock must be non-negative integer. If initial `stock_quantity > 0`, atomically generates an `Opening Stock` movement.
- **Request Body:**
```json
{
  "product_code": "PRD-201",
  "name": "4K Ultra-Wide Monitor",
  "category": "Displays",
  "price": "34999.00",
  "stock_quantity": 15,
  "status": "Active"
}
```
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "productCode": "PRD-201",
    "name": "4K Ultra-Wide Monitor",
    "category": "Displays",
    "price": 34999.00,
    "stockQuantity": 15,
    "status": "Active"
  },
  "message": "Product created successfully."
}
```

### 3.3 Update Product
- **Endpoint:** `PUT /api/products/:id`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` only
- **Invariant:** Direct modification of stock via PUT is strictly rejected. Stock adjustments must use `/api/inventory/adjust`.

### 3.4 CSV Bulk Import
- **Endpoint:** `POST /api/products/import`
- **Content-Type:** `multipart/form-data` (file parameter: `file`)
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` only
- **Semantics:** Strict all-or-nothing transactional import. If any single row has an error, duplicate code, or invalid value, zero rows are imported and descriptive error details are returned.
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "importedCount": 5,
    "products": [ ... ]
  },
  "message": "Successfully imported 5 products."
}
```

---

## 4. Sales Order Endpoints

### 4.1 Create Sales Order
- **Endpoint:** `POST /api/orders`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN`, `SALES`
- **Financial Rule:** Backend calculates `line_amount = quantity * rate`, `subtotal = sum(line_amount)`, `discount_amount = subtotal * (discount_percentage / 100)`, `grand_total = subtotal - discount_amount` using `Decimal(12,2)`. Discount is strictly constrained from 0.00% to 20.00%.
- **Request Body:**
```json
{
  "customerId": 1,
  "orderDate": "2026-04-10",
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 5 }
  ],
  "discountPercentage": 10.0,
  "status": "Draft",
  "notes": "Q2 Bulk procurement"
}
```
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "orderNumber": "SO-2026-0001",
    "customerId": "1",
    "customerName": "Apex Technologies India",
    "orderDate": "2026-04-10",
    "subtotal": 12500.00,
    "discountPercentage": 10.00,
    "discountAmount": 1250.00,
    "grandTotal": 11250.00,
    "status": "Draft",
    "items": [ ... ]
  }
}
```

### 4.2 Confirm Sales Order (Atomic Stock Deduction)
- **Endpoint:** `POST /api/orders/:id/confirm`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` (all orders), `SALES` (only own created orders)
- **Concurrency & Deadlock Prevention:**
  1. Row lock on `sales_orders` row (`with_for_update()`).
  2. Acquires row locks on `products` rows in ascending product ID order.
  3. Verifies `order.status == 'Draft'`.
  4. Verifies sufficient stock for every product line item.
  5. Atomically deducts stock quantities.
  6. Creates `Sales Deduction` stock movements.
  7. Updates `status = 'Confirmed'` and records `confirmed_at`.
- **Error Response on Shortage (`409 Conflict`):**
```json
{
  "success": false,
  "error": "Insufficient stock for 'Mechanical Keyboard' (PRD-001). Available: 2, Required: 5. Confirmation aborted; zero stock has been deducted.",
  "error_code": "INSUFFICIENT_STOCK"
}
```

### 4.3 Cancel Sales Order (Atomic Stock Restoration)
- **Endpoint:** `POST /api/orders/:id/cancel`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN`, `SALES` (only own orders)
- **Behavior:**
  - If order was `Draft`: Marks status `Cancelled`; zero inventory changes.
  - If order was `Confirmed`: Locks product rows, restores exact item quantities to inventory, and writes `Sales Return` stock movement audit entries.
  - If order was already `Cancelled`: Rejects duplicate cancellation.

---

## 5. Inventory Endpoints

### 5.1 Inventory Overview
- **Endpoint:** `GET /api/inventory`
- **Auth Required:** Yes
- **Returns:** Current stock on hand, valuation (`price * stock_quantity`), low-stock indicators.

### 5.2 Stock Movements Audit Log
- **Endpoint:** `GET /api/inventory/movements`
- **Query Params:** `product_id`, `movement_type`, `date_from`, `date_to`, `page`, `per_page`
- **Returns:** Audited stock movements (`Opening Stock`, `Stock Increase`, `Stock Decrease`, `Sales Deduction`, `Sales Return`) with previous stock, quantity change, new stock, and creator.

### 5.3 Manual Stock Adjustment
- **Endpoint:** `POST /api/inventory/adjust`
- **Auth Required:** Yes
- **Allowed Roles:** `ADMIN` only
- **Request Body:**
```json
{
  "productId": 1,
  "movementType": "Stock Increase",
  "quantity": 25,
  "reason": "Restocked from vendor shipment PO-8842"
}
```

---

## 6. Reports & Dashboard Endpoints

### 6.1 Dashboard Summary
- **Endpoint:** `GET /api/dashboard/summary`
- **Returns:** Real aggregated counts (`totalCustomers`, `totalProducts`, `totalOrders`, `confirmedOrders`, `totalRevenue`, `lowStockCount`, `recentOrders`). Note: Revenue strictly counts Confirmed orders.

### 6.2 Sales Report
- **Endpoint:** `GET /api/reports/sales`
- **Query Params:** `date_from`, `date_to`
- **Returns:** Daily gross subtotals, discounts given, and net recognized revenue.

### 6.3 Top Products
- **Endpoint:** `GET /api/reports/top-products?limit=10`
- **Returns:** Products ranked by units sold and revenue from confirmed sales.
