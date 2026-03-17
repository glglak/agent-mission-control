'use client';

import { useEffect, useRef } from 'react';
import { WSClient } from '@/lib/ws-client';
import { useSessionStore } from '@/stores/session-store';
import { api } from '@/lib/api-client';
import type { CanonicalEvent } from '@amc/shared';

export function useWebSocket() {
  const clientRef = useRef<WSClient | null>(null);
  const { setConnected, addEvent, loadEvents, activeSessionId } = useSessionStore();

  useEffect(() => {
    const client = new WSClient();
    clientRef.current = client;

    const unsub = client.subscribe((msg) => {
      if (msg.type === 'event') {
        addEvent(msg.data);
      }
    });

    // Poll connection status
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

  // Subscribe to session changes
  useEffect(() => {
    if (clientRef.current && activeSessionId) {
      clientRef.current.send({ type: 'subscribe', session_id: activeSessionId });
    }
  }, [activeSessionId]);

  // Load historical events when active session changes
  useEffect(() => {
    if (!activeSessionId) return;
    api.getEvents({ session_id: activeSessionId, limit: 5000 }).then((events) => {
      loadEvents(events as CanonicalEvent[]);
    });
  }, [activeSessionId, loadEvents]);

  return clientRef;
}
