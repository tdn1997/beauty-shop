import { Controller, Get, Inject, Post, Req, Body, Query } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { Result } from '../../shared/domain/result';
import { QuoteService } from '../application/quote.service';
import { QuoteRequestBody, validateQuoteRequestBody } from './quote.request';

@Controller('quote')
export class QuoteController {
  constructor(@Inject(QuoteService) private readonly quoteService: QuoteService) {}

  private async buildQuote(
    customerId: string,
    addressId: string,
    lines: { variantId: string; quantity: number }[],
  ): Promise<never> {
    const DEFAULT_PROVINCE = 'TPHCM';
    const province = DEFAULT_PROVINCE;
    const result = await this.quoteService.quoteFor({
      customerId,
      currency: 'VND',
      province,
      lines,
    });
    return result.match({
      ok: (quote) => quote.toDto() as never,
      err: (err) => { throw err; },
    });
  }

  @Post()
  async createQuote(
    @Req() request: { user?: unknown },
    @Body() body: unknown,
  ) {
    const user = request.user;
    if (!user || typeof user !== 'object' || !('customerId' in user) || typeof user.customerId !== 'string' || !user.customerId.trim()) {
      throw new DomainError('UNAUTHENTICATED', 'A trusted principal is required');
    }
    const { addressId, lines } = validateQuoteRequestBody(body);
    return this.buildQuote(user.customerId, addressId, lines);
  }

  @Get('preview')
  async previewQuote(
    @Req() request: { user?: unknown },
    @Query() query: unknown,
  ) {
    const user = request.user;
    if (!user || typeof user !== 'object' || !('customerId' in user) || typeof user.customerId !== 'string' || !user.customerId.trim()) {
      throw new DomainError('UNAUTHENTICATED', 'A trusted principal is required');
    }
    const { addressId, lines } = validateQuoteRequestBody(query);
    return this.buildQuote(user.customerId, addressId, lines);
  }
}
