import type { ReactNode } from 'react';
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="section-title">{title}</h2>
      {description && <p className="text-muted">{description}</p>}
      {action}
    </div>
  );
}
