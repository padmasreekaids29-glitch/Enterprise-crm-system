import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  apiRequest,
  getStoredToken,
  registerUnauthorizedHandler,
  setStoredToken,
} from '../services/api.ts';
import type { AuthUser, DirectoryUser, UserRole } from '../types/crm.ts';

interface AuthContextValue {
  user: AuthUser | null;
  directory: DirectoryUser[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    title?: string;
    department?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateLocalUser: (next: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setDirectory([]);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(clearSession);
  }, [clearSession]);

  const loadDirectory = useCallback(async () => {
    try {
      const res = await apiRequest<{ success: boolean; users: DirectoryUser[] }>(
        '/api/auth/users-directory'
      );
      setDirectory(res.users);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ success: boolean; user: AuthUser }>('/api/auth/me');
      setUser(data.user);
      await loadDirectory();
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession, loadDirectory]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ success: boolean; token: string; user: AuthUser }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    setStoredToken(data.token);
    setUser(data.user);
    await loadDirectory();
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    title?: string;
    department?: string;
  }) => {
    const data = await apiRequest<{ success: boolean; token: string; user: AuthUser }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    setStoredToken(data.token);
    setUser(data.user);
    await loadDirectory();
  };

  const logout = async () => {
    try {
      if (getStoredToken()) {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // Proceed with local cleanup
    } finally {
      clearSession();
    }
  };

  const updateLocalUser = (next: AuthUser) => {
    setUser(next);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        directory,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateLocalUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
