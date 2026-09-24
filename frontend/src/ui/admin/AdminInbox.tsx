import type { ReactNode } from 'react';

export type AdminInboxItemKind =
  | 'unsupported-namespace'
  | 'discovered-asset'
  | 'failed-scan'
  | 'maintenance';

export type AdminInboxItem = Readonly<{
  id: string;
  kind: AdminInboxItemKind;
  title: string;
  status: string;
  evidence: ReactNode;
  action: Readonly<{
    label: string;
    onSelect: () => void;
  }>;
  priority: number;
}>;

type AdminInboxProps = Readonly<{
  items: ReadonlyArray<AdminInboxItem>;
}>;

export function AdminInbox({ items }: AdminInboxProps) {
  const orderedItems = [...items].sort((left, right) => left.priority - right.priority);

  return (
    <section className="section" aria-labelledby="admin-inbox-heading">
      <div className="card">
        <header className="card__header">
          <div>
            <h2 id="admin-inbox-heading">Operational inbox</h2>
            <p className="card__meta">Evidence-backed items requiring focused review.</p>
          </div>
        </header>
        {orderedItems.length ? (
          <ol className="admin-inbox" aria-label="Operational inbox items">
            {orderedItems.map((item) => (
              <li key={item.id} className="admin-inbox__item" data-item-id={item.id}>
                <div className="admin-inbox__content">
                  <div className="admin-inbox__heading">
                    <h3>{item.title}</h3>
                    <span className="tag" data-status={item.status}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="card__meta">{item.evidence}</p>
                </div>
                <button type="button" className="button button--ghost button--sm" onClick={item.action.onSelect}>
                  {item.action.label}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="card__meta">No operational items require attention.</p>
        )}
      </div>
    </section>
  );
}
