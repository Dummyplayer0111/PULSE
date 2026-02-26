import { useEffect, useRef, useState, useCallback } from 'react';

type WSStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  reconnect?: boolean;
  reconnectDelay?: number;
}

/**
 * useWebSocket — connects to a PULSE WebSocket endpoint.
 *
 * Endpoints:
 *   ws://localhost:8000/ws/dashboard/
 *   ws://localhost:8000/ws/logs/<atm_id>/
 */
export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { onMessage, reconnect = true, reconnectDelay = 3000 } = options;

  const [status, setStatus]       = useState<WSStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef     = useRef<WebSocket | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen    = () => setStatus('open');
    ws.onclose   = () => {
      setStatus('closed');
      if (reconnect && activeRef.current) {
        timerRef.current = setTimeout(connect, reconnectDelay);
      }
    };
    ws.onerror   = () => setStatus('error');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        onMessage?.(data);
      } catch (_) {
        setLastMessage(event.data);
        onMessage?.(event.data);
      }
    };
  }, [url, reconnect, reconnectDelay, onMessage]);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: object | string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return { status, lastMessage, send };
}
