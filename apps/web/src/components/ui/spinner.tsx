import { cx } from '@/lib/cx';

export function Spinner({ size = 'md', label = 'Đang tải' }: { size?: 'md' | 'lg'; label?: string }) {
  return <span className={cx('spinner', size === 'lg' && 'spinner--lg')} role="status" aria-label={label} />;
}
