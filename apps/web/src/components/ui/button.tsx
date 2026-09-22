import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Spinner } from './spinner';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'|'lg'; block?: boolean; loading?: boolean; children: ReactNode };
export function Button({ variant='primary', size='md', block=false, loading=false, className, disabled, children, ...props }: Props) {
  return <button className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading && <Spinner />}{children}</button>;
}
