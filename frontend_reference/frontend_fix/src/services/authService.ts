import { User, UserRole } from '../types';
import { storage } from '../utils/storage';

export const authService = {
  getCurrentUser(): User | null {
    return storage.getCurrentUser();
  },

  login(email: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = storage.getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === password
    );

    if (!user) {
      return {
        success: false,
        error: 'Invalid email or password. Please use the provided demo accounts.',
      };
    }

    const { passwordHash: _, ...safeUser } = user;
    storage.setCurrentUser(safeUser);
    return { success: true, user: safeUser };
  },

  logout(): void {
    storage.setCurrentUser(null);
  },

  isAuthenticated(): boolean {
    return !!storage.getCurrentUser();
  },

  isAdmin(): boolean {
    const user = storage.getCurrentUser();
    return user?.role === 'ADMIN';
  },

  isSales(): boolean {
    const user = storage.getCurrentUser();
    return user?.role === 'SALES';
  },

  hasRole(role: UserRole): boolean {
    const user = storage.getCurrentUser();
    return user?.role === role;
  },

  // Helper for quick role toggle in demo UI
  switchDemoUser(email: string): User | null {
    const users = storage.getUsers();
    const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (target) {
      const { passwordHash: _, ...safeUser } = target;
      storage.setCurrentUser(safeUser);
      return safeUser;
    }
    return null;
  },
};
