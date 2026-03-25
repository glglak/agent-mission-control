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
  const { setConnected, addEvent, loadEvents, activeSessionId, sessions } = useSessionStore();

  // WebSocket connection — always on, deduplicates events
  useEffect(() => {
    const client = new WSClient();
    clientRef.current = client;

    const unsub = client.subscribe((msg) => {
      if (msg.type === 'event') {
        const event = msg.data as CanonicalEvent;
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

  // When session changes: decide how to load events
  useEffect(() => {
    if (!activeSessionId) return;
    if (loadedSessionRef.current === activeSessionId) return;
    loadedSessionRef.current = activeSessionId;
    seenIdsRef.current.clear();

    const session = sessions.find(s => s.id === activeSessionId);
    const isLive = session && !session.ended_at;

    if (isLive) {
      // LIVE session: DON'T bulk-load history. Just subscribe to WebSocket
      // and let events stream in one-by-one for real-time experience.
      loadEvents([]);
      if (clientRef.current) {
        clientRef.current.send({ type: 'subscribe', session_id: activeSessionId });
      }
    } else {
      // ENDED session: Load all historical events at once for instant replay.
      api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
        const typed = events as CanonicalEvent[];
        for (const e of typed) seenIdsRef.current.add(e.event_id);
        loadEvents(typed);
        if (clientRef.current) {
          clientRef.current.send({ type: 'subscribe', session_id: activeSessionId });
        }
      }).catch(() => {
        if (clientRef.current) {
          clientRef.current.send({ type: 'subscribe', session_id: activeSessionId });
        }
      });
    }
  }, [activeSessionId, sessions, loadEvents]);

  return clientRef;
}
