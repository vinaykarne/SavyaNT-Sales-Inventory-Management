/**
 * SavyaNT Sales Order & Inventory Management System
 * Authentication Frontend Service
 *
 * Communicates with POST /api/auth/login and GET /api/auth/me endpoints,
 * manages JWT token persistence, and maintains active user session state.
 */

import { User, UserRole } from '../types';
import { storage } from '../utils/storage';
import { apiClient } from './apiClient';

export const authService = {
  getCurrentUser(): User | null {
    const apiUser = apiClient.getStoredUser();
    if (apiUser) return apiUser;
    return storage.getCurrentUser();
  },

  async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Attempt real authentication against Flask backend
    try {
      const response = await apiClient.post('/auth/login', {
        email: cleanEmail,
        password: password,
      });

      if (response.success && response.data?.token) {
        const { token, user } = response.data;
        apiClient.setToken(token);

        const safeUser: User = {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        };

        apiClient.setStoredUser(safeUser);
        storage.setCurrentUser(safeUser);
        return { success: true, user: safeUser };
      } else if (response.error && !response.error.includes('Could not reach backend')) {
        // Backend actively returned an authentication or validation error
        return { success: false, error: response.error };
      }
    } catch (err) {
      console.warn('Backend login attempt encountered exception:', err);
    }

    // 2. Fallback to local accounts if backend is not yet started
    const users = storage.getUsers();
    const localUser = users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail &&
        (u.passwordHash === password ||
          (u.email === 'admin@savya.com' && password === 'Admin123') ||
          (u.email === 'sales@savya.com' && password === 'Sales123'))
    );

    if (!localUser) {
      return {
        success: false,
        error: 'Invalid email or password. Please use the demo credentials.',
      };
    }

    const { passwordHash: _, ...safeUser } = localUser;
    apiClient.setToken('demo-local-jwt-token-fallback');
    apiClient.setStoredUser(safeUser);
    storage.setCurrentUser(safeUser);
    return { success: true, user: safeUser };
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    apiClient.clearSession();
    storage.setCurrentUser(null);
  },

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  },

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'ADMIN';
  },

  isSales(): boolean {
    return this.getCurrentUser()?.role === 'SALES';
  },

  hasRole(role: UserRole): boolean {
    return this.getCurrentUser()?.role === role;
  },

  switchDemoUser(email: string): User | null {
    const users = storage.getUsers();
    const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (target) {
      const { passwordHash: _, ...safeUser } = target;
      apiClient.setToken(`demo-token-${safeUser.role.toLowerCase()}`);
      apiClient.setStoredUser(safeUser);
      storage.setCurrentUser(safeUser);
      return safeUser;
    }
    return null;
  },
};
