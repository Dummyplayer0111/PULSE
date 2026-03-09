import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { payguardApi } from '../services/payguardApi';
import { addEvent } from '../store/pipelineSlice';

export interface PipelineEvent {
  type: 'pipeline_event';
  log: {
    id: number;
    eventCode: string;
    logLevel: string;
    message: string;
    timestamp: string;
  };
  atm: { id: number; name: string; status: string; healthScore: number } | null;
  classification: {
    category: string;
    confidence: number;
    selfHealAction: string;
    detail: string;
    recommendedAction?: string;
  } | null;
  incident: {
    id: number;
    incidentId: string;
    title: string;
    severity: string;
    category: string;
    confidence: number;
  } | null;
  selfHealAction: string | null;
  timestamp: string;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function usePipelineSocket() {
  const dispatch  = useDispatch();
  const wsRef     = useRef<WebSocket | null>(null);
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;
      setStatus('connecting');
      const ws = new WebSocket('ws://localhost:8000/ws/dashboard/');
      wsRef.current = ws;

      ws.onopen = () => { if (mounted) setStatus('connected'); };

      ws.onmessage = (e) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'pipeline_event') {
            // Store in Redux — persists across page navigation
            dispatch(addEvent(msg as PipelineEvent));
            // Also invalidate caches so Incidents / Self-Heal pages refresh
            dispatch(payguardApi.util.invalidateTags(['Incidents', 'SelfHealActions', 'ATMs'] as any));
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        if (mounted) {
          setStatus('disconnected');
          retryRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => { ws.close(); };
    }

    connect();

    return () => {
      mounted = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [dispatch]);

  return { status };
}
