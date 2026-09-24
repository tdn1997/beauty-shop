'use client';
import React, { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, type SignInResult } from '@/lib/auth/auth-context';
import { safeReturnPath } from '@/lib/auth/safe-return';

const FAILURE_MESSAGES: Record<Extract<SignInResult, { ok: false }>['reason'], string> = {
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  THROTTLED: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.',
  UNAVAILABLE: 'Không kết nối được máy chủ. Vui lòng thử lại sau.',
};
/** Chỉ hiện ở môi trường dev: tài khoản do seed tạo (mật khẩu trong apps/api/.env). */
const DEMO_ACCOUNTS =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        { email: 'customer@beautyshop.test', label: 'Khách hàng' },
        { email: 'admin@beautyshop.test', label: 'Quản trị' },
      ];

export default function Login() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const router = useRouter(),
    params = useSearchParams();
  const returnTo = safeReturnPath(params.get('returnTo'));
  const passwordRef = useRef<HTMLInputElement>(null);
  // Đã đăng nhập (vd. bấm Back về trang này) → không bắt nhập lại. Bỏ qua khi form
  // vừa submit thành công: submit() tự chuyển hướng, tránh replace hai lần.
  const alreadySignedIn = !!user && !loading;
  useEffect(() => {
    if (alreadySignedIn) router.replace(returnTo);
  }, [alreadySignedIn, returnTo, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn(email.trim(), password);
    if (result.ok) {
      // Context đã giữ user mới → navbar đổi ngay; refresh để server component
      // (vd. layout admin) đọc lại cookie phiên.
      router.replace(returnTo);
      router.refresh();
      return;
    }
    setLoading(false);
    setError(FAILURE_MESSAGES[result.reason]);
    if (result.reason === 'INVALID_CREDENTIALS') {
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  if (alreadySignedIn)
    return (
      <main id="main" className="container container--form">
        <p role="status" className="text-muted">
          Bạn đã đăng nhập — đang chuyển hướng…
        </p>
      </main>
    );

  return (
    <main id="main" className="container login">
      <div className="login__card">
        <aside className="login__art" aria-hidden="true">
          <img src="/products/prod-ceramide.jpg" alt="" />
          <div className="login__art-caption">
            <strong>BeautyShop</strong>
            <span>Dược mỹ phẩm chính hãng cho làn da khoẻ mỗi ngày.</span>
          </div>
        </aside>
        <form className="login__form" onSubmit={submit}>
          <div className="stack gap-2">
            <h1 className="page-title">Đăng nhập</h1>
            <p className="text-muted">
              {returnTo === '/checkout'
                ? 'Đăng nhập để tiếp tục thanh toán — giỏ hàng của bạn vẫn được giữ.'
                : 'Chào mừng bạn quay lại.'}
            </p>
          </div>
          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div className="field">
            <label className="label" htmlFor="password">
              Mật khẩu
            </label>
            <div className="password-field">
              <input
                ref={passwordRef}
                id="password"
                className="input"
                type={show ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-field__toggle"
                aria-pressed={show}
                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShow((s) => !s)}
              >
                {show ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>
          {error && (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          )}
          <button
            className="btn btn--primary btn--lg btn--block"
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          {DEMO_ACCOUNTS.length > 0 && (
            <div className="demo-accounts">
              <span className="text-sm text-muted">
                Tài khoản demo (mật khẩu trong apps/api/.env):
              </span>
              <div className="demo-accounts__list">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    className="pill"
                    onClick={() => {
                      setEmail(a.email);
                      passwordRef.current?.focus();
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Link className="text-sm text-muted" href="/">
            ← Quay lại cửa hàng
          </Link>
        </form>
      </div>
    </main>
  );
}
