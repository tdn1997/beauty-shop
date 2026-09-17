import type { ReactNode } from 'react';

export const metadata = {
  title: 'BeautyShop',
  description: 'Cửa hàng mỹ phẩm',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
