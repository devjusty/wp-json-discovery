import type { Meta, StoryObj } from '@storybook/react-vite';
import { AdminShell } from './AdminShell';

const meta = { title: 'Shell/Admin shell', component: AdminShell } satisfies Meta<typeof AdminShell>;
export default meta;
export const ReviewQueue: StoryObj<typeof meta> = { args: { navigation: { items: [{ id: 'queue', label: 'Review queue' }], activeId: 'queue' }, commands: { onNavigate: () => undefined }, children: 'Admin content' } };
