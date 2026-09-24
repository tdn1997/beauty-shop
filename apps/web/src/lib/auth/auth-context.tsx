'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
export type User = { id: string; displayName: string; email: string; role: 'CUSTOMER' | 'ADMIN' };
export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'INVALID_CREDENTIALS' | 'THROTTLED' | 'UNAVAILABLE' };
type AuthValue = {
  user: User | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<boolean>;
};
const C = createContext<AuthValue>({
  user: null,
  loading: true,
  error: false,
  refresh: async () => {},
  signIn: async () => ({ ok: false, reason: 'UNAVAILABLE' }),
  signOut: async () => false,
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  // Mỗi thao tác lấy một số thứ tự; phản hồi của thao tác cũ hơn (vd. refresh lúc focus
  // đang bay khi vừa đăng nhập xong) bị bỏ, không được ghi đè trạng thái mới.
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      if (mine !== seq.current) return;
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
      if (mine !== seq.current) return;
      setUser(null);
      setError(true);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);
  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const mine = ++seq.current;
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (r.status === 429) return { ok: false, reason: 'THROTTLED' };
      if (r.status === 401 || r.status === 400) return { ok: false, reason: 'INVALID_CREDENTIALS' };
      if (!r.ok) return { ok: false, reason: 'UNAVAILABLE' };
      const signedIn: User = (await r.json()).user;
      if (mine === seq.current) {
        setUser(signedIn);
        setError(false);
        setLoading(false);
      }
      return { ok: true, user: signedIn };
    } catch {
      return { ok: false, reason: 'UNAVAILABLE' };
    }
  }, []);
  const signOut = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) return false;
      if (mine === seq.current) setUser(null);
      return true;
    } catch {
      return false;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  return (
    <C.Provider value={{ user, loading, error, refresh, signIn, signOut }}>{children}</C.Provider>
  );
}
export const useAuth = () => useContext(C);
