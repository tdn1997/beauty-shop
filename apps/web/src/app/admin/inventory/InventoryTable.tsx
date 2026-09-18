'use client';

import { useState } from 'react';
import { InventoryResponse, InventoryLotDto } from '@/lib/types/admin';
import { formatDateOnly } from '@/lib/format';

const PAGE_SIZE = 20;

function getAvailableColor(available: number): string {
  if (available > 10) return '#15803d';
  if (available >= 1) return '#ca8a04';
  return '#b91c1c';
}

function getAvailableBg(available: number): string {
  if (available > 10) return '#dcfce7';
  if (available >= 1) return '#fef9c3';
  return '#fee2e2';
}

interface Props {
  initialData: InventoryResponse;
}

export default function InventoryTable({ initialData }: Props) {
  const [data, setData] = useState<InventoryResponse>(initialData);
  const [page, setPage] = useState(initialData.page);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  const totals = data.lots.reduce(
    (acc, lot) => ({
      onHand: acc.onHand + lot.onHand,
      reserved: acc.reserved + lot.reserved,
      available: acc.available + lot.available,
    }),
    { onHand: 0, reserved: 0, available: 0 },
  );

  async function loadPage(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?page=${p}&limit=${PAGE_SIZE}`);
      const json: InventoryResponse = await res.json();
      setData(json);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Kho hàng</h1>
      <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>
        Tổng cộng: <strong>{data.total}</strong> lô hàng
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 16, padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}>
        <div>
          <span style={{ color: '#6b7280' }}>Tổng Vật lý: </span>
          <strong>{totals.onHand.toLocaleString()}</strong>
        </div>
        <div>
          <span style={{ color: '#6b7280' }}>Tổng Đã giữ: </span>
          <strong>{totals.reserved.toLocaleString()}</strong>
        </div>
        <div>
          <span style={{ color: '#6b7280' }}>Tổng Khả dụng: </span>
          <strong style={{ color: getAvailableColor(totals.available) }}>{totals.available.toLocaleString()}</strong>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <TH>Lot ID</TH>
              <TH>Variant ID</TH>
              <TH>Mã lô</TH>
              <TH style={{ textAlign: 'right' }}>Vật lý</TH>
              <TH style={{ textAlign: 'right' }}>Đã giữ</TH>
              <TH style={{ textAlign: 'right' }}>Khả dụng</TH>
              <TH>Hết hạn</TH>
              <TH>Trạng thái</TH>
              <TH style={{ textAlign: 'right' }}>Ver</TH>
            </tr>
          </thead>
          <tbody>
            {data.lots.map((lot) => (
              <InventoryRow key={lot.id} lot={lot} />
            ))}
            {data.lots.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#999' }}>
                  Không có lô hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button
          onClick={() => loadPage(page - 1)}
          disabled={page <= 1 || loading}
          style={btnStyle(page <= 1)}
        >
          ← Trước
        </button>
        <span style={{ fontSize: 14 }}>
          Trang {page} / {totalPages || 1}
        </span>
        <button
          onClick={() => loadPage(page + 1)}
          disabled={page >= totalPages || loading}
          style={btnStyle(page >= totalPages)}
        >
          Sau →
        </button>
      </div>
    </div>
  );
}

function InventoryRow({ lot }: { lot: InventoryLotDto }) {
  const availableColor = getAvailableColor(lot.available);
  const availableBg = getAvailableBg(lot.available);

  const isExpired = lot.expiresOn ? new Date(lot.expiresOn) < new Date() : false;

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <TD><code style={{ fontSize: 12 }}>{lot.id.slice(0, 8)}…</code></TD>
      <TD><code style={{ fontSize: 12 }}>{lot.variantId.slice(0, 8)}…</code></TD>
      <TD><code style={{ fontSize: 12 }}>{lot.lotCode}</code></TD>
      <TD style={{ textAlign: 'right' }}>{lot.onHand.toLocaleString()}</TD>
      <TD style={{ textAlign: 'right', color: '#6b7280' }}>{lot.reserved.toLocaleString()}</TD>
      <TD style={{ textAlign: 'right' }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 6,
          fontWeight: 600,
          color: availableColor,
          background: availableBg,
          minWidth: 40,
          textAlign: 'center',
        }}>
          {lot.available.toLocaleString()}
        </span>
      </TD>
      <TD style={{ color: isExpired ? '#b91c1c' : '#374151' }}>
        {formatDateOnly(lot.expiresOn)}
      </TD>
      <TD>
        {lot.blocked ? (
          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 12 }}>
            Khoá
          </span>
        ) : (
          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#dcfce7', color: '#15803d', fontSize: 12 }}>
            OK
          </span>
        )}
      </TD>
      <TD style={{ textAlign: 'right' }}><code style={{ fontSize: 12 }}>v{lot.version}</code></TD>
    </tr>
  );
}

function TH({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', ...style }}>
      {children}
    </th>
  );
}

function TD({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', ...style }}>
      {children}
    </td>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: disabled ? '#f3f4f6' : '#fff',
    color: disabled ? '#9ca3af' : '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
  };
}
