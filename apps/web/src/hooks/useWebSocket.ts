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
  const activeSessionRef = useRef<string | null>(null);
  const { setConnected, addEvent, loadEvents, activeSessionId, sessions } = useSessionStore();

  // Track active session for filtering in the subscriber
  activeSessionRef.current = activeSessionId;

  // WebSocket connection — receives ALL events, filters client-side
  useEffect(() => {
    const client = new WSClient();
    clientRef.current = client;

    const unsub = client.subscribe((msg) => {
      if (msg.type === 'event') {
        const event = msg.data as CanonicalEvent;
        // Only process events for the active session
        if (activeSessionRef.current && event.session_id !== activeSessionRef.current) return;
        if (seenIdsRef.current.has(event.event_id)) return;
        seenIdsRef.current.add(event.event_id);
        addEvent(event);
      }
    });

    const interval = setInterval(() => {
      setConnected(client.connected);
    }, 1000);

    client.connect();
    // Don't subscribe to any specific session — receive ALL events
    // Client-side filtering handles showing the right session

    return () => {
      unsub();
      clearInterval(interval);
      client.disconnect();
    };
  }, [setConnected, addEvent]);

  // When session changes
  useEffect(() => {
    if (!activeSessionId) return;
    if (loadedSessionRef.current === activeSessionId) return;
    loadedSessionRef.current = activeSessionId;
    seenIdsRef.current.clear();

    const session = sessions.find(s => s.id === activeSessionId);
    const isLive = session && !session.ended_at;

    if (isLive) {
      // LIVE session: clear and stream events via WebSocket in real-time
      loadEvents([]);
    } else {
      // ENDED session: bulk-load all historical events
      api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
        const typed = events as CanonicalEvent[];
        for (const e of typed) seenIdsRef.current.add(e.event_id);
        loadEvents(typed);
      }).catch(() => {});
    }
  }, [activeSessionId, sessions, loadEvents]);

  return clientRef;
}
