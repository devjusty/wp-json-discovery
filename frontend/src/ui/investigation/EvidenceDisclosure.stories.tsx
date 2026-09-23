import type { Meta, StoryObj } from '@storybook/react-vite';
import { EvidenceDisclosure } from './EvidenceDisclosure';
import type { Evidence } from '../../domain/investigation/model';

const evidence: Evidence[] = [{ id: 'observed', kind: 'observed', capability: 'homepage', value: 'WordPress', source: {} }, { id: 'trace', kind: 'request-trace', capability: 'homepage', value: 'Response received', source: { request: { method: 'GET', url: 'https://example.com/wp-json', status: 200 } } }];
const meta = { title: 'Investigation/Evidence disclosure', component: EvidenceDisclosure } satisfies Meta<typeof EvidenceDisclosure>;
export default meta;
export const Collapsed: StoryObj<typeof meta> = { args: { evidence, rawBody: '{"name":"example"}' } };
