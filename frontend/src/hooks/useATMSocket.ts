import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { payguardApi } from '../services/payguardApi';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * Connects to ws://localhost:8000/ws/dashboard/ and listens for
 * { type: "atm_update", atm: {...} } messages.
 * When received, invalidates the RTK Query ATMs cache to trigger a refetch,
 * and returns the live ATM data from the WS for instant UI updates.
 */
export function useATMSocket() {
  const dispatch   = useDispatch();
  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [liveATMs, setLiveATMs] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;
      setStatus('connecting');

      const ws = new WebSocket('ws://localhost:8000/ws/dashboard/');
      wsRef.current = ws;

      ws.onopen = () => {
        if (mounted) setStatus('connected');
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'atm_update' && msg.atm) {
            // Update live state immediately (no round-trip)
            setLiveATMs(prev => {
              const exists = prev.findIndex(a => a.id === msg.atm.id);
              if (exists >= 0) {
                const copy = [...prev];
                copy[exists] = msg.atm;
                return copy;
              }
              return [...prev, msg.atm]; // new ATM
            });
            // Also invalidate cache so background refetch keeps things in sync
            dispatch(payguardApi.util.invalidateTags(['ATMs'] as any));
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (mounted) {
          setStatus('disconnected');
          // Reconnect after 3 seconds
          retryRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mounted = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [dispatch]);

  return { status, liveATMs };
}
