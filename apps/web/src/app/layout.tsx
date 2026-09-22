import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { CartProvider } from '@/lib/cart-context';
import SiteHeader from '@/components/site-header';

const font = Be_Vietnam_Pro({ subsets: ['latin','vietnamese'], weight: ['400','500','600','700'], display: 'swap', variable: '--font-be-vietnam' });
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#c43d6a' };
export const metadata: Metadata = { title: 'BeautyShop', description: 'Cửa hàng mỹ phẩm', applicationName: 'BeautyShop', openGraph: { title: 'BeautyShop', description: 'Cửa hàng mỹ phẩm', locale: 'vi_VN', type: 'website' } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="vi" className={font.variable}><body><AuthProvider><CartProvider><a className="skip-link" href="#main">Chuyển đến nội dung chính</a><SiteHeader/>{children}<footer className="site-footer">© BeautyShop · Mỹ phẩm dành cho bạn</footer></CartProvider></AuthProvider></body></html>; }
