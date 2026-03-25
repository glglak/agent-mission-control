'use client';

import { useEffect, useRef } from 'react';
import { WSClient } from '@/lib/ws-client';
import { useSessionStore } from '@/stores/session-store';
import { api } from '@/lib/api-client';
import type { CanonicalEvent } from '@amc/shared';

export function useWebSocket() {
  const clientRef = useRef<WSClient | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setConnected, addEvent, loadEvents, activeSessionId, sessions } = useSessionStore();
  const activeRef = useRef(activeSessionId);
  activeRef.current = activeSessionId;

  // WebSocket connection for real-time events
  useEffect(() => {
    const client = new WSClient();
    clientRef.current = client;
    const unsub = client.subscribe((msg) => {
      if (msg.type === 'event') {
        const event = msg.data as CanonicalEvent;
        if (activeRef.current && event.session_id !== activeRef.current) return;
        if (seenIdsRef.current.has(event.event_id)) return;
        seenIdsRef.current.add(event.event_id);
        addEvent(event);
      }
    });
    const interval = setInterval(() => setConnected(client.connected), 1000);
    client.connect();
    return () => { unsub(); clearInterval(interval); client.disconnect(); };
  }, [setConnected, addEvent]);

  // Session change handler + REST polling for live sessions
  useEffect(() => {
    // Clean up previous poll
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!activeSessionId) return;

    seenIdsRef.current.clear();
    const session = sessions.find(s => s.id === activeSessionId);
    const isLive = session && !session.ended_at;

    if (isLive) {
      // LIVE: poll REST API every 1.5s for reliable real-time updates
      loadEvents([]);
      pollRef.current = setInterval(() => {
        api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
          const typed = events as CanonicalEvent[];
          if (typed.length > 0) {
            for (const e of typed) seenIdsRef.current.add(e.event_id);
            loadEvents(typed);
          }
        }).catch(() => {});
      }, 1500);
    } else {
      // ENDED: bulk-load all events
      api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
        const typed = events as CanonicalEvent[];
        for (const e of typed) seenIdsRef.current.add(e.event_id);
        loadEvents(typed);
      }).catch(() => {});
    }

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeSessionId, sessions, loadEvents]);

  return clientRef;
}
