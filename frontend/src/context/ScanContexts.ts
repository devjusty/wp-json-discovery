import { createContext } from 'react';
import type { ScanResultsContextValue, ScanShellContextValue } from './ScanContext';

export const ScanShellContext = createContext<ScanShellContextValue | undefined>(undefined);
export const ScanResultsContext = createContext<ScanResultsContextValue | undefined>(undefined);
