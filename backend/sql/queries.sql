-- ==============================================================================
-- SavyaNT Sales Order & Inventory Management System
-- Five Required Analytical & Operational SQL Queries for MySQL 8.0+
-- Matches schema: users, customers, products, sales_orders, sales_order_items, stock_movements
-- ==============================================================================

USE `savya_inventory_db`;

-- ------------------------------------------------------------------------------
-- QUERY 1: Total Confirmed Sales by Customer
-- Business Purpose: Ranks customers by cumulative revenue generated from completed
-- (Confirmed) sales orders. Ignores Draft and Cancelled orders to prevent misleading totals.
-- ------------------------------------------------------------------------------
SELECT 
    c.id AS customer_id,
    c.customer_code,
    c.name AS customer_name,
    c.email AS customer_email,
    c.city,
    COUNT(so.id) AS total_confirmed_orders,
    COALESCE(SUM(so.subtotal), 0.00) AS gross_subtotal,
    COALESCE(SUM(so.discount_amount), 0.00) AS total_discounts_given,
    COALESCE(SUM(so.grand_total), 0.00) AS total_confirmed_sales
FROM customers c
INNER JOIN sales_orders so 
    ON c.id = so.customer_id
WHERE so.status = 'Confirmed'
GROUP BY 
    c.id, c.customer_code, c.name, c.email, c.city
ORDER BY 
    total_confirmed_sales DESC,
    total_confirmed_orders DESC;


-- ------------------------------------------------------------------------------
-- QUERY 2: Top-Selling Products by Quantity
-- Business Purpose: Identifies high-velocity inventory by aggregating unit sales
-- across confirmed order line items, along with generated revenue and current stock.
-- ------------------------------------------------------------------------------
SELECT 
    p.id AS product_id,
    p.product_code,
    p.name AS product_name,
    p.category,
    p.price AS current_unit_price,
    p.stock_quantity AS current_stock_on_hand,
    COALESCE(SUM(soi.quantity), 0) AS total_units_sold,
    COALESCE(SUM(soi.amount), 0.00) AS total_sales_revenue,
    COUNT(DISTINCT so.id) AS order_appearances_count
FROM products p
INNER JOIN sales_order_items soi 
    ON p.id = soi.product_id
INNER JOIN sales_orders so 
    ON soi.sales_order_id = so.id
WHERE so.status = 'Confirmed'
GROUP BY 
    p.id, p.product_code, p.name, p.category, p.price, p.stock_quantity
ORDER BY 
    total_units_sold DESC,
    total_sales_revenue DESC;


-- ------------------------------------------------------------------------------
-- QUERY 3: Low-Stock Product Report
-- Business Purpose: Generates an urgent restocking alert report for active products
-- whose on-hand quantity has fallen to or below the reorder threshold (e.g., 10 units),
-- calculated alongside current inventory valuation.
-- ------------------------------------------------------------------------------
SELECT 
    p.id AS product_id,
    p.product_code,
    p.name AS product_name,
    p.category,
    p.stock_quantity,
    p.price AS unit_price,
    ROUND(p.price * p.stock_quantity, 2) AS current_inventory_valuation,
    CASE 
        WHEN p.stock_quantity = 0 THEN 'OUT OF STOCK - CRITICAL'
        WHEN p.stock_quantity <= 5 THEN 'SEVERELY LOW'
        ELSE 'REORDER RECOMMENDED'
    END AS stock_alert_level,
    p.updated_at AS last_inventory_update
FROM products p
WHERE p.status = 'Active' 
  AND p.stock_quantity <= 10
ORDER BY 
    p.stock_quantity ASC,
    p.price DESC;


-- ------------------------------------------------------------------------------
-- QUERY 4: Monthly Confirmed Sales Totals
-- Business Purpose: Provides financial management with monthly sales trends,
-- aggregate order volumes, discounts given, and net recognized revenue.
-- ------------------------------------------------------------------------------
SELECT 
    DATE_FORMAT(so.order_date, '%Y-%m') AS sales_month,
    COUNT(so.id) AS total_confirmed_orders,
    COALESCE(SUM(so.subtotal), 0.00) AS monthly_gross_subtotal,
    COALESCE(SUM(so.discount_amount), 0.00) AS monthly_discounts_granted,
    COALESCE(SUM(so.grand_total), 0.00) AS monthly_net_revenue,
    ROUND(AVG(so.grand_total), 2) AS average_order_value
FROM sales_orders so
WHERE so.status = 'Confirmed'
GROUP BY 
    DATE_FORMAT(so.order_date, '%Y-%m')
ORDER BY 
    sales_month DESC;


-- ------------------------------------------------------------------------------
-- QUERY 5: Customers with No Confirmed Orders
-- Business Purpose: Identifies prospect customers who have registered in the system
-- but have either never placed an order, or whose orders are exclusively Draft or Cancelled.
-- Useful for sales re-engagement, churn prevention, and lead qualification.
-- ------------------------------------------------------------------------------
SELECT 
    c.id AS customer_id,
    c.customer_code,
    c.name AS customer_name,
    c.email,
    c.mobile,
    c.city,
    c.status AS customer_status,
    c.created_at AS registration_date,
    COUNT(so.id) AS total_unconfirmed_or_cancelled_orders
FROM customers c
LEFT JOIN sales_orders so 
    ON c.id = so.customer_id 
    AND so.status = 'Confirmed'
WHERE so.id IS NULL
GROUP BY 
    c.id, c.customer_code, c.name, c.email, c.mobile, c.city, c.status, c.created_at
ORDER BY 
    c.created_at DESC;
