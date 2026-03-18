'use client';

import { useEffect, useRef } from 'react';
import { WSClient } from '@/lib/ws-client';
import { useSessionStore } from '@/stores/session-store';
import { api } from '@/lib/api-client';
import type { CanonicalEvent } from '@amc/shared';

export function useWebSocket() {
  const clientRef = useRef<WSClient | null>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const { setConnected, addEvent, loadEvents, activeSessionId } = useSessionStore();

  // WebSocket connection — always on, deduplicates events
  useEffect(() => {
    const client = new WSClient();
    clientRef.current = client;

    const unsub = client.subscribe((msg) => {
      if (msg.type === 'event') {
        const event = msg.data as CanonicalEvent;
        // Deduplicate: skip events already loaded from history
        if (seenIdsRef.current.has(event.event_id)) return;
        seenIdsRef.current.add(event.event_id);
        addEvent(event);
      }
    });

    const interval = setInterval(() => {
      setConnected(client.connected);
    }, 1000);

    client.connect();

    return () => {
      unsub();
      clearInterval(interval);
      client.disconnect();
    };
  }, [setConnected, addEvent]);

  // When session changes: load historical events FIRST, then subscribe to live
  useEffect(() => {
    if (!activeSessionId) return;

    // Avoid reloading same session
    if (loadedSessionRef.current === activeSessionId) return;
    loadedSessionRef.current = activeSessionId;

    // Clear dedup set for new session
    seenIdsRef.current.clear();

    // Load historical events
    api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
      const typed = events as CanonicalEvent[];
      // Track all loaded event IDs for deduplication
      for (const e of typed) {
        seenIdsRef.current.add(e.event_id);
      }
      loadEvents(typed);

      // Subscribe to live events for this session AFTER history is loaded
      if (clientRef.current) {
        clientRef.current.send({ type: 'subscribe', session_id: activeSessionId });
      }
    }).catch(() => {
      // Even on error, subscribe to live events
      if (clientRef.current) {
        clientRef.current.send({ type: 'subscribe', session_id: activeSessionId });
      }
    });
  }, [activeSessionId, loadEvents]);

  return clientRef;
}
