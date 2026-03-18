'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { SimulationEngine } from '@amc/simulation-engine';
import type { WorldState } from '@amc/simulation-engine';
import { useSessionStore } from '@/stores/session-store';

const emptyState: WorldState = {
  tick: 0,
  agents: new Map(),
  connections: [],
  fileNodes: new Map(),
  tokenUsage: { totalPromptTokens: 0, totalCompletionTokens: 0, totalCostUsd: 0 },
};

export function useSimulation() {
  const engineRef = useRef<SimulationEngine>(new SimulationEngine('live'));
  const events = useSessionStore((s) => s.events);
  const lastProcessed = useRef(0);
  // Tracks engine version so useSyncExternalStore re-subscribes on engine swap
  const engineVersion = useRef(0);
  const forceUpdate = useRef<(() => void) | null>(null);

  // Feed events to engine
  useEffect(() => {
    const engine = engineRef.current;

    // Detect bulk-replace (session switch): events array was replaced
    if (events.length < lastProcessed.current || lastProcessed.current === 0) {
      // Create fresh engine and replay all events
      const fresh = new SimulationEngine('live');
      for (let i = 0; i < events.length; i++) {
        fresh.ingestEvent(events[i]);
      }
      engineRef.current = fresh;
      lastProcessed.current = events.length;
      engineVersion.current++;
      // Force React to re-subscribe to the new engine
      forceUpdate.current?.();
      return;
    }

    // Incremental: process only new events
    for (let i = lastProcessed.current; i < events.length; i++) {
      engine.ingestEvent(events[i]);
    }
    lastProcessed.current = events.length;
  }, [events]);

  const subscribe = useCallback((cb: () => void) => {
    forceUpdate.current = cb;
    const unsub = engineRef.current.subscribe(cb);
    return () => {
      unsub();
      if (forceUpdate.current === cb) forceUpdate.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineVersion.current]);

  const getSnapshot = useCallback(() => {
    return engineRef.current.getState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineVersion.current]);

  const state = useSyncExternalStore(subscribe, getSnapshot, () => emptyState);

  return { state, engine: engineRef.current };
}
