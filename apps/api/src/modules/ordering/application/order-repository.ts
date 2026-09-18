import { Result } from '../../shared/domain/result';
import { Order } from '../domain/order';
import { OrderDto, toOrderDto } from './order.dto';

export interface PaginatedOrders {
  orders: OrderDto[];
  total: number;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;

  list(page: number, limit: number): Promise<PaginatedOrders>;

  save(order: Order): Promise<Result<void>>;
}
