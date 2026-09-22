import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, type Principal } from '../application/auth.service';
export const Public = () => SetMetadata('public', true);
export interface AuthenticatedRequest {
  headers: Record<string, string | undefined>;
  user?: Principal;
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const principal = await this.auth.authenticate(token);
    if (!principal) throw new UnauthorizedException('Authentication required');
    req.user = principal;
    return true;
  }
}
