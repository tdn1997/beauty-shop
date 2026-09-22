'use client';
import { useState } from 'react';
import { OrderDto, OrdersResponse } from '@/lib/types/admin';
import { formatMoney } from '@/lib/format';
import OrderStatusBadge from '@/components/order-status-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
export default function OrdersTable({ initialData }: { initialData: OrdersResponse }) {
  const [orders] = useState<OrderDto[]>([...initialData.orders]);
  return (
    <section>
      <header className="admin-toolbar">
        <h1 className="page-title">Quản lý đơn hàng</h1>
        <Badge>{initialData.total} đơn hàng</Badge>
      </header>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Danh sách đơn hàng</caption>
          <thead>
            <tr>
              <th scope="col">Mã đơn</th>
              <th scope="col">Khách hàng</th>
              <th scope="col">Trạng thái</th>
              <th scope="col" className="num">
                Tổng cộng
              </th>
              <th scope="col" className="num">
                Số dòng
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="Không có đơn hàng nào" />
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="mono truncate" title={order.id}>
                      {order.id}
                    </span>
                  </td>
                  <td>{order.customerId}</td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="num price">{formatMoney(order.grandTotal)}</td>
                  <td className="num">{order.lines.length}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
