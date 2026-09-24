import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './page';
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
import { useAuth, type User } from '@/lib/auth/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
const router = { replace: vi.fn(), refresh: vi.fn() };
const customer: User = { id: 'c', email: 'c@x', displayName: 'Nguyễn Văn A', role: 'CUSTOMER' };
function setup(opts: { user?: User | null; signIn?: ReturnType<typeof vi.fn>; returnTo?: string }) {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(opts.returnTo ? { returnTo: opts.returnTo } : {}) as never,
  );
  vi.mocked(useAuth).mockReturnValue({
    user: opts.user ?? null,
    loading: false,
    error: false,
    refresh: vi.fn(),
    signIn: opts.signIn ?? vi.fn(),
    signOut: vi.fn(),
  });
  render(<Login />);
}
async function submit(email = 'c@x', password = 'secret-123') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' })));
}
beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue(router as never);
  Object.values(router).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe('Login page', () => {
  it('should sign in through the auth context and return to the requested page', async () => {
    // arrange
    const signIn = vi.fn().mockResolvedValue({ ok: true, user: customer });
    setup({ signIn, returnTo: '/checkout' });
    // act
    await submit();
    // assert
    expect(signIn).toHaveBeenCalledWith('c@x', 'secret-123');
    expect(router.replace).toHaveBeenCalledWith('/checkout');
    expect(router.refresh).toHaveBeenCalled();
  });
  it('should ignore an off-site returnTo', async () => {
    // arrange
    setup({
      signIn: vi.fn().mockResolvedValue({ ok: true, user: customer }),
      returnTo: '//evil.example',
    });
    // act
    await submit();
    // assert
    expect(router.replace).toHaveBeenCalledWith('/');
  });
  it('should explain throttling and keep the visitor on the form', async () => {
    // arrange
    setup({ signIn: vi.fn().mockResolvedValue({ ok: false, reason: 'THROTTLED' }) });
    // act
    await submit();
    // assert
    expect(screen.getByRole('alert')).toHaveTextContent('quá nhiều lần');
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('should clear the password after invalid credentials but keep the email', async () => {
    // arrange
    setup({ signIn: vi.fn().mockResolvedValue({ ok: false, reason: 'INVALID_CREDENTIALS' }) });
    // act
    await submit('c@x', 'wrong-pass');
    // assert
    expect(screen.getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng');
    expect(screen.getByLabelText('Email')).toHaveValue('c@x');
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('');
  });
  it('should redirect an already signed-in visitor instead of showing the form', () => {
    // act
    setup({ user: customer, returnTo: '/cart' });
    // assert
    expect(router.replace).toHaveBeenCalledWith('/cart');
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument();
  });
});
