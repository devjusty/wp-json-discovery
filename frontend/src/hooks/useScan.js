import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import toast from 'react-hot-toast';
import { upsertUnsupportedPlugin } from '../api/client.js';
import { logEvent } from '../services/logger.js';
import {
  getCapabilityById,
  getCapabilityDependencies,
  getCapabilityRunners,
  normalizeSelection
} from '../services/scanCapabilities.js';
import {
  createScanSession,
  executeScanSession,
  retryCapability as retrySessionCapability
} from '../services/scanSession.js';

export function useScan() {
  const { isAuthenticated } = useAuth0();
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const activeTokenRef = useRef(null);

  const createPorts = (token) => ({
    isAuthenticated,
    upsertUnsupportedPlugin,
    invalidateQueries: (query) => queryClient.invalidateQueries(query),
    logEvent,
    toastError: (message) => toast.error(message),
    isActive: () => isCurrent(token)
  });

  const isCurrent = (token) => token.active && activeTokenRef.current === token;
  const publishSession = (nextSession, token, updatedCapabilityIds = [], replace = false) => {
    if (!isCurrent(token)) {
      return null;
    }
    const mergedSession = replace
      ? nextSession
      : mergeSession(sessionRef.current, nextSession, updatedCapabilityIds);
    sessionRef.current = mergedSession;
    setSession(mergedSession);
    return mergedSession;
  };

  const invokeSettledOutcomes = async (nextSession, capabilityIds, token) => {
    if (!isCurrent(token) || !nextSession) {
      return;
    }
    token.settledOutcomes = token.settledOutcomes ?? new Set();
    token.outcomePromises = token.outcomePromises ?? [];
    const ports = createPorts(token);

    for (const id of capabilityIds) {
      const state = nextSession.capabilities[id];
      if (!isTerminal(state?.status) || token.settledOutcomes.has(id)) {
        continue;
      }
      token.settledOutcomes.add(id);
      const onSettled = getCapabilityById(id)?.onSettled;
      if (typeof onSettled !== 'function') {
        continue;
      }
      token.outcomePromises.push(
        Promise.resolve().then(() => {
          if (!isCurrent(token)) {
            return undefined;
          }
          return onSettled(state, nextSession, ports);
        })
      );
    }

    await Promise.all(token.outcomePromises);
  };

  const notifySessionCompletion = (nextSession, capabilityIds, token) => {
    if (!isCurrent(token) || token.completionNoticeReported || !nextSession) {
      return;
    }
    token.completionNoticeReported = true;

    const states = capabilityIds
      .map((id) => nextSession.capabilities[id])
      .filter(Boolean);
    const failed = states.filter(({ status }) => ['failed', 'unavailable'].includes(status));
    if (failed.length === 0) {
      toast.success(`Scan complete for ${nextSession.domain}`);
      return;
    }

    const authFailure = failed.find(({ error }) => error?.code === 'auth_required');
    if (authFailure) {
      toast.error('Authentication required: REST API access is restricted on this site.');
      return;
    }

    const firstMessage = failed[0]?.error?.message;
    toast.error(firstMessage
      ? `Scan finished with issues for ${nextSession.domain}: ${firstMessage}`
      : `Scan finished with issues for ${nextSession.domain}`);
  };

  const execute = async (nextSession, capabilityIds, token) => {
    token.completionNoticeReported = false;
    const completed = await executeScanSession(
      nextSession,
      getCapabilityRunners(capabilityIds),
      (changedSession) => {
        const published = publishSession(changedSession, token, capabilityIds);
        if (published) {
          void invokeSettledOutcomes(published, capabilityIds, token);
        }
      },
      token
    );
    if (!isCurrent(token)) {
      return completed;
    }
    const published = publishSession(completed, token, capabilityIds);
    await invokeSettledOutcomes(published, capabilityIds, token);
    if (isCurrent(token) && published) {
      notifySessionCompletion(published, capabilityIds, token);
    }
    return completed;
  };

  const startScan = (domain, selection) => {
    if (activeTokenRef.current) {
      activeTokenRef.current.active = false;
    }
    const token = { active: true };
    activeTokenRef.current = token;
    const nextSession = createScanSession(domain, selection, getCapabilityDependencies());
    publishSession(nextSession, token, nextSession.selection.capabilityIds, true);
    logEvent('scan.started', { domain, triggeredAt: new Date().toISOString() });
    return execute(nextSession, nextSession.selection.capabilityIds, token);
  };

  const runCapability = (id, options = {}) => {
    const current = sessionRef.current;
    const token = activeTokenRef.current;
    const capability = getCapabilityById(id);
    const currentState = current?.capabilities?.[id];
    if (!current || !token || !isCurrent(token) || !capability?.availability() || ['queued', 'running'].includes(currentState?.status)) {
      return Promise.resolve(current);
    }

    const selection = normalizeSelection({
      capabilityIds: [...current.selection.capabilityIds, id],
      options: {
        ...current.selection.options,
        [id]: { ...current.selection.options[id], ...options }
      }
    });
    const nextSession = createScanSession(current.domain, selection, getCapabilityDependencies());
    nextSession.capabilities = {
      ...nextSession.capabilities,
      ...current.capabilities,
      [id]: { status: 'idle', result: null, error: null }
    };
    nextSession.overallStatus = 'running';
    token.settledOutcomes?.delete(id);
    publishSession(nextSession, token, [id]);
    return execute(nextSession, [id], token);
  };

  const retryCapability = async (id) => {
    const current = sessionRef.current;
    const token = activeTokenRef.current;
    if (!current || !token || !isCurrent(token)) {
      return current;
    }
    token.settledOutcomes?.delete(id);
    token.completionNoticeReported = false;
    const completed = await retrySessionCapability(
      current,
      id,
      getCapabilityRunners([id]),
      (changedSession) => {
        const published = publishSession(changedSession, token, [id]);
        if (published) {
          void invokeSettledOutcomes(published, [id], token);
        }
      },
      token
    );
    if (!isCurrent(token)) {
      return completed;
    }
    const published = publishSession(completed, token, [id]);
    await invokeSettledOutcomes(published, [id], token);
    if (isCurrent(token) && published) {
      notifySessionCompletion(published, [id], token);
    }
    return completed;
  };

  return {
    session,
    startScan,
    runCapability,
    retryCapability,
    activeDomain: session?.domain ?? '',
    isScanning: session?.overallStatus === 'running'
  };
}

