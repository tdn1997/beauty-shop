'use client';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeReturnPath } from '@/lib/auth/safe-return';
export default function Login() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const router = useRouter(),
    params = useSearchParams();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok)
        throw new Error(
          r.status === 429 ? 'Bạn đã thử quá nhiều lần.' : 'Email hoặc mật khẩu không đúng.',
        );
      router.replace(safeReturnPath(params.get('returnTo')));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đăng nhập.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <main id="main" className="container container--form">
      <form className="card card__body stack gap-4" onSubmit={submit}>
        <h1 className="page-title">Đăng nhập</h1>
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">Mật khẩu</span>
          <input
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Hiện
          mật khẩu
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
