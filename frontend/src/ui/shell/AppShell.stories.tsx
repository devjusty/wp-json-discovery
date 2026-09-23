import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './AppShell';

const meta = { title: 'Shell/App shell', component: AppShell } satisfies Meta<typeof AppShell>;
export default meta;
export const Default: StoryObj<typeof meta> = { args: { navigation: { items: [{ id: 'scan', label: 'Scan' }, { id: 'admin', label: 'Admin' }], activeId: 'scan' }, commands: { onNavigate: () => undefined }, children: 'Shell content' } };
