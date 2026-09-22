import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { MemoryLoginThrottle } from '../application/login-throttle';
import { AuthGuard, Public, type AuthenticatedRequest } from './auth.guard';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly throttle: MemoryLoginThrottle,
  ) {}
  @Public() @Post('login') async login(
    @Req() req: { socket?: { remoteAddress?: string } },
    @Body() body: unknown,
  ) {
    if (
      !body ||
      typeof body !== 'object' ||
      !('email' in body) ||
      !('password' in body) ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string'
    )
      throw new UnauthorizedException('Invalid email or password');
    const source = req.socket?.remoteAddress ?? 'unknown',
      account = body.email.trim().toLowerCase(),
      decision = this.throttle.consume(source, account);
    if (!decision.allowed)
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    const result = await this.auth.login(body.email, body.password);
    if (!result) throw new UnauthorizedException('Invalid email or password');
    this.throttle.success(source, account);
    return result;
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() req: AuthenticatedRequest) {
    return { user: req.user };
  }
  @Public() @Post('logout') @HttpCode(204) async logout(@Headers('authorization') header = '') {
    await this.auth.logout(header.startsWith('Bearer ') ? header.slice(7) : '');
  }
}
