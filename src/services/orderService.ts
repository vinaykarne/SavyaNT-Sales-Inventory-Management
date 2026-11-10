import { OrderItem, OrderStatus, Product, SalesOrder, StockMovement, User, UserRole } from '../types';
import { calculateOrderFinancials, round2, validateDiscountPercentage } from '../utils/calculations';
import { storage } from '../utils/storage';
import { apiClient } from './apiClient';

export interface CreateOrderDTO {
  customerId: string;
  orderDate: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  discountPercentage: number;
  notes?: string;
  status: 'Draft' | 'Confirmed';
}

export interface UpdateOrderDTO {
  customerId?: string;
  orderDate?: string;
  items?: {
    productId: string;
    quantity: number;
  }[];
  discountPercentage?: number;
  notes?: string;
}

export interface UserContext {
  name: string;
  role: UserRole;
  email?: string;
}

export const orderService = {
  /**
   * Helper to check if a user is permitted to read an order.
   * Admin can read all orders. Sales users can only read their own orders.
   */
  canUserAccessOrder(order: SalesOrder, user: UserContext | null): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return order.createdBy.trim().toLowerCase() === user.name.trim().toLowerCase();
  },

  /**
   * Helper to check if a user is permitted to mutate (edit/confirm/cancel) an order.
   */
  canUserModifyOrder(order: SalesOrder, user: UserContext | null): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return order.createdBy.trim().toLowerCase() === user.name.trim().toLowerCase();
  },

  /**
   * Fetches orders with role-based filtering.
   * If the user is a Sales User, results are strictly scoped to their own orders.
   */
  getAll(
    filters?: {
      status?: OrderStatus;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      createdBy?: string;
    },
    user?: UserContext | null
  ): SalesOrder[] {
    let orders = storage.getOrders();

    // Enforce ownership: Sales users can strictly ONLY view their own orders
    if (user && user.role === 'SALES') {
      orders = orders.filter(
        (o) => o.createdBy.trim().toLowerCase() === user.name.trim().toLowerCase()
      );
    } else if (filters?.createdBy) {
      orders = orders.filter(
        (o) => o.createdBy.trim().toLowerCase() === filters.createdBy!.trim().toLowerCase()
      );
    }

    if (!filters) return orders;

    if (filters.status) {
      orders = orders.filter((o) => o.status === filters.status);
    }

    if (filters.dateFrom) {
      orders = orders.filter((o) => o.orderDate >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      orders = orders.filter((o) => o.orderDate <= filters.dateTo!);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.items.some((item) => item.productName.toLowerCase().includes(q))
      );
    }

    return orders;
  },

  /**
   * Retrieves a single order by ID or orderNumber with ownership verification.
   */
  getById(id: string, user?: UserContext | null): SalesOrder | undefined {
    const order = storage.getOrders().find((o) => o.id === id || o.orderNumber === id);
    if (!order) return undefined;

    // If a user context is provided, enforce access rules
    if (user && !this.canUserAccessOrder(order, user)) {
      return undefined;
    }

    return order;
  },

  generateNextOrderNumber(): string {
    const orders = storage.getOrders();
    const currentYear = new Date().getFullYear();
    const regex = new RegExp(`SO-${currentYear}-(\\d+)`);

    let maxSeq = 0;
    for (const o of orders) {
      const match = o.orderNumber.match(regex);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `SO-${currentYear}-${nextSeq}`;
  },

  createOrder(
    data: CreateOrderDTO,
    creatorName: string,
    creatorRole: UserRole
  ): { success: boolean; order?: SalesOrder; error?: string } {
    const customers = storage.getCustomers();
    const customer = customers.find((c) => c.id === data.customerId);

    if (!customer) {
      return { success: false, error: 'Selected customer not found.' };
    }

    if (customer.status !== 'Active') {
      return {
        success: false,
        error: 'Orders cannot be placed for inactive customers. Please activate the customer first.',
      };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Order must contain at least one product item.' };
    }

    // Check duplicate products
    const productIds = data.items.map((i) => i.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      return { success: false, error: 'Duplicate products found. Each product can only be added once.' };
    }

    // Validate quantities
    for (const item of data.items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        return {
          success: false,
          error: 'Item quantities must be positive whole integers greater than zero.',
        };
      }
    }

    // Validate discount
    const discValidation = validateDiscountPercentage(data.discountPercentage);
    if (!discValidation.isValid) {
      return { success: false, error: discValidation.error || 'Discount must be between 0% and 20%.' };
    }

    const allProducts = storage.getProducts();

    // Verify all products exist and are active
    const builtItems: OrderItem[] = [];
    for (const item of data.items) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) {
        return { success: false, error: `Product with ID ${item.productId} was not found.` };
      }
      if (product.status !== 'Active') {
        return {
          success: false,
          error: `Product "${product.name}" (${product.productCode}) is currently Inactive and cannot be ordered.`,
        };
      }

      const itemAmount = round2(item.quantity * product.price);
      builtItems.push({
        id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: product.id,
        productCode: product.productCode,
        productName: product.name,
        rate: product.price, // Lock in price at order creation
        quantity: item.quantity,
        amount: itemAmount,
        availableStockSnapshot: product.stockQuantity,
      });
    }

    const financials = calculateOrderFinancials(builtItems, data.discountPercentage);
    const orderNumber = this.generateNextOrderNumber();
    const orderId = orderNumber;

    // Stage inventory changes so the order and stock records are saved together.
    let productsToSave: Product[] | undefined;
    let movementsToSave: StockMovement[] | undefined;
    // If attempting to create directly as Confirmed:
    if (data.status === 'Confirmed') {
      // Atomic stock check: Every single product must have enough stock
      const stockErrors: string[] = [];
      for (const item of builtItems) {
        const prod = allProducts.find((p) => p.id === item.productId)!;
        if (prod.stockQuantity < item.quantity) {
          stockErrors.push(
            `"${prod.name}" (Requested: ${item.quantity}, Available: ${prod.stockQuantity})`
          );
        }
      }

      if (stockErrors.length > 0) {
        return {
          success: false,
          error: `Insufficient stock to confirm order. The entire order has been rejected: ${stockErrors.join(
            '; '
          )}`,
        };
      }

      // Deduct stock and record movements
      const movements = storage.getStockMovements();
      let nextMovSeq = movements.reduce((max, m) => {
        const match = m.movementCode.match(/MOV-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);

      const newMovements: StockMovement[] = [];
      const updatedProducts = [...allProducts];

      for (const item of builtItems) {
        const pIndex = updatedProducts.findIndex((p) => p.id === item.productId);
        const prevStock = updatedProducts[pIndex].stockQuantity;
        const newStock = prevStock - item.quantity;
        if (newStock < 0) {
          return {
            success: false,
            error: `Negative stock prevented for "${item.productName}". Current stock: ${prevStock}.`,
          };
        }

        updatedProducts[pIndex] = {
          ...updatedProducts[pIndex],
          stockQuantity: newStock,
          lastStockUpdate: new Date().toISOString(),
        };

        nextMovSeq += 1;
        const movCode = `MOV-${String(nextMovSeq).padStart(4, '0')}`;
        newMovements.push({
          id: movCode,
          movementCode: movCode,
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          movementType: 'Sales Deduction',
          quantityChange: -item.quantity,
          previousStock: prevStock,
          newStock: newStock,
          relatedOrderId: orderId,
          relatedOrderNumber: orderNumber,
          reason: `Order confirmation ${orderNumber}`,
          timestamp: new Date().toISOString(),
          createdBy: creatorName,
        });
      }

      productsToSave = updatedProducts;
      movementsToSave = [...newMovements, ...movements];
    }

    const newOrder: SalesOrder = {
      id: orderId,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      orderDate: data.orderDate,
      items: builtItems,
      subtotal: financials.subtotal,
      discountPercentage: financials.discountPercentage,
      discountAmount: financials.discountAmount,
      grandTotal: financials.grandTotal,
      createdBy: creatorName,
      createdByRole: creatorRole,
      status: data.status,
      notes: data.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      confirmedAt: data.status === 'Confirmed' ? new Date().toISOString() : undefined,
    };

    const existingOrders = storage.getOrders();
    const commit = storage.commit({ orders: [newOrder, ...existingOrders], ...(productsToSave ? { products: productsToSave } : {}), ...(movementsToSave ? { stockMovements: movementsToSave } : {}) });
    if (!commit.success) return { success: false, error: commit.error };

    // Asynchronously synchronize order with Flask backend
    apiClient.post('/orders', {
      customerId: data.customerId,
      orderDate: data.orderDate,
      items: data.items,
      discountPercentage: data.discountPercentage,
      status: data.status,
      notes: data.notes,
    }).catch((e) => console.warn('[orderService] Backend create order failed:', e));

    return { success: true, order: newOrder };
  },

  updateDraftOrder(
    orderId: string,
    data: UpdateOrderDTO,
    user?: UserContext | null
  ): { success: boolean; order?: SalesOrder; error?: string } {
    const orders = storage.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);

    if (index === -1) {
      return { success: false, error: 'Order not found.' };
    }

    const currentOrder = orders[index];

    // Ownership check
    if (user && !this.canUserModifyOrder(currentOrder, user)) {
      return {
        success: false,
        error: 'Unauthorized: Sales users can only edit their own draft orders.',
      };
    }

    // Must be in Draft status to edit!
    if (currentOrder.status !== 'Draft') {
      return {
        success: false,
        error: `Only Draft orders can be edited. This order is already "${currentOrder.status}" and is read-only.`,
      };
    }

    let customerName = currentOrder.customerName;
    let customerId = currentOrder.customerId;
    if (data.customerId && data.customerId !== currentOrder.customerId) {
      const customer = storage.getCustomers().find((c) => c.id === data.customerId);
      if (!customer) {
        return { success: false, error: 'Customer not found.' };
      }
      if (customer.status !== 'Active') {
        return { success: false, error: 'Selected customer is inactive.' };
      }
      customerName = customer.name;
      customerId = customer.id;
    }

    let builtItems = currentOrder.items;
    if (data.items) {
      if (data.items.length === 0) {
        return { success: false, error: 'Order must contain at least one item.' };
      }

      // Check duplicates
      const ids = data.items.map((i) => i.productId);
      if (new Set(ids).size !== ids.length) {
        return { success: false, error: 'Duplicate products in order items.' };
      }

      const allProducts = storage.getProducts();
      builtItems = [];
      for (const item of data.items) {
        const qty = Number(item.quantity);
        if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
          return { success: false, error: 'Quantities must be positive whole integers.' };
        }
        const prod = allProducts.find((p) => p.id === item.productId);
        if (!prod) {
          return { success: false, error: `Product ${item.productId} not found.` };
        }
        if (prod.status !== 'Active') {
          return {
            success: false,
            error: `Product "${prod.name}" (${prod.productCode}) is Inactive and cannot be selected.`,
          };
        }

        // Preserve existing snapshotted rate if present, or use product rate
        const existingItem = currentOrder.items.find((i) => i.productId === item.productId);
        const rate = existingItem ? existingItem.rate : prod.price;
        const amount = round2(qty * rate);

        builtItems.push({
          id: existingItem ? existingItem.id : `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.name,
          rate,
          quantity: qty,
          amount,
          availableStockSnapshot: prod.stockQuantity,
        });
      }
    }

    const discountPct =
      data.discountPercentage !== undefined
        ? data.discountPercentage
        : currentOrder.discountPercentage;

    const discCheck = validateDiscountPercentage(discountPct);
    if (!discCheck.isValid) {
      return { success: false, error: discCheck.error || 'Discount must be between 0% and 20%.' };
    }

    const financials = calculateOrderFinancials(builtItems, discountPct);

    const updatedOrder: SalesOrder = {
      ...currentOrder,
      customerId,
      customerName,
      orderDate: data.orderDate || currentOrder.orderDate,
      items: builtItems,
      subtotal: financials.subtotal,
      discountPercentage: financials.discountPercentage,
      discountAmount: financials.discountAmount,
      grandTotal: financials.grandTotal,
      notes: data.notes !== undefined ? data.notes.trim() : currentOrder.notes,
      updatedAt: new Date().toISOString(),
    };

    orders[index] = updatedOrder;
    const commit = storage.commit({ orders: [...orders] });
    if (!commit.success) return { success: false, error: commit.error };

    return { success: true, order: updatedOrder };
  },

  confirmOrder(
    orderId: string,
    performedBy: string,
    user?: UserContext | null
  ): { success: boolean; order?: SalesOrder; error?: string } {
    const orders = storage.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);

    if (index === -1) {
      return { success: false, error: 'Order not found.' };
    }

    const order = orders[index];

    // Ownership check
    if (user && !this.canUserModifyOrder(order, user)) {
      return {
        success: false,
        error: 'Unauthorized: Sales users can only confirm their own orders.',
      };
    }

    // Idempotency check: Cannot confirm if already Confirmed
    if (order.status === 'Confirmed') {
      return {
        success: false,
        error: 'Order is already confirmed. Duplicate confirmation is prevented.',
      };
    }

    if (order.status === 'Cancelled') {
      return {
        success: false,
        error: 'Cancelled orders cannot be confirmed.',
      };
    }

    // Must have items
    if (!order.items || order.items.length === 0) {
      return { success: false, error: 'Order has no items to confirm.' };
    }

    // Revalidate customer is still Active
    const customers = storage.getCustomers();
    const customer = customers.find((c) => c.id === order.customerId);
    if (!customer) {
      return { success: false, error: 'Referenced customer no longer exists.' };
    }
    if (customer.status !== 'Active') {
      return {
        success: false,
        error: `Customer "${customer.name}" is currently Inactive. Confirmation rejected until customer is reactivated.`,
      };
    }

    // Fresh Atomic Stock & Active Status Validation
    const allProducts = storage.getProducts();
    const stockShortages: string[] = [];
    const inactiveErrors: string[] = [];

    for (const item of order.items) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) {
        stockShortages.push(`Product "${item.productName}" (${item.productCode}) no longer exists.`);
        continue;
      }
      if (product.status !== 'Active') {
        inactiveErrors.push(`Product "${product.name}" (${product.productCode}) is Inactive.`);
      }
      if (product.stockQuantity < item.quantity) {
        stockShortages.push(
          `"${product.name}" (${product.productCode}): requested ${item.quantity}, available: ${product.stockQuantity}`
        );
      }
    }

    if (inactiveErrors.length > 0) {
      return {
        success: false,
        error: `Cannot confirm order with inactive products:\n• ${inactiveErrors.join('\n• ')}`,
      };
    }

    if (stockShortages.length > 0) {
      return {
        success: false,
        error: `Insufficient stock! Confirmation rejected without stock deductions:\n• ${stockShortages.join(
          '\n• '
        )}`,
      };
    }

    // All products verified and have sufficient stock. Atomically deduct:
    const updatedProducts = [...allProducts];
    const movements = storage.getStockMovements();
    let maxMovSeq = movements.reduce((max, m) => {
      const match = m.movementCode.match(/MOV-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    const newMovements: StockMovement[] = [];

    for (const item of order.items) {
      const prodIdx = updatedProducts.findIndex((p) => p.id === item.productId);
      const prevStock = updatedProducts[prodIdx].stockQuantity;
      const newStock = prevStock - item.quantity;

      if (newStock < 0) {
        return {
          success: false,
          error: `Stock would become negative for "${item.productName}". Confirmation aborted.`,
        };
      }

      updatedProducts[prodIdx] = {
        ...updatedProducts[prodIdx],
        stockQuantity: newStock,
        lastStockUpdate: new Date().toISOString(),
      };

      maxMovSeq += 1;
      const movCode = `MOV-${String(maxMovSeq).padStart(4, '0')}`;
      newMovements.push({
        id: movCode,
        movementCode: movCode,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        movementType: 'Sales Deduction',
        quantityChange: -item.quantity,
        previousStock: prevStock,
        newStock: newStock,
        relatedOrderId: order.id,
        relatedOrderNumber: order.orderNumber,
        reason: `Order confirmation ${order.orderNumber}`,
        timestamp: new Date().toISOString(),
        createdBy: performedBy,
      });
    }

    // Update order status to Confirmed
    const updatedOrder: SalesOrder = {
      ...order,
      status: 'Confirmed',
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders[index] = updatedOrder;

    // Atomic write
    const commit = storage.commit({ products: updatedProducts, stockMovements: [...newMovements, ...movements], orders: [...orders] });
    if (!commit.success) return { success: false, error: commit.error };

    // Asynchronously synchronize confirmation with Flask backend
    apiClient.post(`/orders/${order.id}/confirm`).catch((e) =>
      console.warn('[orderService] Backend confirm order failed:', e)
    );

    return { success: true, order: updatedOrder };
  },

  cancelOrder(
    orderId: string,
    performedBy: string,
    reason?: string,
    user?: UserContext | null
  ): { success: boolean; order?: SalesOrder; error?: string } {
    const orders = storage.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);

    if (index === -1) {
      return { success: false, error: 'Order not found.' };
    }

    const order = orders[index];

    // Ownership check
    if (user && !this.canUserModifyOrder(order, user)) {
      return {
        success: false,
        error: 'Unauthorized: Sales users can only cancel their own orders.',
      };
    }

    // Idempotency check: Cannot cancel if already Cancelled
    if (order.status === 'Cancelled') {
      return {
        success: false,
        error: 'Order is already cancelled. Duplicate cancellation is prevented.',
      };
    }

    const wasConfirmed = order.status === 'Confirmed';

    // If order was Confirmed, restore deducted stock exactly once
    let productsToSave: Product[] | undefined;
    let movementsToSave: StockMovement[] | undefined;
    if (wasConfirmed) {
      const allProducts = storage.getProducts();
      const updatedProducts = [...allProducts];
      const movements = storage.getStockMovements();
      let maxMovSeq = movements.reduce((max, m) => {
        const match = m.movementCode.match(/MOV-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);

      const restoreMovements: StockMovement[] = [];

      for (const item of order.items) {
        const prodIdx = updatedProducts.findIndex((p) => p.id === item.productId);
        if (prodIdx !== -1) {
          const prevStock = updatedProducts[prodIdx].stockQuantity;
          const newStock = prevStock + item.quantity;

          updatedProducts[prodIdx] = {
            ...updatedProducts[prodIdx],
            stockQuantity: newStock,
            lastStockUpdate: new Date().toISOString(),
          };

          maxMovSeq += 1;
          const movCode = `MOV-${String(maxMovSeq).padStart(4, '0')}`;
          restoreMovements.push({
            id: movCode,
            movementCode: movCode,
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            movementType: 'Sales Return',
            quantityChange: item.quantity,
            previousStock: prevStock,
            newStock: newStock,
            relatedOrderId: order.id,
            relatedOrderNumber: order.orderNumber,
            reason: `Order cancellation ${order.orderNumber}${reason ? `: ${reason}` : ''}`,
            timestamp: new Date().toISOString(),
            createdBy: performedBy,
          });
        }
      }

      productsToSave = updatedProducts;
      movementsToSave = [...restoreMovements, ...movements];
    }

    const updatedOrder: SalesOrder = {
      ...order,
      status: 'Cancelled',
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: reason ? `${order.notes ? `${order.notes} | ` : ''}Cancelled: ${reason}` : order.notes,
    };

    orders[index] = updatedOrder;
    const commit = storage.commit({ orders: [...orders], ...(productsToSave ? { products: productsToSave } : {}), ...(movementsToSave ? { stockMovements: movementsToSave } : {}) });
    if (!commit.success) return { success: false, error: commit.error };

    // Asynchronously synchronize cancellation with Flask backend
    apiClient.post(`/orders/${order.id}/cancel`, { reason }).catch((e) =>
      console.warn('[orderService] Backend cancel order failed:', e)
    );

    return { success: true, order: updatedOrder };
  },

  deleteDraftOrder(orderId: string, user?: UserContext | null): { success: boolean; error?: string } {
    const orders = storage.getOrders();
    const order = orders.find((o) => o.id === orderId);

    if (!order) return { success: false, error: 'Order not found.' };

    if (user && !this.canUserModifyOrder(order, user)) {
      return { success: false, error: 'Unauthorized: You can only delete your own draft orders.' };
    }

    if (order.status !== 'Draft') {
      return {
        success: false,
        error: 'Only Draft orders can be deleted. Confirmed or Cancelled orders must remain for audit purposes.',
      };
    }

    const filtered = orders.filter((o) => o.id !== orderId);
    storage.setOrders(filtered);
    return { success: true };
  },
};
