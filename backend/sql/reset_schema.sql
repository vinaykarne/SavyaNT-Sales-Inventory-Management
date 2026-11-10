-- ==============================================================================
-- SavyaNT Sales Order & Inventory Management System
-- DESTRUCTIVE SCHEMA RESET SCRIPT (DEVELOPMENT / TEST CLEANUP ONLY)
--
-- WARNING: This script drops all six application tables and purges all data!
-- NEVER execute this against a production or staging database.
-- ==============================================================================

USE `savya_inventory_db`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `stock_movements`;
DROP TABLE IF EXISTS `sales_order_items`;
DROP TABLE IF EXISTS `sales_orders`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- To recreate tables after resetting, execute schema.sql or run 'flask db upgrade'.
