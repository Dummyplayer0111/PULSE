import React from 'react';
import { AlertTriangle, Brain, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  useGetDashboardSummaryQuery,
  useGetIncidentsQuery,
  useGetAnomalyFlagsQuery,
  useGetSelfHealActionsQuery,
  useGetAIPredictionsQuery,
  useGetRootCauseStatsQuery,
  useGetChannelsQuery,
} from '../services/payguardApi';
import { formatDate, formatConfidence } from '../utils';
import { usePipelineSocket } from '../hooks/usePipelineSocket';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

/* ── colour helpers ──────────────────────────────────────────────────── */
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

/* ── Divider ─────────────────────────────────────────────────────────── */
const Div = () => <div style={{ height: 1, background: 'var(--p-card-border)', margin: '0' }} />;

/* ── Section Header ──────────────────────────────────────────────────── */
function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--p-card-border)' }}>
      <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--p-text-dim)', letterSpacing: '0.1em' }}>{title}</span>
      {right && <span style={{ color: 'var(--p-text-dim)' }}>{right}</span>}
    </div>
  );
}

/* ── Card shell ──────────────────────────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}>
      {children}
    </div>
  );
}

/* ── Metric strip (replaces KPI cards) ───────────────────────────────── */
function MetricStrip({ metrics }: { metrics: { label: string; value: string | number; color?: string; note?: string }[] }) {
  return (
    <Card>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
        {metrics.map((m, i) => (
          <div
            key={i}
            className="px-5 py-4"
            style={{
              borderRight: i < metrics.length - 1 ? '1px solid var(--p-card-border)' : 'none',
              borderTop: `2px solid ${m.color ?? 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--p-text-dim)', letterSpacing: '0.09em' }}>
              {m.label}
            </p>
            <p className="text-2xl font-bold leading-none" style={{ color: m.color ?? 'var(--p-text)', fontVariantNumeric: 'tabular-nums' }}>
              {m.value}
            </p>
            {m.note && <p className="text-[10px] mt-1.5" style={{ color: 'var(--p-text-dim)' }}>{m.note}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Fleet status bar ────────────────────────────────────────────────── */
function FleetBar({ online, degraded, offline, total }: { online: number; degraded: number; offline: number; total: number }) {
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '0%';
  return (
    <div>
      {/* Segmented bar */}
      <div className="flex rounded-full overflow-hidden mb-3" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
        {online   > 0 && <div style={{ width: pct(online),   background: '#22c55e', transition: 'width 0.5s' }} />}
        {degraded > 0 && <div style={{ width: pct(degraded), background: '#eab308', transition: 'width 0.5s' }} />}
        {offline  > 0 && <div style={{ width: pct(offline),  background: '#ef4444', transition: 'width 0.5s' }} />}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Online',   value: online,   color: '#22c55e' },
          { label: 'Degraded', value: degraded, color: '#eab308' },
          { label: 'Offline',  value: offline,  color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg px-3 py-2.5 text-center" style={{ background: `${color}0c`, border: `1px solid ${color}20` }}>
            <p className="text-lg font-bold leading-none" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
            <p className="text-[10px] mt-1 font-medium uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut chart ─────────────────────────────────────────────────────── */
const RC_COLORS: Record<string, string> = {
  NETWORK: '#60a5fa', HARDWARE: '#f97316', CASH_JAM: '#eab308',
  FRAUD: '#ef4444', SERVER: '#a78bfa', TIMEOUT: '#fb923c',
  SWITCH: '#34d399', UNKNOWN: '#6b7280',
};

function RootCauseDonut({ stats }: { stats: any[] }) {
  const SIZE = 120, CX = 60, CY = 60, R = 46, INNER = 28;
  const total = stats.reduce((a: number, s: any) => a + (s.count ?? 0), 0);

  if (!stats.length || total === 0) {
    return (
      <div className="p-6 text-center">
        <AlertCircle size={20} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 6px' }} />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>No incidents yet</p>
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const arcs = stats.map((s: any, i: number) => {
    const color = RC_COLORS[s.category] ?? `hsl(${i * 45},55%,55%)`;
    const sweep = ((s.count ?? 0) / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle), y2 = CY + R * Math.sin(angle);
    return {
      path: `M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
      color, pct: Math.round(((s.count ?? 0) / total) * 100),
      category: s.category, count: s.count,
    };
  });

  return (
    <div className="flex items-center gap-5 px-5 py-4">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} stroke="var(--p-card)" strokeWidth="1.5" />)}
        <circle cx={CX} cy={CY} r={INNER} fill="var(--p-gauge-inner)" />
        <text x={CX} y={CY - 2} textAnchor="middle" fill="var(--p-text)" fontSize="15" fontWeight="700" fontFamily="inherit">{total}</text>
        <text x={CX} y={CY + 11} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="inherit">total</text>
      </svg>
      <div className="flex-1 space-y-1.5">
        {stats.slice(0, 6).map((s: any, i: number) => {
          const color = RC_COLORS[s.category] ?? `hsl(${i * 45},55%,55%)`;
          const pct = total > 0 ? Math.round(((s.count ?? 0) / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0, display: 'inline-block' }} />
              <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--p-text-dim)' }}>{s.category}</span>
              <div style={{ width: 48, height: 2, borderRadius: 1, background: 'var(--p-card-strong)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 1 }} />
              </div>
              <span className="text-[10px] w-6 text-right tabular-nums" style={{ color: 'var(--p-text-dim)' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Live event row ──────────────────────────────────────────────────── */
function EventRow({ ev }: { ev: any }) {
  const hasInc = !!ev.incident;
  const color  = hasInc ? sevColor(ev.incident?.severity) : 'var(--p-text-dim)';
  const lvl    = ev.log?.logLevel ?? 'INFO';
  const lvlColor: Record<string, string> = { CRITICAL: '#ef4444', ERROR: '#f97316', WARN: '#eab308', INFO: '#6b7280' };

  return (
    <div className="grid px-5 py-2" style={{ gridTemplateColumns: '44px 1fr 1fr auto', gap: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: lvlColor[lvl] ?? '#6b7280' }}>{lvl}</span>
      <span className="text-[11px] font-mono truncate" style={{ color: 'var(--p-text-dim)' }}>{ev.log?.eventCode ?? '—'}</span>
      <span className="text-[11px] truncate" style={{ color: hasInc ? color : 'rgba(255,255,255,0.2)' }}>
        {hasInc ? ev.incident.incidentId : '—'}
      </span>
      <span className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
        {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────── */
function Skel({ h = 'h-4' }: { h?: string }) {
  return <div className={`${h} rounded animate-pulse`} style={{ background: 'var(--p-card-strong)' }} />;
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { data: summary }                              = useGetDashboardSummaryQuery(undefined, { pollingInterval: 5000 });
  const { data: incidents = [], isLoading: incLoading } = useGetIncidentsQuery(undefined, { pollingInterval: 5000 });
  const { data: anomalies = [] }                       = useGetAnomalyFlagsQuery();
  const { data: actions   = [], isLoading: shLoading }  = useGetSelfHealActionsQuery();
  const { data: preds }                                = useGetAIPredictionsQuery();
  const { data: rcStats }                              = useGetRootCauseStatsQuery();
  const { data: channels = [] }                        = useGetChannelsQuery();

  const { status: wsStatus } = usePipelineSocket();
  const pipelineEvents = useSelector((s: RootState) => s.pipeline.events);

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

  return (
    <div className="p-5 space-y-4" style={{ minHeight: '100vh' }}>

      {/* ── Critical alert banner ────────────────────────────────────── */}
      {activeAno > 0 && (
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>
            {activeAno} active anomal{activeAno === 1 ? 'y' : 'ies'} — Z-score engine flagged suspicious activity
          </span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(239,68,68,0.7)' }}>Alert</span>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold leading-none" style={{ color: 'var(--p-text)', letterSpacing: '-0.02em' }}>Operations Center</h1>
          <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-dim)' }}>ATM & payment infrastructure — real-time</p>
        </div>
        <div className="flex items-center gap-3">
          {/* WS indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>Feed</span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: wsStatus === 'connected' ? '#22c55e' : '#6b7280' }}
            >
              {wsStatus === 'connected' ? 'Live' : 'Connecting'}
            </span>
          </div>
          <span style={{ width: 1, height: 14, background: 'var(--p-card-border)', display: 'inline-block' }} />
          {/* Timestamp */}
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>{now}</span>
        </div>
      </div>

      {/* ── Metric strip ─────────────────────────────────────────────── */}
      <MetricStrip metrics={[
        { label: 'Open Incidents',   value: incLoading ? '—' : openInc,   color: openInc > 0 ? '#ef4444' : '#22c55e',   note: 'requires attention' },
        { label: 'Critical Alerts',  value: incLoading ? '—' : critical,  color: critical > 0 ? '#f97316' : '#6b7280',   note: 'severity: critical' },
        { label: 'Active Anomalies', value: activeAno,                    color: activeAno > 0 ? '#eab308' : '#6b7280',  note: 'flagged by Z-score' },
        { label: 'AI Predictions',   value: predList.length,              color: predList.length > 0 ? '#a78bfa' : '#6b7280', note: 'at-risk ATMs' },
        { label: 'Platform Health',  value: `${platformHealth}%`,         color: platformHealth >= 80 ? '#22c55e' : platformHealth >= 60 ? '#eab308' : '#ef4444', note: 'avg. ATM score' },
        { label: 'UPI Success Rate', value: `${upiRate}%`,                color: upiRate >= 95 ? '#22c55e' : '#eab308', note: 'payment channels' },
      ]} />

      {/* ── Payment channels ─────────────────────────────────────────── */}
      {(channels as any[]).length > 0 && (
        <Card>
          <SectionHead title="Payment Channels" right={
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>{(channels as any[]).filter((c: any) => c.status === 'ONLINE').length}/{(channels as any[]).length} online</span>
          } />
          <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2">
            {(channels as any[]).map((ch: any) => {
              const ok = ch.status === 'ONLINE' || ch.status === 'ACTIVE';
              return (
                <div key={ch.id} className="flex items-center gap-2">
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                  <span className="text-[11px] font-medium" style={{ color: ok ? 'var(--p-text)' : 'rgba(255,255,255,0.4)' }}>{ch.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--p-text-dim)' }}>{ch.type}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── 3-column row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Fleet Health */}
        <Card>
          <SectionHead title="Fleet Health" right={
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>{atmCounts.total} terminals</span>
          } />
          <div className="p-5">
            <FleetBar
              online={atmCounts.online}
              degraded={atmCounts.degraded}
              offline={atmCounts.offline}
              total={atmCounts.total}
            />
          </div>
        </Card>

        {/* Live Pipeline Feed */}
        <Card>
          <SectionHead title="Live Pipeline Feed" right={
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>{recentEvents.length} events</span>
          } />
          {/* Column headers */}
          {recentEvents.length > 0 && (
            <div className="grid px-5 py-1.5" style={{ gridTemplateColumns: '44px 1fr 1fr auto', gap: '0 12px', borderBottom: '1px solid var(--p-card-border)' }}>
              {['Level', 'Event', 'Incident', 'Time'].map(h => (
                <span key={h} className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>{h}</span>
              ))}
            </div>
          )}
          {recentEvents.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No events — start the simulator</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 224 }}>
              {recentEvents.map((ev: any, i: number) => <EventRow key={`${ev.log?.id}-${i}`} ev={ev} />)}
            </div>
          )}
        </Card>

        {/* Self-Heal Log */}
        <Card>
          <SectionHead title="Self-Heal Log" right={
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>{(actions as any[]).length} actions</span>
          } />
          {shLoading ? (
            <div className="p-5 space-y-2">{[1,2,3].map(i => <Skel key={i} h="h-8" />)}</div>
          ) : (actions as any[]).length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No actions yet</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 224 }}>
              {(actions as any[]).slice(0, 10).map((a: any) => (
                <div key={a.id} className="grid px-5 py-2.5" style={{ gridTemplateColumns: '1fr auto auto', gap: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                  <span className="text-[11px] truncate font-medium" style={{ color: 'var(--p-text)' }}>
                    {(a.action_type || a.actionType || '—').replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>
                    {formatDate(a.created_at || a.createdAt)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase" style={{ color: staColor(a.status), letterSpacing: '0.04em' }}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Incidents table ───────────────────────────────────────────── */}
      <Card>
        <SectionHead title="Recent Incidents" right={
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--p-text-dim)' }}>
            {Math.min((incidents as any[]).length, 8)} of {(incidents as any[]).length}
          </span>
        } />
        {incLoading ? (
          <div className="p-5 space-y-2">{[1,2,3,4].map(i => <Skel key={i} h="h-9" />)}</div>
        ) : (incidents as any[]).length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 size={22} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 8px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>No incidents recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                  {['ID', 'Title', 'Root Cause', 'Confidence', 'Severity', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(incidents as any[]).slice(0, 8).map((inc: any) => (
                  <tr
                    key={inc.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--p-card-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-3 font-mono text-[11px]" style={{ color: 'var(--p-text-dim)', whiteSpace: 'nowrap' }}>
                      {String(inc.incidentId || inc.id).slice(0, 14)}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--p-text)', maxWidth: 180 }}>
                      <span className="truncate block">{inc.title || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-[11px] font-medium" style={{ color: 'var(--p-text-dim)', whiteSpace: 'nowrap' }}>
                      {inc.rootCauseCategory || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {inc.aiConfidence != null && (
                        <div className="flex items-center gap-2">
                          <div className="rounded-sm overflow-hidden" style={{ width: 44, height: 2, background: 'rgba(255,255,255,0.07)' }}>
                            <div style={{ width: `${Math.round(inc.aiConfidence * 100)}%`, height: '100%', background: '#a78bfa' }} />
                          </div>
                          <span className="text-[11px] tabular-nums font-semibold" style={{ color: '#a78bfa' }}>
                            {Math.round(inc.aiConfidence * 100)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sevColor(inc.severity) }}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                        style={{ color: staColor(inc.status), background: `${staColor(inc.status)}12`, border: `1px solid ${staColor(inc.status)}25` }}
                      >
                        {inc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[11px] tabular-nums" style={{ color: 'var(--p-text-dim)', whiteSpace: 'nowrap' }}>
                      {formatDate(inc.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── AI Predictions + Root Cause ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AI Failure Predictions */}
        <Card>
          <SectionHead title="AI Failure Predictions" right={
            <span className="text-[10px]" style={{ color: '#a78bfa' }}>{predList.length} at-risk</span>
          } />
          {predList.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Brain size={20} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 6px' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Feed more health data to generate predictions</p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid px-5 py-2" style={{ gridTemplateColumns: '1fr 80px 60px', borderBottom: '1px solid var(--p-card-border)' }}>
                {['ATM', 'Horizon', 'Probability'].map(h => (
                  <span key={h} className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>{h}</span>
                ))}
              </div>
              {predList.slice(0, 6).map((p: any, i: number) => {
                const prob = p.failureProbability ?? p.probability ?? p.confidence ?? 0;
                const color = prob >= 0.8 ? '#ef4444' : prob >= 0.5 ? '#f97316' : '#eab308';
                return (
                  <div key={i} className="grid px-5 py-2.5" style={{ gridTemplateColumns: '1fr 80px 60px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
                        {p.atmName || `ATM-${i + 1}`}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--p-text-dim)' }}>
                        {p.weakestComponent || p.failureCategory || 'Unknown component'}
                      </p>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>{p.predictedIn || '< 24h'}</span>
                    <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{formatConfidence(prob)}</span>
                  </div>
                );
              })}
            </>
          )}
        </Card>

        {/* Root Cause Distribution */}
        <Card>
          <SectionHead title="Root Cause Distribution" />
          <RootCauseDonut stats={statsList} />
        </Card>

      </div>
    </div>
  );
}
