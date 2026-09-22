import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return (
    <section>
      <div className="admin-toolbar">
        <h1 className="page-title">Kho hàng</h1>
      </div>
      <div className="stat-grid">
        {Array.from({ length: 3 }, (_, i) => (
          <div className="stat" key={i}>
            <Skeleton />
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <TableSkeleton rows={10} cols={9} />
      </div>
    </section>
  );
}
