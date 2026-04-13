import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, Info, X, Zap, Shield, Volume2, VolumeX } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ToastLevel = 'critical' | 'high' | 'medium' | 'info' | 'success';

interface Toast {
  id: string;
  level: ToastLevel;
  title: string;
  message: string;
  timestamp: number;
  exiting?: boolean;
}

interface ToastContextValue {
  push: (level: ToastLevel, title: string, message: string) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  push: () => {},
  soundEnabled: true,
  toggleSound: () => {},
});

export const useToast = () => useContext(ToastContext);

// ─── Sound ─────────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function playAlertSound(level: ToastLevel) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    if (level === 'critical') {
      // Urgent two-tone alarm: high → low → high
      [880, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.18;
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.12);
        osc.start(now + i * 0.12);
        osc.stop(now + (i + 1) * 0.12);
      });
    } else if (level === 'high') {
      // Single descending tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.value = 740;
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
      osc.type = 'sine';
      gain.gain.value = 0.14;
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (level === 'success') {
      // Quick ascending chime
      [523, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 + i * 0.08);
        osc.start(now + i * 0.08);
        osc.stop(now + 0.15 + i * 0.08);
      });
    }
  } catch {
    // Audio not available — silently ignore
  }
}

// ─── Browser notification helper ───────────────────────────────────────────────

function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'payguard-alert' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// ─── Style config ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<ToastLevel, {
  color: string;
  bg: string;
  border: string;
  icon: typeof AlertTriangle;
}> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)',  icon: AlertTriangle },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', icon: Shield },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', icon: Zap },
  info:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.3)', icon: Info },
  success:  { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.3)', icon: CheckCircle },
};

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS: Record<ToastLevel, number> = {
  critical: 8000,
  high:     6000,
  medium:   5000,
  info:     4000,
  success:  3000,
};

// ─── Single Toast ──────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = LEVEL_CONFIG[toast.level];
  const Icon = cfg.icon;
  const age = Date.now() - toast.timestamp;
  const elapsed = age < 2000 ? 'just now' : `${Math.round(age / 1000)}s ago`;

  return (
    <div
      className="flex items-start gap-0 shadow-2xl overflow-hidden"
      style={{
        /* Gold glass base — matches BentoCard / payguard-card */
        background: 'var(--p-card-strong)',
        border: '1px solid var(--p-card-border)',
        borderRadius: 14,
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        boxShadow: `inset 0 1px 0 var(--p-specular), 0 20px 48px -12px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(196,151,70,0.08)`,
        minWidth: 340,
        maxWidth: 420,
        animation: toast.exiting
          ? 'toastExit 0.3s ease-in forwards'
          : 'toastEnter 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {/* Severity accent stripe — left edge */}
      <div style={{ width: 3, alignSelf: 'stretch', background: cfg.color, borderRadius: '14px 0 0 14px', flexShrink: 0 }} />

      {/* Static gold glow at top — matches BentoCard .bento-static-glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, borderRadius: 14, background: 'radial-gradient(circle at 50% 0%, rgba(196,151,70,0.05) 0%, transparent 55%)' }} />

      <div className="flex items-start gap-3 px-4 py-3 relative z-[1] flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
        >
          <Icon size={14} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white truncate">{toast.title}</span>
            <span className="text-[9px] shrink-0" style={{ color: 'var(--p-text-muted)' }}>{elapsed}</span>
          </div>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--p-text-dim)' }}>
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 mt-0.5 opacity-40 hover:opacity-100 transition-opacity"
        >
          <X size={12} style={{ color: 'var(--p-text-dim)' }} />
        </button>
      </div>
    </div>
  );
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('payguard-sound');
    return stored !== 'off';
  });
  const counterRef = useRef(0);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('payguard-sound', next ? 'on' : 'off');
      return next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const push = useCallback((level: ToastLevel, title: string, message: string) => {
    const id = `toast-${++counterRef.current}-${Date.now()}`;
    const toast: Toast = { id, level, title, message, timestamp: Date.now() };

    setToasts(prev => [toast, ...prev].slice(0, MAX_TOASTS));

    // Sound
    if (soundEnabled && (level === 'critical' || level === 'high' || level === 'success')) {
      playAlertSound(level);
    }

    // Browser notification for critical/high when tab not focused
    if ((level === 'critical' || level === 'high') && document.hidden) {
      sendBrowserNotification(`PayGuard: ${title}`, message);
    }

    // Auto-dismiss
    const ms = AUTO_DISMISS_MS[level];
    setTimeout(() => dismiss(id), ms);
  }, [soundEnabled, dismiss]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <ToastContext.Provider value={{ push, soundEnabled, toggleSound }}>
      {children}
      {createPortal(
        <>
          {/* CSS animations */}
          <style>{`
            @keyframes toastEnter {
              from { opacity: 0; transform: translateX(40px) scale(0.95); }
              to   { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes toastExit {
              from { opacity: 1; transform: translateX(0) scale(1); }
              to   { opacity: 0; transform: translateX(40px) scale(0.95); }
            }
          `}</style>
          <div
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              pointerEvents: 'none',
            }}
          >
            {toasts.map(t => (
              <div key={t.id} style={{ pointerEvents: 'auto' }}>
                <ToastItem toast={t} onDismiss={dismiss} />
              </div>
            ))}
          </div>
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// ─── Sound Toggle Button (for sidebar/settings) ───────────────────────────────

export function SoundToggleButton() {
  const { soundEnabled, toggleSound } = useToast();
  return (
    <button
      onClick={toggleSound}
      title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
      style={{
        background: 'var(--p-toggle-bg)',
        border: '1px solid var(--p-toggle-border)',
        borderRadius: '8px',
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: soundEnabled ? '#e8af48' : 'rgba(196,151,70,0.3)',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
    </button>
  );
}
