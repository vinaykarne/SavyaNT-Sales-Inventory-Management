import { StockMovement, StockMovementType } from '../types';
import { getStockStatus } from '../utils/formatters';
import { storage } from '../utils/storage';

export interface InventoryItem {
  id: string;
  productCode: string;
  name: string;
  category: string;
  price: number;
  stockQuantity: number;
  status: 'Active' | 'Inactive';
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  stockStatusVariant: 'success' | 'warning' | 'danger';
  lastStockUpdate?: string;
}

export const inventoryService = {
  getInventoryItems(lowThreshold = 10): InventoryItem[] {
    const products = storage.getProducts();
    return products.map((p) => {
      const statusInfo = getStockStatus(p.stockQuantity, lowThreshold);
      return {
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        category: p.category,
        price: p.price,
        stockQuantity: p.stockQuantity,
        status: p.status,
        stockStatus: statusInfo.label,
        stockStatusVariant: statusInfo.variant,
        lastStockUpdate: p.lastStockUpdate || p.updatedAt || p.createdAt,
      };
    });
  },

  getMovements(filters?: {
    productId?: string;
    type?: StockMovementType;
    search?: string;
  }): StockMovement[] {
    let movements = storage.getStockMovements();

    if (!filters) return movements;

    if (filters.productId) {
      movements = movements.filter((m) => m.productId === filters.productId);
    }

    if (filters.type) {
      movements = movements.filter((m) => m.movementType === filters.type);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      movements = movements.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          (m.relatedOrderNumber && m.relatedOrderNumber.toLowerCase().includes(q))
      );
    }

    return movements;
  },

  adjustStock(params: {
    productId: string;
    type: 'Increase' | 'Decrease';
    quantity: number;
    reason: string;
    performedBy: string;
  }): { success: boolean; movement?: StockMovement; error?: string } {
    const products = storage.getProducts();
    const index = products.findIndex((p) => p.id === params.productId);

    if (index === -1) {
      return { success: false, error: 'Product not found.' };
    }

    const qty = Number(params.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return { success: false, error: 'Adjustment quantity must be a positive whole number.' };
    }

    if (!params.reason || params.reason.trim().length < 3) {
      return { success: false, error: 'Reason for adjustment is mandatory (minimum 3 characters).' };
    }

    const product = products[index];
    const prevStock = product.stockQuantity;
    let newStock = prevStock;

    if (params.type === 'Increase') {
      newStock = prevStock + qty;
    } else {
      if (prevStock - qty < 0) {
        return {
          success: false,
          error: `Cannot decrease stock by ${qty}. Available stock is only ${prevStock}. Stock must never become negative.`,
        };
      }
      newStock = prevStock - qty;
    }

    // Update product
    const updatedProduct = {
      ...product,
      stockQuantity: newStock,
      lastStockUpdate: new Date().toISOString(),
    };
    products[index] = updatedProduct;

    // Record movement
    const movements = storage.getStockMovements();
    const maxMovSeq = movements.reduce((max, m) => {
      const match = m.movementCode.match(/MOV-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    const movCode = `MOV-${String(maxMovSeq + 1).padStart(4, '0')}`;
    const movementType: StockMovementType =
      params.type === 'Increase' ? 'Stock Increase' : 'Stock Decrease';
    const quantityChange = params.type === 'Increase' ? qty : -qty;

    const newMovement: StockMovement = {
      id: movCode,
      movementCode: movCode,
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      movementType,
      quantityChange,
      previousStock: prevStock,
      newStock,
      reason: params.reason.trim(),
      timestamp: new Date().toISOString(),
      createdBy: params.performedBy,
    };

    storage.setProducts([...products]);
    storage.setStockMovements([newMovement, ...movements]);

    return { success: true, movement: newMovement };
  },
};
