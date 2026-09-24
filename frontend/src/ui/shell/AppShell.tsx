import type { ReactNode } from 'react';
import { BrandMark } from '../brand/BrandMark';

export type ShellNavigationItem = Readonly<{
  id: string;
  label: string;
  disabled?: boolean;
}>;

export type ShellNavigation = Readonly<{
  items: ReadonlyArray<ShellNavigationItem>;
  activeId: string;
}>;

export type AppShellProps = Readonly<{
  navigation: ShellNavigation;
  commands: Readonly<{ onNavigate: (id: string) => void }>;
  children: ReactNode;
  title?: string;
  navigationLabel?: string;
  contentLandmark?: 'main' | 'div';
  headerActions?: ReactNode;
  authActions?: ReactNode;
}>;

export function AppShell({ navigation, commands, children, title = 'WP JSON Discovery', navigationLabel = 'Primary navigation', contentLandmark = 'main', headerActions, authActions }: AppShellProps) {
  const Content = contentLandmark;
  const hasNavigation = navigation.items.length > 0;
  const hasHeaderActions = headerActions || authActions;

  return (
    <div className="investigation-shell">
      <header className="investigation-shell__header">
        <div className="investigation-shell__brand">
          <BrandMark className="investigation-shell__mark" />
          <p className="investigation-shell__eyebrow">{title}</p>
        </div>
        {hasNavigation ? (
          <nav aria-label={navigationLabel} className="investigation-shell__nav">
            {navigation.items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === navigation.activeId ? 'investigation-shell__nav-link is-active' : 'investigation-shell__nav-link'}
                aria-current={item.id === navigation.activeId ? 'page' : undefined}
                disabled={item.disabled}
                onClick={() => commands.onNavigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
        {hasHeaderActions ? <div className="investigation-shell__actions" role="group" aria-label="Header actions">
          {headerActions}
          {authActions ? <div className="investigation-shell__auth-actions">{authActions}</div> : null}
        </div> : null}
      </header>
      <Content className="investigation-shell__main">{children}</Content>
    </div>
  );
}
