-- ==============================================================================
-- SavyaNT Sales Order & Inventory Management System
-- Database Schema DDL for MySQL 8.0+
-- Storage Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Safe Initial Creation Script (Non-destructive: Uses CREATE TABLE IF NOT EXISTS)
-- ==============================================================================

-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS `savya_inventory_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `savya_inventory_db`;

-- ------------------------------------------------------------------------------
-- 1. Users Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'SALES',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  CONSTRAINT `chk_user_role` CHECK (`role` IN ('ADMIN', 'SALES'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Customers Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_code` (`customer_code`),
  UNIQUE KEY `uq_customers_email` (`email`),
  KEY `idx_customers_name` (`name`),
  KEY `idx_customers_mobile` (`mobile`),
  KEY `idx_customers_status` (`status`),
  CONSTRAINT `chk_customer_status` CHECK (`status` IN ('Active', 'Inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Products Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_code` (`product_code`),
  KEY `idx_products_name` (`name`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_status` (`status`),
  CONSTRAINT `chk_product_price_nonnegative` CHECK (`price` >= 0),
  CONSTRAINT `chk_product_stock_nonnegative` CHECK (`stock_quantity` >= 0),
  CONSTRAINT `chk_product_status` CHECK (`status` IN ('Active', 'Inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Sales Orders Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(50) NOT NULL,
  `customer_id` INT NOT NULL,
  `created_by` INT NOT NULL,
  `order_date` DATE NOT NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `confirmed_at` DATETIME NULL,
  `cancelled_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_orders_number` (`order_number`),
  KEY `idx_orders_customer_id` (`customer_id`),
  KEY `idx_orders_created_by` (`created_by`),
  KEY `idx_orders_order_date` (`order_date`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_order_status` CHECK (`status` IN ('Draft', 'Confirmed', 'Cancelled')),
  CONSTRAINT `chk_order_discount_range` CHECK (`discount_percentage` >= 0 AND `discount_percentage` <= 20),
  CONSTRAINT `chk_order_subtotal_nonnegative` CHECK (`subtotal` >= 0),
  CONSTRAINT `chk_order_discount_amount_nonnegative` CHECK (`discount_amount` >= 0),
  CONSTRAINT `chk_order_grand_total_nonnegative` CHECK (`grand_total` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Sales Order Items Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sales_order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `rate` DECIMAL(12, 2) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_item_product` (`sales_order_id`, `product_id`),
  KEY `idx_order_items_order_id` (`sales_order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_item_quantity_positive` CHECK (`quantity` > 0),
  CONSTRAINT `chk_item_rate_nonnegative` CHECK (`rate` >= 0),
  CONSTRAINT `chk_item_amount_nonnegative` CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Stock Movements Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `movement_code` VARCHAR(50) NOT NULL,
  `product_id` INT NOT NULL,
  `related_order_id` INT NULL,
  `movement_type` VARCHAR(50) NOT NULL,
  `quantity_change` INT NOT NULL,
  `previous_stock` INT NOT NULL,
  `new_stock` INT NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_movements_code` (`movement_code`),
  KEY `idx_movements_product_id` (`product_id`),
  KEY `idx_movements_order_id` (`related_order_id`),
  KEY `idx_movements_type` (`movement_type`),
  KEY `idx_movements_created_by` (`created_by`),
  KEY `idx_movements_created_at` (`created_at`),
  CONSTRAINT `fk_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_movements_order` FOREIGN KEY (`related_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_movements_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_movement_type` CHECK (`movement_type` IN ('Opening Stock', 'Stock Increase', 'Stock Decrease', 'Sales Deduction', 'Sales Return')),
  CONSTRAINT `chk_movement_prev_stock_nonnegative` CHECK (`previous_stock` >= 0),
  CONSTRAINT `chk_movement_new_stock_nonnegative` CHECK (`new_stock` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
