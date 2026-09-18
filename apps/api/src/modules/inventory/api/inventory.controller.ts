import { Controller, ForbiddenException, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import { InventoryLotListDto, PaginatedInventoryLots } from './inventory.dto';
import { InventoryQueryService } from '../application/inventory-query.service';

export interface InventoryQuery {
  variantId?: string;
  page?: number;
  limit?: number;
}

@Controller('inventory')
export class InventoryController {
  constructor(@Inject(InventoryQueryService) private readonly query: InventoryQueryService) {}

  private requireAdmin(request: { user?: unknown }): void {
    const user = request.user;
    if (!user || typeof user !== 'object') throw new UnauthorizedException('Authentication required');
    if (!('role' in user) || user.role !== 'admin') throw new ForbiddenException('Admin role required');
  }

  @Get('lots')
  async listLots(
    @Req() request: { user?: unknown },
    @Query() query: InventoryQuery,
  ): Promise<InventoryLotListDto> {
    this.requireAdmin(request);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const { lots, total } = await this.query.listLots(query.variantId ?? null, page, limit);
    return { lots, total, page };
  }
}
