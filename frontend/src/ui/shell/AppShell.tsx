import type { ReactNode } from 'react';

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
}>;

export function AppShell({ navigation, commands, children, title = 'WP JSON Discovery', navigationLabel = 'Primary navigation' }: AppShellProps) {
  return (
    <div className="investigation-shell">
      <header className="investigation-shell__header">
        <p className="investigation-shell__eyebrow">{title}</p>
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
      </header>
      <main className="investigation-shell__main">{children}</main>
    </div>
  );
}
