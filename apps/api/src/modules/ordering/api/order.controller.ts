import { Controller, ForbiddenException, Get, Inject, Param, Query, Req, UnauthorizedException } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { OrderDto } from '../application/order.dto';
import { OrderQueryService } from '../application/order-query.service';

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedOrdersResponse {
  orders: OrderDto[];
  total: number;
  page: number;
}

@Controller('orders')
export class OrderController {
  constructor(@Inject(OrderQueryService) private readonly query: OrderQueryService) {}

  private requireAdmin(request: { user?: unknown }): void {
    const user = request.user;
    if (!user || typeof user !== 'object') throw new UnauthorizedException('Authentication required');
    if (!('role' in user) || user.role !== 'admin') throw new ForbiddenException('Admin role required');
  }

  @Get()
  async listOrders(
    @Req() request: { user?: unknown },
    @Query() query: PaginationQuery,
  ): Promise<PaginatedOrdersResponse> {
    this.requireAdmin(request);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const { orders, total } = await this.query.listOrders(page, limit);
    return { orders, total, page };
  }

  @Get(':id')
  async getOrder(
    @Req() request: { user?: unknown },
    @Param('id') id: string,
  ): Promise<OrderDto> {
    this.requireAdmin(request);
    const order = await this.query.findById(id);
    if (!order) throw new DomainError('ORDER_NOT_FOUND', `Order ${id} not found`, { orderId: id });
    return order;
  }
}
