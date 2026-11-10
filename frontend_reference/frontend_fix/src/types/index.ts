export type UserRole = 'ADMIN' | 'SALES';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
}

export type EntityStatus = 'Active' | 'Inactive';

export interface Customer {
  id: string;
  name: string;
  email: string;
  mobile: string;
  city: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt?: string;
}

export type ProductCategory = 
  | 'Accessories'
  | 'Peripherals'
  | 'Audio'
  | 'Storage'
  | 'Networking'
  | 'Displays'
  | 'Components'
  | 'Power';

export interface Product {
  id: string;
  productCode: string;
  name: string;
  category: ProductCategory | string;
  price: number; // In INR (₹)
  stockQuantity: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt?: string;
  lastStockUpdate?: string;
}

export type OrderStatus = 'Draft' | 'Confirmed' | 'Cancelled';

export interface OrderItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  rate: number; // Stored at the time order is created
  quantity: number;
  amount: number; // quantity * rate
  availableStockSnapshot?: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string; // e.g. SO-2026-0001
  customerId: string;
  customerName: string;
  orderDate: string; // YYYY-MM-DD
  items: OrderItem[];
  subtotal: number;
  discountPercentage: number; // 0 to 20
  discountAmount: number;
  grandTotal: number;
  createdBy: string; // user name or id
  createdByRole: UserRole;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

export type StockMovementType = 
  | 'Opening Stock'
  | 'Stock Increase'
  | 'Stock Decrease'
  | 'Sales Deduction'
  | 'Sales Return';

export interface StockMovement {
  id: string;
  movementCode: string; // e.g. MOV-0001
  productId: string;
  productCode: string;
  productName: string;
  movementType: StockMovementType;
  quantityChange: number; // Positive or negative
  previousStock: number;
  newStock: number;
  relatedOrderId?: string;
  relatedOrderNumber?: string;
  reason: string;
  timestamp: string;
  createdBy: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
}
