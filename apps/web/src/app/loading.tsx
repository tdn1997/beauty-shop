import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return (
    <main id="main" className="container">
      <Skeleton />
      <div className="product-grid" style={{ marginTop: '1.5rem' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div className="card card__body stack gap-3" key={i}>
            <Skeleton className="skeleton--thumb" />
            <Skeleton />
            <Skeleton />
          </div>
        ))}
      </div>
    </main>
  );
}
