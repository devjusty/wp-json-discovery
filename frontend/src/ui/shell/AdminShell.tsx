import type { ReactNode } from 'react';
import { AppShell, type ShellNavigation } from './AppShell';

type AdminShellProps = Readonly<{
  navigation: ShellNavigation;
  commands: Readonly<{ onNavigate: (id: string) => void }>;
  headerActions?: ReactNode;
  authActions?: ReactNode;
  children: ReactNode;
}>;

export function AdminShell({ navigation, commands, headerActions, authActions, children }: AdminShellProps) {
  return <AppShell navigation={navigation} commands={commands} title="Admin workspace" navigationLabel="Admin navigation" contentLandmark="main" headerActions={headerActions} authActions={authActions}>{children}</AppShell>;
}
