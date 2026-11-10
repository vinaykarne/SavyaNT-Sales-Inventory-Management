"""Initial migration - Create 6 core tables: users, customers, products, sales_orders, sales_order_items, stock_movements

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-11-10 09:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # 1. Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=191), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='SALES', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint("role IN ('ADMIN', 'SALES')", name='chk_user_role'),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB',
    )
    op.create_index('uq_users_email', 'users', ['email'], unique=True)
    op.create_index('idx_users_role', 'users', ['role'], unique=False)

    # 2. Customers Table
    op.create_table(
        'customers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('customer_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=191), nullable=False),
        sa.Column('mobile', sa.String(length=20), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Active', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint("status IN ('Active', 'Inactive')", name='chk_customer_status'),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB',
    )
    op.create_index('uq_customers_code', 'customers', ['customer_code'], unique=True)
    op.create_index('uq_customers_email', 'customers', ['email'], unique=True)
    op.create_index('idx_customers_name', 'customers', ['name'], unique=False)
    op.create_index('idx_customers_mobile', 'customers', ['mobile'], unique=False)
    op.create_index('idx_customers_status', 'customers', ['status'], unique=False)

    # 3. Products Table
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('stock_quantity', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Active', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('price >= 0', name='chk_product_price_nonnegative'),
        sa.CheckConstraint('stock_quantity >= 0', name='chk_product_stock_nonnegative'),
        sa.CheckConstraint("status IN ('Active', 'Inactive')", name='chk_product_status'),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB',
    )
    op.create_index('uq_products_code', 'products', ['product_code'], unique=True)
    op.create_index('idx_products_name', 'products', ['name'], unique=False)
    op.create_index('idx_products_category', 'products', ['category'], unique=False)
    op.create_index('idx_products_status', 'products', ['status'], unique=False)

    # 4. Sales Orders Table
    op.create_table(
        'sales_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_number', sa.String(length=50), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('order_date', sa.Date(), nullable=False),
        sa.Column('subtotal', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('grand_total', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Draft', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint("status IN ('Draft', 'Confirmed', 'Cancelled')", name='chk_order_status'),
        sa.CheckConstraint('discount_percentage >= 0 AND discount_percentage <= 20', name='chk_order_discount_range'),
        sa.CheckConstraint('subtotal >= 0', name='chk_order_subtotal_nonnegative'),
        sa.CheckConstraint('discount_amount >= 0', name='chk_order_discount_amount_nonnegative'),
        sa.CheckConstraint('grand_total >= 0', name='chk_order_grand_total_nonnegative'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT', onupdate='CASCADE', name='fk_orders_customer'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT', onupdate='CASCADE', name='fk_orders_creator'),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB',
    )
    op.create_index('uq_sales_orders_number', 'sales_orders', ['order_number'], unique=True)
    op.create_index('idx_orders_customer_id', 'sales_orders', ['customer_id'], unique=False)
    op.create_index('idx_orders_created_by', 'sales_orders', ['created_by'], unique=False)
    op.create_index('idx_orders_order_date', 'sales_orders', ['order_date'], unique=False)
    op.create_index('idx_orders_status', 'sales_orders', ['status'], unique=False)

    # 5. Sales Order Items Table
    op.create_table(
        'sales_order_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sales_order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('rate', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_item_quantity_positive'),
        sa.CheckConstraint('rate >= 0', name='chk_item_rate_nonnegative'),
        sa.CheckConstraint('amount >= 0', name='chk_item_amount_nonnegative'),
        sa.ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], ondelete='CASCADE', onupdate='CASCADE', name='fk_order_items_order'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT', onupdate='CASCADE', name='fk_order_items_product'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sales_order_id', 'product_id', name='uq_order_product'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB',
    )
    op.create_index('idx_order_items_order_id', 'sales_order_items', ['sales_order_id'], unique=False)
    op.create_index('idx_order_items_product_id', 'sales_order_items', ['product_id'], unique=False)

    # 6. Stock Movements Table
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('movement_code', sa.String(length=50), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('related_order_id', sa.Integer(), nullable=True),
        sa.Column('movement_type', sa.String(length=50), nullable=False),
        sa.Column('quantity_change', sa.Integer(), nullable=False),
        sa.Column('previous_stock', sa.Integer(), nullable=False),
        sa.Column('new_stock', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "movement_type IN ('Opening Stock', 'Stock Increase', 'Stock Decrease', 'Sales Deduction', 'Sales Return')",
            name='chk_movement_type',
        ),
        sa.CheckConstraint('previous_stock >= 0', name='chk_movement_prev_stock_nonnegative'),
        sa.CheckConstraint('new_stock >= 0', name='chk_movement_new_stock_nonnegative'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT', onupdate='CASCADE', name='fk_movements_product'),
        sa.ForeignKeyConstraint(['related_order_id'], ['sales_orders.id'], ondelete='SET NULL', onupdate='CASCADE', name='fk_movements_order'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT', onupdate='CASCADE', name='fk_movements_creator'),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB',
    )
    op.create_index('uq_movements_code', 'stock_movements', ['movement_code'], unique=True)
    op.create_index('idx_movements_product_id', 'stock_movements', ['product_id'], unique=False)
    op.create_index('idx_movements_order_id', 'stock_movements', ['related_order_id'], unique=False)
    op.create_index('idx_movements_type', 'stock_movements', ['movement_type'], unique=False)
    op.create_index('idx_movements_created_by', 'stock_movements', ['created_by'], unique=False)
    op.create_index('idx_movements_created_at', 'stock_movements', ['created_at'], unique=False)


def downgrade():
    op.drop_table('stock_movements')
    op.drop_table('sales_order_items')
    op.drop_table('sales_orders')
    op.drop_table('products')
    op.drop_table('customers')
    op.drop_table('users')
