import { StockMovement, UserRole } from '../types';
import { round2 } from '../utils/calculations';
import { storage } from '../utils/storage';

export interface CustomerSalesReportItem {
  customerId: string;
  customerName: string;
  confirmedOrderCount: number;
  totalSalesAfterDiscount: number;
}

export interface ProductSalesReportItem {
  productId: string;
  productCode: string;
  productName: string;
  quantitySold: number;
  grossItemValue: number; // Gross Item Value Before Order Discount
}

export interface LowStockReportItem {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  category: string;
  unitPrice: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface UserContext {
  name: string;
  role: UserRole;
}

export const reportService = {
  getCustomerSalesSummary(
    filters?: {
      dateFrom?: string;
      dateTo?: string;
    },
    user?: UserContext | null
  ): CustomerSalesReportItem[] {
    const customers = storage.getCustomers();
    let confirmedOrders = storage.getOrders().filter((o) => o.status === 'Confirmed');

    // Scoped ownership check: Sales users see metrics based on their own confirmed orders
    if (user && user.role === 'SALES') {
      confirmedOrders = confirmedOrders.filter(
        (o) => o.createdBy.trim().toLowerCase() === user.name.trim().toLowerCase()
      );
    }

    if (filters?.dateFrom) {
      confirmedOrders = confirmedOrders.filter((o) => o.orderDate >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      confirmedOrders = confirmedOrders.filter((o) => o.orderDate <= filters.dateTo!);
    }

    // Map through ALL customers so that customers with zero confirmed orders are included
    return customers.map((c) => {
      const ordersForCustomer = confirmedOrders.filter((o) => o.customerId === c.id);
      const confirmedOrderCount = ordersForCustomer.length;
      const totalSalesAfterDiscount = round2(
        ordersForCustomer.reduce((sum, o) => sum + (o.grandTotal || 0), 0)
      );

      return {
        customerId: c.id,
        customerName: c.name,
        confirmedOrderCount,
        totalSalesAfterDiscount,
      };
    });
  },

  getProductSalesSummary(
    filters?: {
      dateFrom?: string;
      dateTo?: string;
    },
    user?: UserContext | null
  ): ProductSalesReportItem[] {
    const products = storage.getProducts();
    let confirmedOrders = storage.getOrders().filter((o) => o.status === 'Confirmed');

    if (user && user.role === 'SALES') {
      confirmedOrders = confirmedOrders.filter(
        (o) => o.createdBy.trim().toLowerCase() === user.name.trim().toLowerCase()
      );
    }

    if (filters?.dateFrom) {
      confirmedOrders = confirmedOrders.filter((o) => o.orderDate >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      confirmedOrders = confirmedOrders.filter((o) => o.orderDate <= filters.dateTo!);
    }

    const salesMap: Record<
      string,
      { quantitySold: number; grossItemValue: number; productCode: string; productName: string }
    > = {};

    for (const p of products) {
      salesMap[p.id] = {
        quantitySold: 0,
        grossItemValue: 0,
        productCode: p.productCode,
        productName: p.name,
      };
    }

    for (const order of confirmedOrders) {
      for (const item of order.items) {
        if (!salesMap[item.productId]) {
          salesMap[item.productId] = {
            quantitySold: 0,
            grossItemValue: 0,
            productCode: item.productCode,
            productName: item.productName,
          };
        }
        salesMap[item.productId].quantitySold += item.quantity;
        salesMap[item.productId].grossItemValue = round2(
          salesMap[item.productId].grossItemValue + item.amount
        );
      }
    }

    return Object.keys(salesMap).map((productId) => ({
      productId,
      productCode: salesMap[productId].productCode,
      productName: salesMap[productId].productName,
      quantitySold: salesMap[productId].quantitySold,
      grossItemValue: salesMap[productId].grossItemValue,
    }));
  },

  getLowStockReport(threshold: number = 10): LowStockReportItem[] {
    const safeThreshold = Math.max(0, isNaN(threshold) ? 10 : threshold);
    const products = storage.getProducts();

    return products
      .filter((p) => p.stockQuantity <= safeThreshold)
      .map((p) => ({
        productId: p.id,
        productCode: p.productCode,
        productName: p.name,
        currentStock: p.stockQuantity,
        category: p.category,
        unitPrice: p.price,
        status: (p.stockQuantity <= 0 ? 'Out of Stock' : 'Low Stock') as
          | 'In Stock'
          | 'Low Stock'
          | 'Out of Stock',
      }))
      .sort((a, b) => a.currentStock - b.currentStock);
  },

  getStockMovementHistory(filters?: {
    search?: string;
    movementType?: string;
  }): StockMovement[] {
    let movements = storage.getStockMovements();

    if (filters?.movementType) {
      movements = movements.filter((m) => m.movementType === filters.movementType);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      movements = movements.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q)
      );
    }

    return movements;
  },
};
