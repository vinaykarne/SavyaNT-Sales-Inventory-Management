/**
 * SavyaNT Sales Order & Inventory Management System
 * Product Frontend Service
 *
 * Communicates with /api/products endpoints, enforces admin controls,
 * prevents silent stock mutation during ordinary updates, and maintains reactive product store.
 */

import { EntityStatus, Product, ProductCategory, StockMovement } from '../types';
import { storage } from '../utils/storage';
import { apiClient } from './apiClient';

export const productService = {
  canManage(): boolean {
    const user = apiClient.getStoredUser() || storage.getCurrentUser();
    return user?.role === 'ADMIN';
  },

  getAll(): Product[] {
    return storage.getProducts();
  },

  getActive(): Product[] {
    return storage.getProducts().filter((p) => p.status === 'Active');
  },

  getById(id: string): Product | undefined {
    return storage.getProducts().find((p) => p.id === id || p.productCode === id);
  },

  getByCode(code: string): Product | undefined {
    return storage
      .getProducts()
      .find((p) => p.productCode.toUpperCase() === code.trim().toUpperCase());
  },

  async fetchFromBackend(): Promise<Product[]> {
    try {
      const res = await apiClient.get<Product[]>('/products');
      if (res.success && Array.isArray(res.data)) {
        storage.setProducts(res.data);
        return res.data;
      }
    } catch (e) {
      console.warn('[productService] Failed to fetch products from API:', e);
    }
    return storage.getProducts();
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

    let newMovements = storage.getStockMovements();
    if (newProduct.stockQuantity > 0) {
      const maxMov = newMovements.reduce((max, m) => {
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
      newMovements = [openingMovement, ...newMovements];
    }

    storage.commit({
      products: [newProduct, ...products],
      stockMovements: newMovements,
    });

    // Sync to backend API
    apiClient.post('/products', {
      product_code: cleanCode,
      name: newProduct.name,
      category: newProduct.category,
      price: newProduct.price,
      stock_quantity: newProduct.stockQuantity,
      status: newProduct.status,
    }).then((res) => {
      if (res.success && res.data) {
        const synced = storage.getProducts().map((p) => (p.productCode === cleanCode ? { ...p, ...res.data } : p));
        storage.setProducts(synced);
      }
    }).catch((e) => console.warn('[productService] Backend sync error:', e));

    return { success: true, product: newProduct };
  },

  update(
    id: string,
    data: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): { success: boolean; product?: Product; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const products = storage.getProducts();
    const index = products.findIndex((p) => p.id === id || p.productCode === id);

    if (index === -1) {
      return { success: false, error: 'Product not found.' };
    }

    if (data.productCode) {
      const cleanCode = data.productCode.trim().toUpperCase();
      const codeConflict = products.some(
        (p) => (p.id !== id && p.productCode !== id) && p.productCode.toUpperCase() === cleanCode
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

    const updated: Product = {
      ...current,
      ...data,
      name: data.name ? data.name.trim() : current.name,
      productCode: data.productCode ? data.productCode.trim().toUpperCase() : current.productCode,
      category: data.category || current.category,
      price: data.price !== undefined ? Number(data.price) : current.price,
      stockQuantity: newStockQuantity,
      status: data.status || current.status,
      updatedAt: new Date().toISOString(),
    };

    products[index] = updated;
    storage.setProducts([...products]);

    // Backend sync
    apiClient.put(`/products/${id}`, updated).catch((e) =>
      console.warn('[productService] Backend update failed:', e)
    );

    return { success: true, product: updated };
  },

  delete(id: string): { success: boolean; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };

    const orders = storage.getOrders();
    const isReferencedInOrders = orders.some((o) =>
      o.items.some((item) => item.productId === id || item.productCode === id)
    );

    if (isReferencedInOrders) {
      return {
        success: false,
        error:
          'Cannot delete product: This product is referenced by one or more existing sales orders. Please mark it as "Inactive" instead to maintain historical integrity.',
      };
    }

    const products = storage.getProducts();
    const filtered = products.filter((p) => p.id !== id && p.productCode !== id);
    if (filtered.length === products.length) {
      return { success: false, error: 'Product not found.' };
    }

    storage.setProducts(filtered);

    apiClient.delete(`/products/${id}`).catch((e) =>
      console.warn('[productService] Backend delete failed:', e)
    );

    return { success: true };
  },

  getLowStock(threshold: number = 10): Product[] {
    return storage
      .getProducts()
      .filter((p) => p.status === 'Active' && p.stockQuantity <= threshold);
  },

  toggleStatus(id: string): { success: boolean; newStatus?: EntityStatus; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const product = this.getById(id);
    if (!product) return { success: false, error: 'Product not found.' };
    const nextStatus: EntityStatus = product.status === 'Active' ? 'Inactive' : 'Active';
    const res = this.update(id, { status: nextStatus });
    return { success: res.success, newStatus: nextStatus, error: res.error };
  },

  getCategories(): string[] {
    const products = storage.getProducts();
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  },
};
