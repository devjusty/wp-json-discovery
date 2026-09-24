import type { ReactNode } from 'react';
import { AppShell, type ShellNavigation } from './AppShell';

type AdminShellProps = Readonly<{
  navigation: ShellNavigation;
  commands: Readonly<{ onNavigate: (id: string) => void }>;
  children: ReactNode;
}>;

export function AdminShell({ navigation, commands, children }: AdminShellProps) {
  return <AppShell navigation={navigation} commands={commands} title="Admin workspace" navigationLabel="Admin navigation" contentLandmark="div">{children}</AppShell>;
}
