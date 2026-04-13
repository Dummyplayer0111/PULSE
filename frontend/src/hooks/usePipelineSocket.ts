import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { payguardApi } from '../services/payguardApi';
import { addEvent } from '../store/pipelineSlice';
import { useToast } from '../components/notifications/ToastProvider';

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

const HEAL_LABELS: Record<string, string> = {
  RESTART_SERVICE: 'Restart Service',
  SWITCH_NETWORK:  'Switch Network',
  FLUSH_CACHE:     'Flush Cache',
  REROUTE_TRAFFIC: 'Reroute Traffic',
  ALERT_ENGINEER:  'Alert Engineer',
  FREEZE_ATM:      'Freeze ATM',
};

export function usePipelineSocket() {
  const dispatch  = useDispatch();
  const wsRef     = useRef<WebSocket | null>(null);
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');

  // Toast hook — safe even if provider is absent (no-op default)
  let toast: ReturnType<typeof useToast> | null = null;
  try {
    toast = useToast();
  } catch {
    // ToastProvider not mounted — skip notifications
  }
  const toastRef = useRef(toast);
  toastRef.current = toast;

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
            const event = msg as PipelineEvent;

            // Store in Redux — persists across page navigation
            dispatch(addEvent(event));
            // Also invalidate caches so Incidents / Self-Heal pages refresh
            dispatch(payguardApi.util.invalidateTags(['Incidents', 'SelfHealActions', 'ATMs'] as any));

            // ── Fire toast notifications for significant events ──
            const push = toastRef.current?.push;
            if (push && event.incident) {
              const sev = event.incident.severity;
              const category = event.incident.category || event.classification?.category || '';
              const healAction = event.selfHealAction;
              const healLabel = healAction ? HEAL_LABELS[healAction] || healAction : '';

              if (sev === 'CRITICAL') {
                push(
                  'critical',
                  `CRITICAL: ${event.incident.title}`,
                  healLabel
                    ? `AI detected ${category} with ${Math.round((event.incident.confidence || 0) * 100)}% confidence. Self-heal: ${healLabel}`
                    : `AI detected ${category} failure. Incident ${event.incident.incidentId} created.`,
                );
              } else if (sev === 'HIGH') {
                push(
                  'high',
                  event.incident.title,
                  healLabel
                    ? `${category} failure — Self-heal: ${healLabel}`
                    : `${category} failure detected by AI classifier`,
                );
              }
            }

            // Toast for auto-resolved events
            if (push && event.selfHealAction && event.incident) {
              const status = (event as any).incident?.status;
              if (status === 'AUTO_RESOLVED') {
                push(
                  'success',
                  'Auto-Resolved',
                  `${event.incident.incidentId} fixed by ${HEAL_LABELS[event.selfHealAction] || event.selfHealAction}`,
                );
              }
            }
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
