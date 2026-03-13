import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Activity, Zap, Brain, Shield, ShieldAlert, BarChart2 } from 'lucide-react';
import {
  useGetATMQuery,
  useGetATMLogsQuery,
  useGetATMIncidentsQuery,
  useGetATMHealthHistoryQuery,
  useGetATMTransactionVolumeQuery,
  useGetAnomalyFlagsQuery,
} from '../services/payguardApi';
import { formatDate, formatDateTime } from '../utils';
import { useWebSocket } from '../hooks/useWebSocket';

const TABS = ['Overview', 'Logs', 'Incidents', 'Anomalies', 'Health History', 'Self-Heal'] as const;
type Tab = typeof TABS[number];

function sevStyle(s: string) {
  const m: any = {
    CRITICAL: { color: '#ef4444', bg: '#ef44441a' },
    HIGH:     { color: '#f97316', bg: '#f973161a' },
    MEDIUM:   { color: '#f59e0b', bg: '#f59e0b1a' },
    LOW:      { color: '#22c55e', bg: '#22c55e1a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

function staStyle(s: string) {
  const m: any = {
    OPEN:          { color: '#60a5fa', bg: '#60a5fa1a' },
    INVESTIGATING: { color: '#f59e0b', bg: '#f59e0b1a' },
    RESOLVED:      { color: '#4ade80', bg: '#4ade801a' },
    AUTO_RESOLVED: { color: '#4ade80', bg: '#4ade801a' },
    ACKNOWLEDGED:  { color: '#a78bfa', bg: '#a78bfa1a' },
    ESCALATED:     { color: '#ef4444', bg: '#ef44441a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

function logStyle(level: string) {
  const m: any = {
    CRITICAL: { color: '#ef4444', bg: '#ef44441a' },
    ERROR:    { color: '#f97316', bg: '#f973161a' },
    WARN:     { color: '#f59e0b', bg: '#f59e0b1a' },
    INFO:     { color: '#9ca3af', bg: '#9ca3af1a' },
  };
  return m[level] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

const HEAL_COLORS: Record<string, string> = {
  RESTART_SERVICE: '#60a5fa',
  SWITCH_NETWORK:  '#4ade80',
  FLUSH_CACHE:     '#f59e0b',
  REROUTE_TRAFFIC: '#a78bfa',
  ALERT_ENGINEER:  '#f97316',
  FREEZE_ATM:      '#ef4444',
};

const HEAL_LABELS: Record<string, string> = {
  RESTART_SERVICE: '↺ Restart Service',
  SWITCH_NETWORK:  '⇄ Switch Network',
  FLUSH_CACHE:     '∅ Flush Cache',
  REROUTE_TRAFFIC: '⇀ Reroute Traffic',
  ALERT_ENGINEER:  '🔔 Alert Engineer',
  FREEZE_ATM:      '🔒 Freeze ATM',
};

const ANOMALY_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  UNUSUAL_WITHDRAWAL: { color: '#f59e0b', bg: '#f59e0b1a', label: 'Unusual Withdrawal' },
  CARD_SKIMMING:      { color: '#ef4444', bg: '#ef44441a', label: 'Card Skimming' },
  RAPID_FAILURES:     { color: '#f97316', bg: '#f973161a', label: 'Rapid Failures' },
  MALWARE_PATTERN:    { color: '#dc2626', bg: '#dc26261a', label: 'Malware Pattern' },
};

const ANOMALY_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  FLAGGED:       { color: '#f59e0b', bg: '#f59e0b1a' },
  ACTIVE:        { color: '#ef4444', bg: '#ef44441a' },
  CONFIRMED:     { color: '#ef4444', bg: '#ef44441a' },
  REVIEWED:      { color: '#60a5fa', bg: '#60a5fa1a' },
  DISMISSED:     { color: '#6b7280', bg: '#6b72801a' },
  FALSE_POSITIVE:{ color: '#9ca3af', bg: '#9ca3af1a' },
};

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>
    {children}
  </th>
);

/* ── Health Sparkline ─────────────────────────────────────────────────── */
function HealthSparkline({ data }: { data: { healthScore: number; timestamp: string }[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ height: 80 }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Need more data points</p>
      </div>
    );
  }

  const W = 600;
  const H = 80;
  const pad = 4;
  const values = data.map(d => d.healthScore);
  const min = Math.max(0, Math.min(...values) - 5);
  const max = Math.min(100, Math.max(...values) + 5);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const areaPath = `M ${points[0]} L ${points.join(' L ')} L ${points[points.length - 1].split(',')[0]},${H} L ${pad},${H} Z`;

  const lastVal = values[values.length - 1];
  const lastColor = lastVal >= 80 ? '#4ade80' : lastVal >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-1">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 80 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lastColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lastColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkGrad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke={lastColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Last value dot */}
        <circle
          cx={points[points.length - 1].split(',')[0]}
          cy={points[points.length - 1].split(',')[1]}
          r="4"
          fill={lastColor}
          stroke="#0b0b0f"
          strokeWidth="2"
        />
      </svg>
      <div className="flex justify-between text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <span>{formatDate(data[0].timestamp)}</span>
        <span style={{ color: lastColor, fontWeight: 700 }}>Current: {lastVal}</span>
        <span>{formatDate(data[data.length - 1].timestamp)}</span>
      </div>
    </div>
  );
}

/* ── Transaction Volume Chart ────────────────────────────────────────── */
function TransactionVolumeChart({ atmId }: { atmId: string | number }) {
  const [hours, setHours] = useState<6 | 12 | 24>(12);
  const { data, isLoading } = useGetATMTransactionVolumeQuery(
    { id: atmId, hours },
    { pollingInterval: 30000 },
  );
  const volume: any[] = data?.volume ?? [];

  const maxVal = Math.max(1, ...volume.map(d => d.success + d.failed + d.warned));
  const W = 600; const H = 130; const padL = 28; const padR = 8; const padT = 8; const padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const bgW    = chartW / Math.max(volume.length, 1);
  const barW   = Math.max(3, Math.min(16, bgW * 0.55));

  const totSuccess = volume.reduce((s, d) => s + d.success, 0);
  const totFailed  = volume.reduce((s, d) => s + d.failed,  0);
  const totWarn    = volume.reduce((s, d) => s + d.warned,  0);
  const totAll     = totSuccess + totFailed;
  const successRate = totAll > 0 ? Math.round(totSuccess / totAll * 100) : null;

  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={13} style={{ color: '#60a5fa' }} />
          <span className="text-xs font-semibold text-white">Transaction Volume</span>
        </div>
        <div className="flex items-center gap-1">
          {([6, 12, 24] as const).map(h => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className="text-[10px] px-2 py-0.5 rounded-lg font-medium transition-all"
              style={{
                background: hours === h ? 'rgba(96,165,250,0.18)' : 'var(--p-card)',
                border: hours === h ? '1px solid rgba(96,165,250,0.4)' : '1px solid var(--p-card-border)',
                color: hours === h ? '#60a5fa' : 'rgba(255,255,255,0.4)',
              }}
            >{h}h</button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center gap-4">
        {[['#4ade80','Success'],['#ef4444','Failed'],['#f59e0b','Warning']].map(([c,l])=>(
          <div key={l} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-1.5 rounded-sm" style={{ background: c }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</span>
          </div>
        ))}
        {successRate != null && (
          <span className="ml-auto text-[11px] font-bold" style={{ color: successRate >= 90 ? '#4ade80' : successRate >= 70 ? '#f59e0b' : '#ef4444' }}>
            {successRate}% success rate
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height: H }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</span>
        </div>
      ) : volume.length === 0 || totAll === 0 ? (
        <div className="flex items-center justify-center rounded-xl" style={{ height: H, background: 'var(--p-card)' }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>No transactions in this window</span>
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = padT + chartH - t * chartH;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray={t === 0 ? '' : '3 3'} />
                {t > 0 && (
                  <text x={padL - 3} y={y + 3} textAnchor="end" style={{ fontSize: 7, fill: 'rgba(255,255,255,0.22)' }}>
                    {Math.round(maxVal * t)}
                  </text>
                )}
              </g>
            );
          })}

          {volume.map((d: any, i: number) => {
            const cx   = padL + i * bgW + bgW / 2;
            const base = padT + chartH; // bottom of chart
            const sH = Math.max(0, (d.success / maxVal) * chartH);
            const fH = Math.max(0, (d.failed  / maxVal) * chartH);
            const wH = Math.max(0, (d.warned  / maxVal) * chartH);
            const step = hours === 6 ? 1 : hours === 12 ? 2 : 4;
            const x = cx - barW / 2;
            return (
              <g key={i}>
                {/* Success — bottom segment */}
                {sH > 0 && <rect x={x} y={base - sH} width={barW} height={sH} fill="#4ade80" opacity="0.85" rx="1" />}
                {/* Failed — stacked on top of success */}
                {fH > 0 && <rect x={x} y={base - sH - fH} width={barW} height={fH} fill="#ef4444" opacity="0.9" rx="1" />}
                {/* Warned — stacked on top of failed */}
                {wH > 0 && <rect x={x} y={base - sH - fH - wH} width={barW} height={wH} fill="#f59e0b" opacity="0.85" rx="1" />}
                {/* Baseline dot when all zero */}
                {sH === 0 && fH === 0 && wH === 0 && (
                  <line x1={cx} y1={base - 1} x2={cx} y2={base} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                )}
                {i % step === 0 && (
                  <text x={cx} y={H - 5} textAnchor="middle" style={{ fontSize: 7, fill: 'rgba(255,255,255,0.28)' }}>{d.hour}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Totals row */}
      <div className="flex items-center gap-5 pt-1">
        {[
          { l: 'Success', v: totSuccess, c: '#4ade80' },
          { l: 'Failed',  v: totFailed,  c: '#ef4444' },
          { l: 'Warned',  v: totWarn,    c: '#f59e0b' },
        ].map(({ l, v, c }) => (
          <div key={l}>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{l}</p>
            <p className="text-sm font-bold" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Active Incident Card ─────────────────────────────────────────────── */
function ActiveIncidentCard({ incidents }: { incidents: any[] }) {
  const active = incidents.filter(i => i.status === 'OPEN' || i.status === 'INVESTIGATING');
  if (active.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 flex items-center gap-3"
        style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}
      >
        <Shield size={20} style={{ color: '#4ade80' }} />
        <div>
          <p className="text-sm font-bold text-white">No Active Incidents</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>This ATM is operating normally</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {active.slice(0, 3).map((inc: any) => {
        const sv = sevStyle(inc.severity);
        const confidence = inc.aiConfidence != null ? Math.round(inc.aiConfidence * 100) : null;
        const healKey = ({
          NETWORK:  'SWITCH_NETWORK', SWITCH: 'RESTART_SERVICE',
          SERVER:   'RESTART_SERVICE', TIMEOUT: 'FLUSH_CACHE',
          CASH_JAM: 'ALERT_ENGINEER', FRAUD: 'FREEZE_ATM',
          HARDWARE: 'ALERT_ENGINEER', UNKNOWN: 'ALERT_ENGINEER',
        } as any)[inc.rootCauseCategory] ?? 'ALERT_ENGINEER';
        const healColor = HEAL_COLORS[healKey] ?? '#6b7280';

        return (
          <div
            key={inc.id}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: `${sv.color}0d`, border: `1px solid ${sv.color}30` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Brain size={13} style={{ color: sv.color }} />
                <span className="text-xs font-semibold" style={{ color: sv.color }}>Active Incident</span>
                <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{inc.incidentId}</span>
              </div>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0"
                style={{ color: sv.color, background: sv.bg }}
              >
                {inc.severity}
              </span>
            </div>

            <p className="text-sm font-bold text-white">{inc.title}</p>

            {/* Root cause + confidence */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3"
                style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
              >
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Root Cause</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: sv.color }}>{inc.rootCauseCategory || '—'}</p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
              >
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>AI Confidence</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: '#a78bfa' }}>
                  {confidence != null ? `${confidence}%` : '—'}
                </p>
              </div>
            </div>

            {/* Confidence bar */}
            {confidence != null && (
              <div>
                <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--p-card-strong)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${confidence}%`, background: '#a78bfa' }}
                  />
                </div>
              </div>
            )}

            {/* Detail */}
            {inc.rootCauseDetail && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{inc.rootCauseDetail}</p>
            )}

            {/* Recommended action */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: `${healColor}0d`, border: `1px solid ${healColor}25` }}
            >
              <Zap size={11} style={{ color: healColor }} />
              <span className="text-xs font-semibold" style={{ color: healColor }}>
                Recommended: {HEAL_LABELS[healKey] ?? healKey}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ATMDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: atm,     isLoading: atmLoading,    error: atmError    } = useGetATMQuery(id);
  const { data: logs    = [], isLoading: logsLoading  } = useGetATMLogsQuery(id,     { skip: tab !== 'Logs' });
  const { data: incs    = [], isLoading: incsLoading  } = useGetATMIncidentsQuery(id, {
    skip: tab !== 'Incidents' && tab !== 'Overview' && tab !== 'Self-Heal',
  });
  const { data: history = [], isLoading: histLoading  } = useGetATMHealthHistoryQuery(id, {
    skip: tab !== 'Health History',
  });
  const { data: allAnomalies = [], isLoading: anomLoading } = useGetAnomalyFlagsQuery(undefined, {
    skip: tab !== 'Anomalies',
  });

  // Always load incidents for overview tab
  const { data: allIncs = [] } = useGetATMIncidentsQuery(id);

  // Derive self-heal data from incidents list (find by incidentId)
  // We'll just use the incidents to infer what self-heals happened

  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const { status: logWsStatus, lastMessage: logWsMsg } =
    useWebSocket(`ws://localhost:8000/ws/logs/${id}/`);

  useEffect(() => {
    if (!logWsMsg) return;
    if (logWsMsg.type === 'log_entry' || logWsMsg.log_level) {
      setLiveLogs(prev => [logWsMsg, ...prev].slice(0, 100));
    }
  }, [logWsMsg]);

  useEffect(() => { setLiveLogs([]); }, [id]);

  const allLogs = useMemo(() => {
    const seen = new Set<string>();
    return [...liveLogs, ...(logs as any[])].filter(l => {
      const key = `${l.timestamp}:${l.eventCode ?? l.event_code}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [liveLogs, logs]);

  const historyChronological = [...history].reverse() as any[];

  // Filter anomalies for this ATM — sourceId is a UUID, we match against ATM id
  const atmAnomalies = useMemo(() => {
    if (!atm) return [];
    return (allAnomalies as any[]).filter((a: any) => {
      // sourceId may be the ATM's UUID or serialNumber — check id match
      const sid = String(a.sourceId ?? '');
      const atmId = String(atm.id ?? '');
      const atmSerial = String((atm as any).serialNumber ?? '');
      return sid === atmId || sid === atmSerial || sid === id;
    });
  }, [allAnomalies, atm, id]);

  return (
    <div className="p-6 space-y-4" style={{ minHeight: '100vh' }}>
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          to="/atm-map"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'white')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)')}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">
            {atm?.name ?? `ATM #${id}`}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>
            {atm?.location ?? 'Device detail & history'}
          </p>
        </div>
        {atm && (
          <div className="ml-auto">
            <span
              className="text-xs px-3 py-1.5 rounded-full font-bold"
              style={{
                color: ({ ONLINE: '#4ade80', DEGRADED: '#f59e0b', OFFLINE: '#ef4444', MAINTENANCE: '#60a5fa' } as any)[atm.status] ?? '#9ca3af',
                background: ({ ONLINE: 'rgba(74,222,128,0.1)', DEGRADED: 'rgba(245,158,11,0.1)', OFFLINE: 'rgba(239,68,68,0.1)', MAINTENANCE: 'rgba(96,165,250,0.1)' } as any)[atm.status] ?? 'rgba(156,163,175,0.1)',
                border: `1px solid ${({ ONLINE: 'rgba(74,222,128,0.25)', DEGRADED: 'rgba(245,158,11,0.25)', OFFLINE: 'rgba(239,68,68,0.25)', MAINTENANCE: 'rgba(96,165,250,0.25)' } as any)[atm.status] ?? 'rgba(156,163,175,0.15)'}`,
              }}
            >
              {atm.status}
            </span>
          </div>
        )}
      </div>

      {atmLoading ? (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)', color: 'var(--p-text-muted)' }}
        >
          Loading…
        </div>
      ) : atmError ? (
        <div
          className="rounded-2xl p-12 text-center space-y-4"
          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
        >
          <AlertCircle size={36} style={{ color: '#f59e0b', margin: '0 auto' }} />
          <p className="text-sm font-semibold text-white">ATM not found</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>ATM #{id} does not exist.</p>
        </div>
      ) : (
        <>
          {/* Overview strip */}
          <div
            className="rounded-2xl p-6 flex flex-wrap items-center gap-8"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
          >
            {/* Health score ring */}
            <div className="flex flex-col items-center gap-2">
              {(() => {
                const score = atm?.healthScore ?? 0;
                const color = score >= 80 ? '#4ade80' : score >= 60 ? '#f59e0b' : '#ef4444';
                const size = 80;
                const sw = 7;
                const r = (size - sw) / 2;
                const circ = 2 * Math.PI * r;
                const dash = (score / 100) * circ;
                return (
                  <div style={{ position: 'relative', width: size, height: size }}>
                    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                      {/* Track */}
                      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
                      {/* Arc */}
                      <circle
                        cx={size/2} cy={size/2} r={r} fill="none"
                        stroke={color} strokeWidth={sw} strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease', filter: `drop-shadow(0 0 4px ${color}88)` }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{score}</span>
                    </div>
                  </div>
                );
              })()}
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Health Score</span>
            </div>

            {/* Score grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Network',     value: atm?.networkScore,     color: '#60a5fa' },
                { label: 'Hardware',    value: atm?.hardwareScore,    color: '#f97316' },
                { label: 'Software',    value: atm?.softwareScore,    color: '#a78bfa' },
                { label: 'Transaction', value: atm?.transactionScore, color: '#4ade80' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-3"
                  style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
                >
                  <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: value != null && (value as number) >= 80 ? color : value != null && (value as number) >= 60 ? '#f59e0b' : '#ef4444' }}>
                    {value != null ? `${value}` : '—'}
                  </p>
                  {value != null && (
                    <div className="mt-1 rounded-full overflow-hidden" style={{ height: 2, background: 'var(--p-card-strong)' }}>
                      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ATM meta */}
            <div className="flex-1 min-w-[200px]">
              {atm && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {['location', 'model', 'serialNumber', 'region'].map(k => (
                    (atm as any)[k] && (
                      <div key={k}>
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{k}</p>
                        <p className="text-sm text-white mt-0.5">{String((atm as any)[k])}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--p-card-border)' }}>
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-5 py-2.5 text-sm font-medium transition-all"
                style={{
                  color: tab === t ? 'var(--p-heading)' : 'var(--p-heading-dim)',
                  borderBottom: tab === t ? '2px solid var(--p-heading)' : '2px solid transparent',
                }}
              >
                {t === 'Logs' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {t}
                    <span style={{ width: 6, height: 6, borderRadius: '50%',
                      background: logWsStatus === 'open' ? '#4ade80' : '#6b7280',
                      boxShadow: logWsStatus === 'open' ? '0 0 5px #4ade80' : 'none',
                      display: 'inline-block', marginLeft: 2 }} />
                    <span style={{ fontSize: 9, color: logWsStatus === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                      {logWsStatus === 'open' ? 'LIVE' : ''}
                    </span>
                  </span>
                ) : t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
          >

            {tab === 'Overview' && (
              <div className="p-6 space-y-5">
                {/* Active Incident Card */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Active Incidents
                  </p>
                  <ActiveIncidentCard incidents={allIncs as any[]} />
                </div>

                {/* Transaction Volume Chart */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Transaction Volume
                  </p>
                  <TransactionVolumeChart atmId={id} />
                </div>

                {/* ATM Properties */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Device Properties
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {atm ? Object.entries(atm)
                      .filter(([k]) => !['id', 'healthScore', 'networkScore', 'hardwareScore', 'softwareScore', 'transactionScore'].includes(k))
                      .map(([k, v]) => (
                        <div key={k} className="rounded-xl p-3" style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}>
                          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{k}</p>
                          <p className="text-sm text-white mt-1 break-all">{String(v ?? '—')}</p>
                        </div>
                      )) : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No data.</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'Logs' && (
              logsLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                      <TH>Timestamp</TH><TH>Level</TH><TH>Event Code</TH><TH>Message</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {allLogs.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No logs.</td></tr>
                    ) : allLogs.map((l: any, i) => {
                      const ls = logStyle(l.logLevel || l.log_level);
                      return (
                        <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--p-card-border)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {formatDateTime(l.timestamp)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: ls.color, background: ls.bg }}>
                              {l.logLevel || l.log_level || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {l.eventCode || l.event_code || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-white max-w-xs truncate">{l.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {tab === 'Incidents' && (
              incsLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                      <TH>ID</TH><TH>Title</TH><TH>Severity</TH><TH>Status</TH><TH>Root Cause</TH><TH>AI Confidence</TH><TH>Created</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {(incs as any[]).length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No incidents.</td></tr>
                    ) : (incs as any[]).map((inc: any) => {
                      const sv = sevStyle(inc.severity); const st = staStyle(inc.status);
                      const conf = inc.aiConfidence != null ? Math.round(inc.aiConfidence * 100) : null;
                      return (
                        <tr key={inc.id} className="transition-colors" style={{ borderBottom: '1px solid var(--p-card-border)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{inc.incidentId || inc.id}</td>
                          <td className="px-5 py-3.5 text-sm text-white max-w-[160px] truncate">{inc.title}</td>
                          <td className="px-5 py-3.5"><span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: sv.color, background: sv.bg }}>{inc.severity}</span></td>
                          <td className="px-5 py-3.5"><span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>{inc.status}</span></td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{inc.rootCauseCategory || '—'}</td>
                          <td className="px-5 py-3.5">
                            {conf != null ? (
                              <div className="flex items-center gap-2">
                                <div className="rounded-full overflow-hidden" style={{ width: 40, height: 3, background: 'var(--p-card-strong)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${conf}%`, background: '#a78bfa' }} />
                                </div>
                                <span className="text-[11px] font-bold" style={{ color: '#a78bfa' }}>{conf}%</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDate(inc.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {tab === 'Anomalies' && (
              anomLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
              ) : atmAnomalies.length === 0 ? (
                <div className="p-10 text-center">
                  <Shield size={32} style={{ color: 'rgba(74,222,128,0.25)', margin: '0 auto 12px' }} />
                  <p className="text-sm font-semibold text-white">No Anomalies Detected</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    This ATM has no flagged suspicious activity
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {/* Summary strip */}
                  <div className="flex items-center gap-5">
                    {[
                      { label: 'Total Flags', value: atmAnomalies.length, color: 'rgba(255,255,255,0.6)' },
                      { label: 'Active', value: atmAnomalies.filter((a: any) => a.status === 'FLAGGED' || a.status === 'ACTIVE').length, color: '#ef4444' },
                      { label: 'Confirmed', value: atmAnomalies.filter((a: any) => a.status === 'CONFIRMED').length, color: '#f97316' },
                      { label: 'Dismissed', value: atmAnomalies.filter((a: any) => a.status === 'DISMISSED' || a.status === 'FALSE_POSITIVE').length, color: '#6b7280' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                        <p className="text-lg font-bold" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Anomaly cards */}
                  <div className="space-y-3">
                    {atmAnomalies.map((a: any) => {
                      const aType = ANOMALY_COLORS[a.anomalyType] ?? { color: '#9ca3af', bg: '#9ca3af1a', label: a.anomalyType };
                      const aStat = ANOMALY_STATUS_COLORS[a.status] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
                      const confidence = a.confidenceScore != null ? Math.round(a.confidenceScore * 100) : null;

                      return (
                        <div
                          key={a.id}
                          className="rounded-xl p-4"
                          style={{ background: `${aType.color}08`, border: `1px solid ${aType.color}20` }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <ShieldAlert size={13} style={{ color: aType.color }} />
                                <span className="text-xs font-bold" style={{ color: aType.color }}>{aType.label}</span>
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                  style={{ color: aStat.color, background: aStat.bg }}
                                >
                                  {a.status}
                                </span>
                              </div>

                              {a.description && (
                                <p className="text-sm text-white mb-2">{a.description}</p>
                              )}

                              {/* Confidence bar */}
                              {confidence != null && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Confidence</span>
                                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--p-card-strong)', maxWidth: 120 }}>
                                    <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: aType.color }} />
                                  </div>
                                  <span className="text-xs font-bold" style={{ color: aType.color }}>{confidence}%</span>
                                </div>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {a.createdAt ? formatDateTime(a.createdAt) : '—'}
                              </p>
                            </div>
                          </div>

                          {a.notes && (
                            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${aType.color}15` }}>
                              <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Investigation Notes</p>
                              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{a.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {tab === 'Health History' && (
              histLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              ) : (
                <div className="p-6 space-y-4">
                  {/* Sparkline chart */}
                  {historyChronological.length >= 2 && (
                    <div
                      className="rounded-xl p-4"
                      style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Activity size={13} style={{ color: '#60a5fa' }} />
                        <span className="text-xs font-semibold text-white">Health Score Timeline</span>
                        <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {historyChronological.length} snapshots
                        </span>
                      </div>
                      <HealthSparkline data={historyChronological} />
                    </div>
                  )}

                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                        <TH>Timestamp</TH><TH>Health</TH><TH>Network</TH><TH>Hardware</TH><TH>Software</TH><TH>Transaction</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {(history as any[]).length === 0 ? (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No history.</td></tr>
                      ) : (history as any[]).map((h: any, i) => (
                        <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--p-card-border)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDateTime(h.timestamp)}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-bold" style={{
                              color: (h.healthScore ?? 0) >= 80 ? '#4ade80' : (h.healthScore ?? 0) >= 60 ? '#f59e0b' : '#ef4444',
                            }}>
                              {h.healthScore ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.networkScore ?? '—'}</td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.hardwareScore ?? '—'}</td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.softwareScore ?? '—'}</td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.transactionScore ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'Self-Heal' && (
              <div className="p-6">
                {(allIncs as any[]).length === 0 ? (
                  <div className="py-10 text-center">
                    <Zap size={28} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No self-heal actions yet for this ATM.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(allIncs as any[]).map((inc: any) => {
                      const healKey = ({
                        NETWORK:  'SWITCH_NETWORK', SWITCH: 'RESTART_SERVICE',
                        SERVER:   'RESTART_SERVICE', TIMEOUT: 'FLUSH_CACHE',
                        CASH_JAM: 'ALERT_ENGINEER', FRAUD: 'FREEZE_ATM',
                        HARDWARE: 'ALERT_ENGINEER', UNKNOWN: 'ALERT_ENGINEER',
                      } as any)[inc.rootCauseCategory] ?? 'ALERT_ENGINEER';
                      const healColor = HEAL_COLORS[healKey] ?? '#6b7280';
                      const sv = sevStyle(inc.severity);
                      return (
                        <div
                          key={inc.id}
                          className="rounded-xl p-4 flex items-start gap-4"
                          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${healColor}15`, border: `1px solid ${healColor}30` }}
                          >
                            <Zap size={14} style={{ color: healColor }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: healColor }}>
                                {HEAL_LABELS[healKey] ?? healKey}
                              </span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ color: sv.color, background: sv.bg }}
                              >
                                {inc.severity}
                              </span>
                            </div>
                            <p className="text-xs mt-0.5 text-white">{inc.title}</p>
                            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              Incident {inc.incidentId} · {inc.rootCauseCategory} · {formatDate(inc.createdAt)}
                            </p>
                          </div>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                            style={{
                              color: inc.status === 'AUTO_RESOLVED' || inc.status === 'RESOLVED' ? '#4ade80' : '#f59e0b',
                              background: inc.status === 'AUTO_RESOLVED' || inc.status === 'RESOLVED' ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)',
                            }}
                          >
                            {inc.status === 'AUTO_RESOLVED' ? 'AUTO RESOLVED' : inc.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
