import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';

const TOKEN_KEY = 'swms_token';
const USER_KEY = 'swms_user';

const AuthContext = createContext(null);

// Maps a role to its landing route.
export function homePathForRole(role) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'worker':
      return '/worker';
    case 'user':
      return '/dashboard';
    default:
      return '/';
  }
}

// Persist (or clear) the session in localStorage.
function persistSession(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage access errors.
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on mount, then refresh the user from the server.
  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = readStoredUser();

    if (!storedToken) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setToken(storedToken);
    if (storedUser) setUser(storedUser);

    authService
      .getMe()
      .then((data) => {
        if (!active) return;
        const freshUser = data?.user || null;
        setUser(freshUser);
        persistSession(storedToken, freshUser);
      })
      .catch(() => {
        if (!active) return;
        persistSession(null, null);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login({ email, password });
    const nextToken = data?.token || null;
    const nextUser = data?.user || null;
    persistSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    const nextToken = data?.token || null;
    const nextUser = data?.user || null;
    persistSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    persistSession(null, null);
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const data = await authService.updateProfile(payload);
    const nextUser = data?.user || null;
    setUser(nextUser);
    persistSession(localStorage.getItem(TOKEN_KEY), nextUser);
    return nextUser;
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await authService.getMe();
    const nextUser = data?.user || null;
    setUser(nextUser);
    persistSession(localStorage.getItem(TOKEN_KEY), nextUser);
    return nextUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user,
      role: user?.role || null,
      login,
      register,
      logout,
      updateProfile,
      refreshUser
    }),
    [user, token, loading, login, register, logout, updateProfile, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
