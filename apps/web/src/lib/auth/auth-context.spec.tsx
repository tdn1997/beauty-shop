import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth, type SignInResult } from './auth-context';

const customer = { id: 'c1', email: 'c@x', displayName: 'Nguyễn Văn A', role: 'CUSTOMER' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return (
    <span data-testid="who">{api.loading ? 'loading' : (api.user?.displayName ?? 'guest')}</span>
  );
}
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function renderAsGuest() {
  fetchMock.mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED' }));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest'));
}

describe('AuthProvider', () => {
  it('should show the signed-in user immediately after a successful sign-in', async () => {
    // arrange
    await renderAsGuest();
    fetchMock.mockResolvedValueOnce(json(200, { user: customer }));
    // act
    let result: SignInResult | undefined;
    await act(async () => {
      result = await api.signIn('c@x', 'secret');
    });
    // assert
    expect(result).toEqual({ ok: true, user: customer });
    expect(screen.getByTestId('who')).toHaveTextContent('Nguyễn Văn A');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('should stay signed out and report throttling on 429', async () => {
    // arrange
    await renderAsGuest();
    fetchMock.mockResolvedValueOnce(json(429, { code: 'TOO_MANY_ATTEMPTS' }));
    // act
    let result: SignInResult | undefined;
    await act(async () => {
      result = await api.signIn('c@x', 'wrong');
    });
    // assert
    expect(result).toEqual({ ok: false, reason: 'THROTTLED' });
    expect(screen.getByTestId('who')).toHaveTextContent('guest');
  });
  it('should report invalid credentials on 401', async () => {
    // arrange
    await renderAsGuest();
    fetchMock.mockResolvedValueOnce(json(401, { code: 'INVALID_CREDENTIALS' }));
    // act
    let result: SignInResult | undefined;
    await act(async () => {
      result = await api.signIn('c@x', 'wrong');
    });
    // assert
    expect(result).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
  });
  it('should report unavailability when the network fails', async () => {
    // arrange
    await renderAsGuest();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    // act
    let result: SignInResult | undefined;
    await act(async () => {
      result = await api.signIn('c@x', 'secret');
    });
    // assert
    expect(result).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(screen.getByTestId('who')).toHaveTextContent('guest');
  });
  it('should clear the user immediately after sign-out', async () => {
    // arrange
    await renderAsGuest();
    fetchMock.mockResolvedValueOnce(json(200, { user: customer }));
    await act(async () => void (await api.signIn('c@x', 'secret')));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    // confirm
    expect(screen.getByTestId('who')).toHaveTextContent('Nguyễn Văn A');
    // act
    let ok = false;
    await act(async () => {
      ok = await api.signOut();
    });
    // assert
    expect(ok).toBe(true);
    expect(screen.getByTestId('who')).toHaveTextContent('guest');
  });
  it('should keep the user when sign-out fails', async () => {
    // arrange
    await renderAsGuest();
    fetchMock.mockResolvedValueOnce(json(200, { user: customer }));
    await act(async () => void (await api.signIn('c@x', 'secret')));
    fetchMock.mockResolvedValueOnce(json(503, { code: 'LOGOUT_FAILED' }));
    // act
    let ok = true;
    await act(async () => {
      ok = await api.signOut();
    });
    // assert
    expect(ok).toBe(false);
    expect(screen.getByTestId('who')).toHaveTextContent('Nguyễn Văn A');
  });
});
