import { Customer, Product, SalesOrder, StockMovement, User } from '../types';
import {
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_USERS,
} from '../data/initialData';

const STORAGE_PREFIX = 'savya_erp_';

export const STORAGE_KEYS = {
  USERS: `${STORAGE_PREFIX}users`,
  CURRENT_USER: `${STORAGE_PREFIX}current_user`,
  CUSTOMERS: `${STORAGE_PREFIX}customers`,
  PRODUCTS: `${STORAGE_PREFIX}products`,
  ORDERS: `${STORAGE_PREFIX}orders`,
  STOCK_MOVEMENTS: `${STORAGE_PREFIX}stock_movements`,
  APP_INITIALIZED: `${STORAGE_PREFIX}initialized_v1`,
};

function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

/**
 * Ensures demo datasets are seeded on first load.
 */
export function initializeStorageIfNeeded(): void {
  const isInit = localStorage.getItem(STORAGE_KEYS.APP_INITIALIZED);
  if (!isInit) {
    resetToDemoData();
  }
}

/**
 * Resets all demo tables to their initial rich dataset.
 */
export function resetToDemoData(): void {
  safeSet(STORAGE_KEYS.USERS, INITIAL_USERS);
  safeSet(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  safeSet(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
  safeSet(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  safeSet(STORAGE_KEYS.STOCK_MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
  // Default current user to Admin if none exists
  const existingUser = safeGet<User | null>(STORAGE_KEYS.CURRENT_USER, null);
  if (!existingUser) {
    const defaultAdmin = INITIAL_USERS[0];
    const { passwordHash: _, ...userWithoutPass } = defaultAdmin;
    safeSet(STORAGE_KEYS.CURRENT_USER, userWithoutPass);
  }
  localStorage.setItem(STORAGE_KEYS.APP_INITIALIZED, 'true');
}

export const storage = {
  /** Writes related browser-storage records together and restores the previous values on failure.
   * This is a best-effort frontend demo transaction, not a substitute for a database transaction.
   */
  commit: (updates: { customers?: Customer[]; products?: Product[]; orders?: SalesOrder[]; stockMovements?: StockMovement[] }) => {
    const entries: [string, unknown][] = [];
    if (updates.customers) entries.push([STORAGE_KEYS.CUSTOMERS, updates.customers]);
    if (updates.products) entries.push([STORAGE_KEYS.PRODUCTS, updates.products]);
    if (updates.orders) entries.push([STORAGE_KEYS.ORDERS, updates.orders]);
    if (updates.stockMovements) entries.push([STORAGE_KEYS.STOCK_MOVEMENTS, updates.stockMovements]);
    const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
    try {
      for (const [key, value] of entries) localStorage.setItem(key, JSON.stringify(value));
      return { success: true as const };
    } catch (error) {
      for (const [key, value] of previous) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* best-effort rollback */ }
      }
      console.error('Could not commit local data changes:', error);
      return { success: false as const, error: 'Unable to save changes in browser storage. Check available storage space and try again.' };
    }
  },
  getCustomers: (): Customer[] => safeGet<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS),
  setCustomers: (data: Customer[]): void => safeSet(STORAGE_KEYS.CUSTOMERS, data),

  getProducts: (): Product[] => safeGet<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS),
  setProducts: (data: Product[]): void => safeSet(STORAGE_KEYS.PRODUCTS, data),

  getOrders: (): SalesOrder[] => safeGet<SalesOrder[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS),
  setOrders: (data: SalesOrder[]): void => safeSet(STORAGE_KEYS.ORDERS, data),

  getStockMovements: (): StockMovement[] =>
    safeGet<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, INITIAL_STOCK_MOVEMENTS),
  setStockMovements: (data: StockMovement[]): void => safeSet(STORAGE_KEYS.STOCK_MOVEMENTS, data),

  getUsers: () => safeGet<(User & { passwordHash: string })[]>(STORAGE_KEYS.USERS, INITIAL_USERS),
  setUsers: (users: (User & { passwordHash: string })[]) => safeSet(STORAGE_KEYS.USERS, users),

  getCurrentUser: (): User | null => safeGet<User | null>(STORAGE_KEYS.CURRENT_USER, null),
  setCurrentUser: (user: User | null): void => safeSet(STORAGE_KEYS.CURRENT_USER, user),
};
