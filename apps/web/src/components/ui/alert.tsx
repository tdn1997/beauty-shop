import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
export function Alert({ tone, title, children }: { tone: 'success'|'warn'|'danger'|'info'; title?: string; children: ReactNode }) {
  return <div className={cx('alert', `alert--${tone}`)} role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}>{title && <div className="alert__title">{title}</div>}<div>{children}</div></div>;
}
