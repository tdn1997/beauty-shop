import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('skeleton', className)} aria-hidden="true" />;
}
export function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="skeleton-table" aria-label="Đang tải dữ liệu">
      {Array.from({ length: rows }, (_, r) => (
        <div className="skeleton-row" style={{ '--cols': cols } as CSSProperties} key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} />
          ))}
        </div>
      ))}
    </div>
  );
}
