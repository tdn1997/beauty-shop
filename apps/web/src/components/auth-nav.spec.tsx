import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthNav from './auth-nav';
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/lib/auth/auth-context';
const mocked = vi.mocked(useAuth);
afterEach(cleanup);
describe('AuthNav', () => {
  it('should render neutral loading without privileged content', () => {
    mocked.mockReturnValue({ user: null, loading: true, error: false, refresh: vi.fn() });
    render(<AuthNav />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Đăng nhập')).not.toBeInTheDocument();
  });
  it('should render login for anonymous session', () => {
    mocked.mockReturnValue({ user: null, loading: false, error: false, refresh: vi.fn() });
    render(<AuthNav />);
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
  it('should hide Admin from customer', () => {
    mocked.mockReturnValue({
      user: { id: 'c', email: 'c@x', displayName: 'Customer', role: 'CUSTOMER' },
      loading: false,
      error: false,
      refresh: vi.fn(),
    });
    render(<AuthNav />);
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
  it('should show Admin only for administrator', () => {
    mocked.mockReturnValue({
      user: { id: 'a', email: 'a@x', displayName: 'Admin User', role: 'ADMIN' },
      loading: false,
      error: false,
      refresh: vi.fn(),
    });
    render(<AuthNav />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
  it('should fail closed on session lookup error', () => {
    mocked.mockReturnValue({ user: null, loading: false, error: true, refresh: vi.fn() });
    render(<AuthNav />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});
