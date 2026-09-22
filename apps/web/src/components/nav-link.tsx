'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';

export default function NavLink({ href, className, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const target = typeof href === 'string' ? href : href.pathname || '';
  const active = target.startsWith('/admin') ? pathname.startsWith(target) : pathname === target;
  return <Link href={href} className={className} aria-current={active ? 'page' : undefined} {...props} />;
}
