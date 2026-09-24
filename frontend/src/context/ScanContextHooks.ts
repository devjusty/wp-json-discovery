import { useContext } from 'react';
import { ScanResultsContext, ScanShellContext } from './ScanContexts';

export function useScanShellContext() {
  const context = useContext(ScanShellContext);
  if (context === undefined) {
    throw new Error('useScanShellContext must be used within a ScanProvider');
  }
  return context;
}

export function useScanResultsContext() {
  const context = useContext(ScanResultsContext);
  if (context === undefined) {
    throw new Error('useScanResultsContext must be used within a ScanProvider');
  }
  return context;
}
