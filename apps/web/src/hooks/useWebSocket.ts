'use client';

import { useEffect, useRef } from 'react';
import { WSClient } from '@/lib/ws-client';
import { useSessionStore } from '@/stores/session-store';
import { api } from '@/lib/api-client';
import type { CanonicalEvent } from '@amc/shared';

export function useWebSocket() {
  const clientRef = useRef<WSClient | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventCountRef = useRef(0);
  const { setConnected, addEvent, loadEvents, activeSessionId, sessions } = useSessionStore();
  const activeRef = useRef(activeSessionId);
  activeRef.current = activeSessionId;

  // WebSocket connection
  useEffect(() => {
    const client = new WSClient();
    clientRef.current = client;
    const unsub = client.subscribe((msg) => {
      if (msg.type === 'event') {
        const event = msg.data as CanonicalEvent;
        if (activeRef.current && event.session_id !== activeRef.current) return;
        addEvent(event);
      }
    });
    const interval = setInterval(() => setConnected(client.connected), 1000);
    client.connect();
    return () => { unsub(); clearInterval(interval); client.disconnect(); };
  }, [setConnected, addEvent]);

  // Session change + polling
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!activeSessionId) return;

    lastEventCountRef.current = 0;
    const session = sessions.find(s => s.id === activeSessionId);
    const isLive = session && !session.ended_at;

    // Initial load for ALL sessions (live or ended)
    api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
      const typed = events as CanonicalEvent[];
      lastEventCountRef.current = typed.length;
      loadEvents(typed);
    }).catch(() => {});

    // For live sessions, poll for NEW events only (append, don't replace)
    if (isLive) {
      pollRef.current = setInterval(() => {
        api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
          const typed = events as CanonicalEvent[];
          if (typed.length > lastEventCountRef.current) {
            // Only add the new events, don't replace
            const newEvents = typed.slice(lastEventCountRef.current);
            for (const ev of newEvents) {
              addEvent(ev);
            }
            lastEventCountRef.current = typed.length;
          }
        }).catch(() => {});
      }, 1500);
    }

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeSessionId, sessions, loadEvents, addEvent]);

  return clientRef;
}
