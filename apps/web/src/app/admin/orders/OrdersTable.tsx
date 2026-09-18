'use client';
import { useState } from 'react';
import { OrderDto, OrdersResponse } from '@/lib/types/admin';
import { formatMoney, ORDER_STATUS_LABELS } from '@/lib/format';

interface OrdersTableProps {
  initialData: OrdersResponse;
}

export default function OrdersTable({ initialData }: OrdersTableProps) {
  const [orders] = useState<OrderDto[]>([...initialData.orders]);

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Quản lý đơn hàng</h1>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Mã đơn</th>
              <th style={{ padding: '8px 12px' }}>Khách hàng</th>
              <th style={{ padding: '8px 12px' }}>Trạng thái</th>
              <th style={{ padding: '8px 12px' }}>Tổng cộng</th>
              <th style={{ padding: '8px 12px' }}>Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  Không có đơn hàng nào
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>{order.id}</td>
                  <td style={{ padding: '12px' }}>{order.customerId}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      background: order.status === 'PAID' ? '#d1fae5' : order.status === 'CANCELLED' ? '#fee2e2' : '#f3f4f6',
                      color: order.status === 'PAID' ? '#065f46' : order.status === 'CANCELLED' ? '#991b1b' : '#374151',
                    }}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 500 }}>
                    {formatMoney(order.grandTotal)}
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>
                    {order.lines[0]?.subtotal ? '—' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, color: '#6b7280', fontSize: 13 }}>
        Tổng cộng: {initialData.total} đơn hàng
      </div>
    </main>
  );
}
