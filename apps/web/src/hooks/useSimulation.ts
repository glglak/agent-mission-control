'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
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
  const engineRef = useRef<SimulationEngine | null>(null);
  const events = useSessionStore((s) => s.events);
  const lastProcessed = useRef(0);

  if (!engineRef.current) {
    engineRef.current = new SimulationEngine('live');
  }

  // Feed new events to the engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Detect bulk-replace (session switch): reset engine and reprocess all events
    if (events.length < lastProcessed.current) {
      engineRef.current = new SimulationEngine('live');
      lastProcessed.current = 0;
      const freshEngine = engineRef.current;
      for (let i = 0; i < events.length; i++) {
        freshEngine.ingestEvent(events[i]);
      }
      lastProcessed.current = events.length;
      return;
    }

    for (let i = lastProcessed.current; i < events.length; i++) {
      engine.ingestEvent(events[i]);
    }
    lastProcessed.current = events.length;
  }, [events]);

  const state = useSyncExternalStore(
    (cb) => {
      if (!engineRef.current) return () => {};
      return engineRef.current.subscribe(cb);
    },
    () => engineRef.current?.getState() ?? emptyState,
    () => emptyState,
  );

  return { state, engine: engineRef.current };
}
