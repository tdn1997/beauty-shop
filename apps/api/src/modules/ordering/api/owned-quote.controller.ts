import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../iam/api/auth.guard';
import { validateQuoteRequestBody } from '../../pricing/api/quote.request';
import { CustomerProfileService } from '../application/customer-profile.service';
@Controller('quote')
export class OwnedQuoteController {
  constructor(private readonly profile: CustomerProfileService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.profile.quote(req.user!.id, validateQuoteRequestBody(body));
  }
  @Get('preview') preview(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    return this.profile.quote(req.user!.id, validateQuoteRequestBody(query));
  }
}
