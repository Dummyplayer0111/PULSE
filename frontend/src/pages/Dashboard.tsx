import React, { useRef, useEffect, useState } from 'react';
import { AlertTriangle, Brain, ShieldAlert, CheckCircle2, AlertCircle, TrendingUp, Activity, Zap, Shield, Clock, ArrowUp, ArrowDown, Minus, Bot } from 'lucide-react';
import {
  useGetDashboardSummaryQuery,
  useGetIncidentsQuery,
  useGetAnomalyFlagsQuery,
  useGetSelfHealActionsQuery,
  useGetAIPredictionsQuery,
  useGetRootCauseStatsQuery,
  useGetChannelsQuery,
  useGetSLAMetricsQuery,
  useGetDashboardTrendsQuery,
} from '../services/payguardApi';
import { formatDate, formatConfidence } from '../utils';
import { usePipelineSocket } from '../hooks/usePipelineSocket';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useToast } from '../components/notifications/ToastProvider';
import { useCountUp, useCountUpFloat } from '../hooks/useCountUp';
import { BentoCard } from '../components/BentoCard';
import DonutChart from '../components/charts/DonutChart';

/* ── colour helpers ─────────────────────────────────────────────────────── */
function sevColor(s: string) {
  return ({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' } as any)[s] ?? '#6b7280';
}
function staColor(s: string) {
  return ({
    OPEN: '#60a5fa', INVESTIGATING: '#f97316', ESCALATED: '#ef4444',
    RESOLVED: '#22c55e', AUTO_RESOLVED: '#22c55e', SUCCESS: '#22c55e',
    FAILED: '#ef4444', PENDING: '#6b7280', ACTIVE: '#60a5fa',
  } as any)[s] ?? '#6b7280';
}

/* ── Section header ─────────────────────────────────────────────────────── */
function SH({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--p-card-border)' }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-dim)' }}>{title}</span>
      {right && <span style={{ color: 'var(--p-text-dim)', fontSize: 10 }}>{right}</span>}
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */
function Skel({ h = 'h-4' }: { h?: string }) {
  return <div className={`${h} rounded animate-pulse`} style={{ background: 'var(--p-card-strong)' }} />;
}

/* ── Mini SVG sparkline ─────────────────────────────────────────────────── */
function MiniSparkline({ data, color = '#e8af48', width = 80, height = 20 }: { data: (number | null)[]; color?: string; width?: number; height?: number }) {
  const valid = data.filter((v): v is number => v != null);
  if (valid.length < 2) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const points = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <circle cx={parseFloat(points.split(' ').pop()!.split(',')[0])} cy={parseFloat(points.split(' ').pop()!.split(',')[1])} r={2} fill={color} />
    </svg>
  );
}

