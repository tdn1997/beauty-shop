'use client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="container container--narrow">
      <div className="empty-state">
        <Alert tone="danger" title="Đã xảy ra lỗi">
          {error.message || 'Không thể tải trang.'}
        </Alert>
        <Button onClick={reset}>Thử lại</Button>
      </div>
    </main>
  );
}
