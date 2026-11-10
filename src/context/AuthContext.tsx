import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authService } from '../services/authService';
import { initializeStorageIfNeeded } from '../utils/storage';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSales: boolean;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void> | void;
  switchDemoUser: (email: string) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeStorageIfNeeded();
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    setIsReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setCurrentUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error || 'Authentication failed' };
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
  };

  const switchDemoUser = (email: string) => {
    const user = authService.switchDemoUser(email);
    if (user) {
      setCurrentUser(user);
    }
  };

  const refreshUser = () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Initializing system...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.role === 'ADMIN',
        isSales: currentUser?.role === 'SALES',
        role: currentUser?.role || null,
        login,
        logout,
        switchDemoUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