/* ── Delta arrow badge ─────────────────────────────────────────────────── */
function DeltaBadge({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  if (diff === 0) return <Minus size={9} style={{ color: 'var(--p-text-dim)', opacity: 0.5 }} />;
  const isUp = diff > 0;
  const isGood = invert ? !isUp : isUp;
  const color = isGood ? '#22c55e' : '#ef4444';
  const Icon = isUp ? ArrowUp : ArrowDown;
  const pct = previous > 0 ? Math.round(Math.abs(diff / previous) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Icon size={9} style={{ color }} />
      {pct > 0 && <span style={{ fontSize: 8.5, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>}
    </div>
  );
}

/* ── Animated metric KPI card ───────────────────────────────────────────── */
function MetricCard({
  label, rawValue, suffix = '', prefix = '', color = '#e8af48',
  note, icon: Icon, delay = 0, isFloat = false,
  delta, sparkline,
}: {
  label: string; rawValue: number; suffix?: string; prefix?: string;
  color?: string; note?: string; icon?: any; delay?: number; isFloat?: boolean;
  delta?: { current: number; previous: number; invert?: boolean };
  sparkline?: (number | null)[];
}) {
  const intVal   = useCountUp(isFloat ? 0 : rawValue, 1600);
  const floatVal = useCountUpFloat(isFloat ? rawValue : 0, 1, 1600);

  const displayVal = isFloat ? floatVal : String(intVal);

  return (
    <BentoCard delay={delay} style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-dim)', margin: 0 }}>
            {label}
          </p>
          {Icon && (
            <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}14`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={12} style={{ color }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {prefix}{displayVal}{suffix}
          </p>
          {delta && <DeltaBadge current={delta.current} previous={delta.previous} invert={delta.invert} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          {note && <p style={{ fontSize: 9.5, color: 'var(--p-text-dim)', margin: 0 }}>{note}</p>}
          {sparkline && <MiniSparkline data={sparkline} color={color} />}
        </div>
      </div>
      {/* Micro spark line at bottom */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${color}00, ${color}40, ${color}00)`, marginTop: 4 }} />
    </BentoCard>
  );
}

/* ── Fleet status bar ───────────────────────────────────────────────────── */
function FleetBar({ online, degraded, offline, total }: { online: number; degraded: number; offline: number; total: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '0%';

  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 6, background: 'rgba(255,255,255,0.05)', marginBottom: 14 }}>
        {online   > 0 && <div style={{ width: animated ? pct(online)   : '0%', background: '#22c55e', transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />}
        {degraded > 0 && <div style={{ width: animated ? pct(degraded) : '0%', background: '#eab308', transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1) 0.1s' }} />}
        {offline  > 0 && <div style={{ width: animated ? pct(offline)  : '0%', background: '#ef4444', transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1) 0.2s' }} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[{ l: 'Online', v: online, c: '#22c55e' }, { l: 'Degraded', v: degraded, c: '#eab308' }, { l: 'Offline', v: offline, c: '#ef4444' }].map(({ l, v, c }) => (
          <div key={l} style={{ borderRadius: 8, padding: '10px 12px', textAlign: 'center', background: `${c}0c`, border: `1px solid ${c}20` }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: c, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{v}</p>
            <p style={{ fontSize: 9, marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-text-dim)', margin: '3px 0 0' }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Animated AI confidence bar ─────────────────────────────────────────── */
function ConfBar({ value, color = '#a78bfa' }: { value: number; color?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 400); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 44, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{Math.round(value)}%</span>
    </div>
  );
}

/* ── Event row ──────────────────────────────────────────────────────────── */
function EventRow({ ev }: { ev: any }) {
  const hasInc  = !!ev.incident;
  const color   = hasInc ? sevColor(ev.incident?.severity) : 'var(--p-text-dim)';
  const lvl     = ev.log?.logLevel ?? 'INFO';
  const lvlColor: Record<string, string> = { CRITICAL: '#ef4444', ERROR: '#f97316', WARN: '#eab308', INFO: '#6b7280' };

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr auto', gap: '0 12px', padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.035)', alignItems: 'center' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--p-card-hover)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: lvlColor[lvl] ?? '#6b7280' }}>{lvl}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--p-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.log?.eventCode ?? '—'}</span>
      <span style={{ fontSize: 11, color: hasInc ? color : 'rgba(255,255,255,0.18)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {hasInc ? ev.incident.incidentId : '—'}
      </span>
      <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.18)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

/* ── Root cause row (enhanced progress list) ────────────────────────────── */
const RC_COLORS: Record<string, string> = {
  NETWORK: '#60a5fa', HARDWARE: '#f97316', CASH_JAM: '#eab308',
  FRAUD: '#ef4444', SERVER: '#a78bfa', TIMEOUT: '#fb923c',
  SWITCH: '#34d399', UNKNOWN: '#6b7280',
};
const RC_ICONS: Record<string, string> = {
  NETWORK: '🌐', HARDWARE: '⚙️', CASH_JAM: '💵', FRAUD: '🚨',
  SERVER: '🖥️', TIMEOUT: '⏱️', SWITCH: '🔁', UNKNOWN: '❓',
};

function RCRow({ cat, count, pct, total, index }: { cat: string; count: number; pct: number; total: number; index: number }) {
  const color = RC_COLORS[cat] ?? '#6b7280';
  const [barW, setBarW]         = useState(0);
  const [visible, setVisible]   = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true),  index * 80);
    const t2 = setTimeout(() => setBarW(pct),       index * 80 + 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [index, pct]);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.035)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-12px)',
        transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'default',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(5px)'; (e.currentTarget as HTMLElement).style.background = 'var(--p-card-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 13 }}>{RC_ICONS[cat] ?? '📊'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            <span style={{ fontSize: 10, color: 'var(--p-text-dim)' }}>{pct}%</span>
          </div>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1.3s cubic-bezier(0.16,1,0.3,1)', boxShadow: `0 0 8px ${color}50` }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { data: summary }                               = useGetDashboardSummaryQuery(undefined, { pollingInterval: 5000 });
  const { data: incidents = [], isLoading: incLoading } = useGetIncidentsQuery(undefined, { pollingInterval: 5000 });
  const { data: anomalies = [] }                        = useGetAnomalyFlagsQuery();
  const { data: actions   = [], isLoading: shLoading }  = useGetSelfHealActionsQuery();
  const { data: preds }                                 = useGetAIPredictionsQuery();
  const { data: rcStats }                               = useGetRootCauseStatsQuery();
  const { data: channels = [] }                         = useGetChannelsQuery();
  const { data: slaData }                               = useGetSLAMetricsQuery(undefined, { pollingInterval: 15000 });
  const { data: trends }                                = useGetDashboardTrendsQuery(undefined, { pollingInterval: 15000 });

  const { status: wsStatus } = usePipelineSocket();
  const pipelineEvents = useSelector((s: RootState) => s.pipeline.events);
  const { push: pushToast } = useToast();

  // Fire toast for new incidents detected via REST polling (fallback for InMemoryChannelLayer)
  const seenIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (incLoading || incidents.length === 0) return;
    const all = incidents as any[];
    // On first load, seed the set without firing toasts
    if (seenIdsRef.current.size === 0) {
      all.forEach((i: any) => seenIdsRef.current.add(i.id));
      return;
    }
    for (const inc of all) {
      if (!seenIdsRef.current.has(inc.id)) {
        seenIdsRef.current.add(inc.id);
        // Only toast for HIGH/CRITICAL — skip low-severity noise
        if (inc.severity === 'CRITICAL') {
          pushToast('critical', `CRITICAL: ${inc.title}`, `Incident ${inc.incidentId} — ${inc.rootCauseCategory} detected`);
        } else if (inc.severity === 'HIGH') {
          pushToast('high', inc.title, `${inc.rootCauseCategory} failure — ${inc.incidentId}`);
        }
      }
    }
  }, [incidents, incLoading]);

  const openInc        = summary?.activeIncidents ?? incidents.filter((i: any) => i.status !== 'RESOLVED' && i.status !== 'AUTO_RESOLVED').length;
  const critical       = incidents.filter((i: any) => i.severity === 'CRITICAL').length;
  const activeAno      = anomalies.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FLAGGED').length;
  const predList       = preds?.predictions ?? [];
  const statsList      = rcStats?.stats ?? [];
  const atmCounts      = summary?.atms ?? { online: 0, offline: 0, degraded: 0, total: 0 };
  const platformHealth = Math.round(summary?.platformHealth ?? 100);
  const upiRate        = summary?.upiSuccessRate ?? 100;
  const recentEvents   = pipelineEvents.slice(0, 14);
  const now            = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* Donut data */
  const donutData = statsList.map((s: any) => ({
    label: s.category,
    value: s.count ?? 0,
    color: RC_COLORS[s.category] ?? '#6b7280',
  }));

  return (
    <div className="p-5 space-y-4" style={{ minHeight: '100vh' }}>

      {/* ── Critical alert banner ─────────────────────────────────────── */}
      {activeAno > 0 && (
        <div
          style={{ borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', animation: 'bentoEnter 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <ShieldAlert size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
            {activeAno} active anomal{activeAno === 1 ? 'y' : 'ies'} — Z-score engine flagged suspicious activity
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(239,68,68,0.65)' }}>Alert</span>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--p-text)', letterSpacing: '-0.02em', margin: 0 }}>Operations Center</h1>
          <p style={{ fontSize: 11, color: 'var(--p-text-dim)', marginTop: 3 }}>ATM & payment infrastructure — real-time</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: wsStatus === 'connected' ? '#22c55e' : '#6b7280', boxShadow: wsStatus === 'connected' ? '0 0 6px #22c55e' : undefined }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: wsStatus === 'connected' ? '#22c55e' : '#6b7280' }}>
              {wsStatus === 'connected' ? 'Live' : 'Connecting'}
            </span>
          </div>
          <div style={{ width: 1, height: 14, background: 'var(--p-card-border)' }} />
          <span style={{ fontSize: 10, color: 'var(--p-text-dim)', fontVariantNumeric: 'tabular-nums' }}>{now}</span>
        </div>
      </div>

      {/* ── Metric strip — individual bento cards ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricCard label="Open Incidents"   rawValue={incLoading ? 0 : openInc}       color={openInc > 0 ? '#ef4444' : '#22c55e'}   note="requires attention"  icon={AlertTriangle} delay={0}
          delta={trends ? { current: trends.openIncidents.current, previous: trends.openIncidents.previous, invert: true } : undefined}
          sparkline={trends?.incidentSparkline} />
        <MetricCard label="Critical Alerts"  rawValue={incLoading ? 0 : critical}       color={critical > 0 ? '#f97316' : '#6b7280'}  note="severity: critical"  icon={AlertCircle}   delay={60}
          delta={trends ? { current: trends.criticalAlerts.current, previous: trends.criticalAlerts.previous, invert: true } : undefined} />
        <MetricCard label="Active Anomalies" rawValue={activeAno}                        color={activeAno > 0 ? '#eab308' : '#6b7280'} note="flagged by Z-score"  icon={ShieldAlert}   delay={120}
          delta={trends ? { current: trends.activeAnomalies.current, previous: trends.activeAnomalies.previous, invert: true } : undefined} />
        <MetricCard label="Platform Health"  rawValue={platformHealth}       suffix="%"  color={platformHealth >= 80 ? '#22c55e' : platformHealth >= 60 ? '#eab308' : '#ef4444'} note="avg. ATM score" icon={Activity} delay={180} isFloat
          sparkline={trends?.healthSparkline} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricCard label="AI Predictions"   rawValue={predList.length}                  color={predList.length > 0 ? '#a78bfa' : '#6b7280'} note="at-risk ATMs" icon={Brain}         delay={200} />
        <MetricCard label="UPI Success Rate" rawValue={upiRate}              suffix="%"  color={upiRate >= 95 ? '#22c55e' : '#eab308'} note="payment channels" icon={TrendingUp}     delay={240} isFloat />
        <MetricCard label="Zero-Touch Rate"  rawValue={slaData?.zeroTouchRate ?? 0}  suffix="%" color={slaData?.zeroTouchRate >= 50 ? '#22c55e' : '#eab308'} note="auto-resolved" icon={Bot} delay={280} isFloat
          delta={slaData ? { current: slaData.zeroTouchRate, previous: slaData.prevWeekZeroTouchRate } : undefined} />
        <MetricCard label="MTTR" rawValue={Math.round((slaData?.mttrSeconds ?? 0) / 60)} suffix="m" color={(slaData?.mttrSeconds ?? 0) / 60 <= 30 ? '#22c55e' : '#f97316'} note="mean time to resolve" icon={Clock} delay={320} />
      </div>

      {/* ── Payment channels ──────────────────────────────────────────── */}
      {(channels as any[]).length > 0 && (
        <BentoCard delay={320} noPad>
          <SH title="Payment Channels" right={
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(channels as any[]).filter((c: any) => c.status === 'ONLINE').length}/{(channels as any[]).length} online</span>
          } />
          <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
            {(channels as any[]).map((ch: any) => {
              const ok = ch.status === 'ONLINE' || ch.status === 'ACTIVE';
              return (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', flexShrink: 0, display: 'inline-block', boxShadow: ok ? '0 0 5px #22c55e' : undefined }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: ok ? 'var(--p-text)' : 'rgba(255,255,255,0.35)' }}>{ch.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--p-text-dim)' }}>{ch.type}</span>
                </div>
              );
            })}
          </div>
        </BentoCard>
      )}

      {/* ── SLA Metrics strip ──────────────────────────────────────────── */}
      {slaData && (
        <BentoCard delay={340} noPad>
          <SH title="SLA Performance" right={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{slaData.totalIncidents30d} incidents · 30d</span>} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0 }}>
            {[
              { label: 'MTTA', value: `${Math.round(slaData.mttaSeconds / 60)}m`, sub: 'avg acknowledge', color: slaData.mttaSeconds / 60 <= 15 ? '#22c55e' : '#f97316' },
              { label: 'MTTR', value: `${Math.round(slaData.mttrSeconds / 60)}m`, sub: 'avg resolve', color: slaData.mttrSeconds / 3600 <= 4 ? '#22c55e' : '#f97316' },
              { label: 'MTTA Breaches', value: String(slaData.mttaBreaches), sub: '> 15 min SLA', color: slaData.mttaBreaches === 0 ? '#22c55e' : '#ef4444' },
              { label: 'MTTR Breaches', value: String(slaData.mttrBreaches), sub: '> 4 hr SLA', color: slaData.mttrBreaches === 0 ? '#22c55e' : '#ef4444' },
              { label: 'Zero-Touch', value: `${slaData.zeroTouchRate}%`, sub: 'auto-resolved', color: slaData.zeroTouchRate >= 50 ? '#22c55e' : '#eab308' },
            ].map((m, i) => (
              <div key={m.label} style={{ padding: '16px 20px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--p-card-border)' : 'none' }}>
                <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-dim)', margin: '0 0 8px' }}>{m.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: m.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{m.value}</p>
                <p style={{ fontSize: 9, color: 'var(--p-text-dim)', margin: '4px 0 0' }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </BentoCard>
      )}

      {/* ── 3-column row ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

        {/* Fleet Health */}
        <BentoCard delay={350} noPad>
          <SH title="Fleet Health" right={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{atmCounts.total} terminals</span>} />
          <div style={{ padding: 20 }}>
            <FleetBar online={atmCounts.online} degraded={atmCounts.degraded} offline={atmCounts.offline} total={atmCounts.total} />
          </div>
        </BentoCard>

        {/* Live Pipeline Feed */}
        <BentoCard delay={400} noPad>
          <SH title="Live Pipeline Feed" right={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{recentEvents.length} events</span>} />
          {recentEvents.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr auto', gap: '0 12px', padding: '6px 20px', borderBottom: '1px solid var(--p-card-border)' }}>
              {['Level', 'Event', 'Incident', 'Time'].map(h => (
                <span key={h} style={{ fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)' }}>{h}</span>
              ))}
            </div>
          )}
          {recentEvents.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>No events — start the simulator</p>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 224 }}>
              {recentEvents.map((ev: any, i: number) => <EventRow key={`${ev.log?.id}-${i}`} ev={ev} />)}
            </div>
          )}
        </BentoCard>

        {/* Self-Heal Log */}
        <BentoCard delay={450} noPad>
          <SH title="Self-Heal Log" right={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{(actions as any[]).length} actions</span>} />
          {shLoading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <Skel key={i} h="h-8" />)}</div>
          ) : (actions as any[]).length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>No actions yet</p>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 224 }}>
              {(actions as any[]).slice(0, 10).map((a: any) => {
                const sc = staColor(a.status);
                return (
                  <div
                    key={a.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 12px', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.035)', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--p-card-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(a.action_type || a.actionType || '—').replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 9.5, color: 'var(--p-text-dim)', fontVariantNumeric: 'tabular-nums' }}>{formatDate(a.created_at || a.createdAt)}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: sc, background: `${sc}14`, border: `1px solid ${sc}25`, borderRadius: 4, padding: '2px 6px' }}>{a.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </div>

      {/* ── Incidents table ───────────────────────────────────────────── */}
      <BentoCard delay={480} noPad>
        <SH title="Recent Incidents" right={
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.min((incidents as any[]).length, 8)} of {(incidents as any[]).length}</span>
        } />
        {incLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4].map(i => <Skel key={i} h="h-9" />)}</div>
        ) : (incidents as any[]).length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <CheckCircle2 size={22} style={{ color: 'rgba(255,255,255,0.07)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>No incidents recorded.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                  {['ID', 'Title', 'Root Cause', 'Confidence', 'Severity', 'Status', 'Created'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(incidents as any[]).slice(0, 8).map((inc: any, rowIdx: number) => {
                  const sc = sevColor(inc.severity);
                  const stc = staColor(inc.status);
                  return (
                    <tr
                      key={inc.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--p-card-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 20px', fontSize: 10.5, fontFamily: 'monospace', color: 'var(--p-text-dim)', whiteSpace: 'nowrap' }}>
                        {String(inc.incidentId || inc.id).slice(0, 14)}
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--p-text)', maxWidth: 180 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title || '—'}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 11, fontWeight: 600, color: RC_COLORS[inc.rootCauseCategory] ?? 'var(--p-text-dim)', whiteSpace: 'nowrap' }}>
                        {RC_ICONS[inc.rootCauseCategory] ?? ''} {inc.rootCauseCategory || '—'}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        {inc.aiConfidence != null && (
                          <ConfBar value={Math.round(inc.aiConfidence * 100)} />
                        )}
                      </td>
                      <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: sc, background: `${sc}14`, border: `1px solid ${sc}25`, borderRadius: 5, padding: '3px 7px' }}>
                          {inc.severity}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: stc, background: `${stc}12`, border: `1px solid ${stc}22`, borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap' }}>
                          {(inc.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 10.5, color: 'var(--p-text-dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatDate(inc.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

      {/* ── AI Predictions + Root Cause ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* AI Failure Predictions */}
        <BentoCard delay={520} noPad>
          <SH title="AI Failure Predictions" right={<span style={{ color: '#a78bfa' }}>{predList.length} at-risk</span>} />
          {predList.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <Brain size={20} style={{ color: 'rgba(255,255,255,0.07)', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Feed more health data to generate predictions</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px', gap: '0 12px', padding: '7px 20px', borderBottom: '1px solid var(--p-card-border)' }}>
                {['ATM', 'Horizon', 'Probability'].map(h => (
                  <span key={h} style={{ fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)' }}>{h}</span>
                ))}
              </div>
              {predList.slice(0, 6).map((p: any, i: number) => {
                const prob  = p.failureProbability ?? p.probability ?? p.confidence ?? 0;
                const color = prob >= 0.8 ? '#ef4444' : prob >= 0.5 ? '#f97316' : '#eab308';
                return (
                  <div
                    key={i}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px', gap: '0 12px', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--p-card-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>{p.atmName || `ATM-${i + 1}`}</p>
                      <p style={{ fontSize: 10, color: 'var(--p-text-dim)', margin: '2px 0 0' }}>{p.weakestComponent || p.failureCategory || 'Unknown'}</p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--p-text-dim)' }}>{p.predictedIn || '< 24h'}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{formatConfidence(prob)}</span>
                  </div>
                );
              })}
            </>
          )}
        </BentoCard>

        {/* Root Cause Distribution — upgraded */}
        <BentoCard delay={570} noPad>
          <SH title="Root Cause Distribution" />
          {statsList.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <AlertCircle size={20} style={{ color: 'rgba(255,255,255,0.07)', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>No incidents yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Donut */}
              <div style={{ padding: '16px 20px', flexShrink: 0 }}>
                <DonutChart data={donutData} size={148} title="incidents" showLegend={false} />
              </div>
              {/* Animated progress list */}
              <div style={{ flex: 1, borderLeft: '1px solid var(--p-card-border)', paddingTop: 8, paddingBottom: 8 }}>
                {statsList.slice(0, 6).map((s: any, i: number) => {
                  const total = statsList.reduce((a: number, x: any) => a + (x.count ?? 0), 0);
                  const pct   = total > 0 ? Math.round(((s.count ?? 0) / total) * 100) : 0;
                  return <RCRow key={s.category} cat={s.category} count={s.count ?? 0} pct={pct} total={total} index={i} />;
                })}
              </div>
            </div>
          )}
        </BentoCard>
      </div>
    </div>
  );
}
