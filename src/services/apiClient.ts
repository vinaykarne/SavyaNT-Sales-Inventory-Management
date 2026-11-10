/**
 * SavyaNT Sales Order & Inventory Management System
 * Centralized API Client
 *
 * Provides typed HTTP communication with Flask backend, JWT token injection,
 * automatic header resolution, error unwrapping, and server health probes.
 */

const TOKEN_KEY = 'savyant_jwt_token';
const USER_KEY = 'savyant_current_user';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
    pages?: number;
  };
  details?: any;
}

export const apiClient = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error('Failed to persist JWT token:', e);
    }
  },

  getStoredUser(): any | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setStoredUser(user: any | null): void {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.error('Failed to persist user profile:', e);
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  },

  async checkBackendHealth(): Promise<{ isOnline: boolean; environment?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        return { isOnline: true, environment: body?.data?.environment || 'development' };
      }
      return { isOnline: false };
    } catch {
      return { isOnline: false };
    }
  },

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Attach JWT Bearer token if available
    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Default to JSON body unless already FormData
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized / Token Expired
      if (response.status === 401) {
        this.clearSession();
      }

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok) {
        const errorMsg =
          json?.error ||
          json?.message ||
          `Request failed with status ${response.status} (${response.statusText})`;
        return {
          success: false,
          error: errorMsg,
          details: json?.details,
        };
      }

      return {
        success: json?.success ?? true,
        data: json?.data !== undefined ? json.data : json,
        message: json?.message,
        meta: json?.meta,
      };
    } catch (err: any) {
      console.warn(`[API Client] Connection error to ${url}:`, err);
      return {
        success: false,
        error: `Could not reach backend server at ${API_BASE_URL}. Ensure Flask server is running.`,
      };
    }
  },

  get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const filteredParams: Record<string, string> = {};
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          filteredParams[k] = String(v);
        }
      });
      const query = new URLSearchParams(filteredParams).toString();
      if (query) {
        url = `${endpoint}?${query}`;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  },

  post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data ?? {}),
    });
  },

  put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data ?? {}),
    });
  },

  delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  },

  upload<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};
