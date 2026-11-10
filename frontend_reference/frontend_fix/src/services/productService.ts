import { EntityStatus, Product, ProductCategory, StockMovement } from '../types';
import { storage } from '../utils/storage';

export const productService = {
  canManage(): boolean { return storage.getCurrentUser()?.role === 'ADMIN'; },
  getAll(): Product[] {
    return storage.getProducts();
  },

  getActive(): Product[] {
    return storage.getProducts().filter((p) => p.status === 'Active');
  },

  getById(id: string): Product | undefined {
    return storage.getProducts().find((p) => p.id === id);
  },

  getByCode(code: string): Product | undefined {
    return storage
      .getProducts()
      .find((p) => p.productCode.toUpperCase() === code.trim().toUpperCase());
  },

  create(data: {
    productCode: string;
    name: string;
    category: ProductCategory | string;
    price: number;
    stockQuantity: number;
    status: EntityStatus;
  }): { success: boolean; product?: Product; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const products = storage.getProducts();
    const cleanCode = data.productCode.trim().toUpperCase();

    // Check code uniqueness
    const codeExists = products.some((p) => p.productCode.toUpperCase() === cleanCode);
    if (codeExists) {
      return { success: false, error: `Product code '${cleanCode}' already exists.` };
    }

    if (data.price < 0) {
      return { success: false, error: 'Price cannot be negative.' };
    }

    const stockQty = Number(data.stockQuantity);
    if (isNaN(stockQty) || stockQty < 0 || !Number.isInteger(stockQty)) {
      return { success: false, error: 'Stock quantity must be a non-negative whole number.' };
    }

    const newProduct: Product = {
      id: cleanCode,
      productCode: cleanCode,
      name: data.name.trim(),
      category: data.category,
      price: Number(data.price),
      stockQuantity: stockQty,
      status: data.status,
      createdAt: new Date().toISOString(),
      lastStockUpdate: new Date().toISOString(),
    };

    // Record opening stock and product together so the audit trail stays aligned.
    // Record Opening Stock movement if stock > 0
    if (newProduct.stockQuantity > 0) {
      const movements = storage.getStockMovements();
      const maxMov = movements.reduce((max, m) => {
        const match = m.movementCode.match(/MOV-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      const movCode = `MOV-${String(maxMov + 1).padStart(4, '0')}`;

      const openingMovement: StockMovement = {
        id: movCode,
        movementCode: movCode,
        productId: newProduct.id,
        productCode: newProduct.productCode,
        productName: newProduct.name,
        movementType: 'Opening Stock',
        quantityChange: newProduct.stockQuantity,
        previousStock: 0,
        newStock: newProduct.stockQuantity,
        reason: 'Opening stock for newly added product',
        timestamp: new Date().toISOString(),
        createdBy: storage.getCurrentUser()?.name || 'System',
      };
      const commit = storage.commit({ products: [newProduct, ...products], stockMovements: [openingMovement, ...movements] });
      if (!commit.success) return { success: false, error: commit.error };
    } else {
      const commit = storage.commit({ products: [newProduct, ...products] });
      if (!commit.success) return { success: false, error: commit.error };
    }

    return { success: true, product: newProduct };
  },

  update(
    id: string,
    data: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): { success: boolean; product?: Product; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const products = storage.getProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return { success: false, error: 'Product not found.' };
    }

    if (data.productCode) {
      const cleanCode = data.productCode.trim().toUpperCase();
      const codeConflict = products.some(
        (p) => p.id !== id && p.productCode.toUpperCase() === cleanCode
      );
      if (codeConflict) {
        return { success: false, error: `Product code '${cleanCode}' already exists.` };
      }
    }

    if (data.price !== undefined && data.price < 0) {
      return { success: false, error: 'Price cannot be negative.' };
    }

    const current = products[index];

    let newStockQuantity = current.stockQuantity;
    if (data.stockQuantity !== undefined) {
      const parsedStock = Number(data.stockQuantity);
      if (isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
        return { success: false, error: 'Stock quantity must be a non-negative whole integer.' };
      }
      newStockQuantity = parsedStock;
    }

    const stockDiff = newStockQuantity - current.stockQuantity;

    const updated: Product = {
      ...current,
      ...data,
      name: data.name ? data.name.trim() : current.name,
      productCode: data.productCode ? data.productCode.trim().toUpperCase() : current.productCode,
      price: data.price !== undefined ? Number(data.price) : current.price,
      stockQuantity: newStockQuantity,
      updatedAt: new Date().toISOString(),
      lastStockUpdate: stockDiff !== 0 ? new Date().toISOString() : current.lastStockUpdate,
    };

    products[index] = updated;

    // Ensure every stock change has a corresponding movement record
    if (stockDiff !== 0) {
      const movements = storage.getStockMovements();
      const maxMov = movements.reduce((max, m) => {
        const match = m.movementCode.match(/MOV-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      const movCode = `MOV-${String(maxMov + 1).padStart(4, '0')}`;

      const movement: StockMovement = {
        id: movCode,
        movementCode: movCode,
        productId: updated.id,
        productCode: updated.productCode,
        productName: updated.name,
        movementType: stockDiff > 0 ? 'Stock Increase' : 'Stock Decrease',
        quantityChange: stockDiff,
        previousStock: current.stockQuantity,
        newStock: newStockQuantity,
        reason: 'Master product catalog stock level adjustment',
        timestamp: new Date().toISOString(),
        createdBy: storage.getCurrentUser()?.name || 'Administrator',
      };
      const commit = storage.commit({ products: [...products], stockMovements: [movement, ...movements] });
      if (!commit.success) return { success: false, error: commit.error };
    } else {
      const commit = storage.commit({ products: [...products] });
      if (!commit.success) return { success: false, error: commit.error };
    }

    return { success: true, product: updated };
  },

  delete(id: string): { success: boolean; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const orders = storage.getOrders();
    const product = this.getById(id);
    if (!product) return { success: false, error: 'Product not found.' };

    // Check if referenced in any order items
    const referencedInOrders = orders.some((order) =>
      order.items.some((item) => item.productId === id || item.productCode === product.productCode)
    );

    // Check if referenced in stock movements
    const movements = storage.getStockMovements();
    const referencedInMovements = movements.some(
      (m) => m.productId === id || m.productCode === product.productCode
    );

    if (referencedInOrders || referencedInMovements) {
      return {
        success: false,
        error:
          'Cannot delete product: This product is referenced by existing orders or stock movement audit records. You can set its status to "Inactive" instead.',
      };
    }

    const products = storage.getProducts();
    const filtered = products.filter((p) => p.id !== id);
    storage.setProducts(filtered);
    return { success: true };
  },

  toggleStatus(id: string): { success: boolean; newStatus?: EntityStatus; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const product = this.getById(id);
    if (!product) return { success: false, error: 'Product not found.' };
    const nextStatus: EntityStatus = product.status === 'Active' ? 'Inactive' : 'Active';
    const res = this.update(id, { status: nextStatus });
    return { success: res.success, newStatus: nextStatus, error: res.error };
  },
};