export function mergeSession(current, next, updatedCapabilityIds) {
  if (!current || current.domain !== next.domain) {
    return next;
  }

  const updatedIds = new Set(updatedCapabilityIds);
  const capabilityIds = Array.from(new Set([
    ...current.selection.capabilityIds,
    ...next.selection.capabilityIds
  ])).sort();
  const capabilities = Object.fromEntries(capabilityIds.map((id) => {
    const currentCapability = current.capabilities[id];
    const nextCapability = next.capabilities[id];
    const capability = !nextCapability || (!updatedIds.has(id) && currentCapability)
      ? currentCapability
      : nextCapability;
    return [id, capability];
  }));

  return {
    ...next,
    selection: {
      capabilityIds,
      options: { ...current.selection.options, ...next.selection.options }
    },
    capabilities,
    overallStatus: getOverallStatus(capabilities)
  };
}

function isTerminal(status) {
  return ['success', 'failed', 'unavailable'].includes(status);
}

function getOverallStatus(capabilities) {
  const states = Object.values(capabilities);
  if (states.every(({ status }) => status === 'success')) {
    return 'complete';
  }
  if (states.every(({ status }) => isTerminal(status))) {
    return 'incomplete';
  }
  return states.some(({ status }) => status !== 'idle') ? 'running' : 'idle';
}
