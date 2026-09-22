'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
export type User = { id: string; displayName: string; email: string; role: 'CUSTOMER' | 'ADMIN' };
const C = createContext<{
  user: User | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}>({ user: null, loading: true, error: false, refresh: async () => {} });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      if (r.status === 401) {
        setUser(null);
        setError(false);
      } else if (r.ok) {
        setUser((await r.json()).user);
        setError(false);
      } else {
        setUser(null);
        setError(true);
      }
    } catch {
      setUser(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  return <C.Provider value={{ user, loading, error, refresh }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);
