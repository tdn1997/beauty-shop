import { expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard';
it('should ignore forged identity headers without a valid bearer token', async () => {
  const auth = { authenticate: vi.fn(async () => null) },
    reflector = { getAllAndOverride: vi.fn(() => false) },
    guard = new AuthGuard(auth as never, reflector as never),
    req = { headers: { 'x-user-id': 'admin', 'x-user-role': 'ADMIN' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => null,
    getClass: () => null,
  };
  await expect(guard.canActivate(context as never)).rejects.toMatchObject({ status: 401 });
  expect(auth.authenticate).toHaveBeenCalledWith('');
});
