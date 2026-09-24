import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthNav from './auth-nav';
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useRouter: vi.fn() }));
import { useAuth, type User } from '@/lib/auth/auth-context';
import { usePathname, useRouter } from 'next/navigation';
const mocked = vi.mocked(useAuth);
const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
const customer: User = { id: 'c', email: 'c@x', displayName: 'Customer', role: 'CUSTOMER' };
const admin: User = { id: 'a', email: 'a@x', displayName: 'Admin User', role: 'ADMIN' };
function auth(overrides: Partial<ReturnType<typeof useAuth>>) {
  mocked.mockReturnValue({
    user: null,
    loading: false,
    error: false,
    refresh: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
}
beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue('/');
  vi.mocked(useRouter).mockReturnValue(router as never);
  Object.values(router).forEach((f) => f.mockReset());
});
afterEach(cleanup);
describe('AuthNav', () => {
  it('should render neutral loading without privileged content', () => {
    // arrange
    auth({ loading: true });
    // act
    render(<AuthNav />);
    // assert
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Đăng nhập')).not.toBeInTheDocument();
  });
  it('should render login for anonymous session', () => {
    // arrange
    auth({});
    // act
    render(<AuthNav />);
    // assert
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
  it('should send the visitor back to the current page after login', () => {
    // arrange
    vi.mocked(usePathname).mockReturnValue('/cart');
    auth({});
    // act
    render(<AuthNav />);
    // assert
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Fcart',
    );
  });
  it('should hide Admin from customer', () => {
    // arrange
    auth({ user: customer });
    // act
    render(<AuthNav />);
    // assert
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
  it('should show Admin only for administrator', () => {
    // arrange
    auth({ user: admin });
    // act
    render(<AuthNav />);
    // assert
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
  it('should fail closed on session lookup error', () => {
    // arrange
    auth({ error: true });
    // act
    render(<AuthNav />);
    // assert
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
  it('should leave a protected page after signing out', async () => {
    // arrange
    vi.mocked(usePathname).mockReturnValue('/admin/orders');
    const signOut = vi.fn().mockResolvedValue(true);
    auth({ user: admin, signOut });
    render(<AuthNav />);
    // act
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' })));
    // assert
    expect(signOut).toHaveBeenCalledOnce();
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.refresh).toHaveBeenCalled();
  });
  it('should stay put and say so when signing out fails', async () => {
    // arrange
    auth({ user: customer, signOut: vi.fn().mockResolvedValue(false) });
    render(<AuthNav />);
    // act
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' })));
    // assert
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể đăng xuất');
  });
});
