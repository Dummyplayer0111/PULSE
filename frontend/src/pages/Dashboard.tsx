import React from 'react';
import {
  AlertTriangle, Activity, ShieldAlert, Brain, Zap, TrendingUp,
  Wifi, WifiOff, Server, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import {
  useGetDashboardSummaryQuery,
  useGetIncidentsQuery,
  useGetAnomalyFlagsQuery,
  useGetSelfHealActionsQuery,
  useGetAIPredictionsQuery,
  useGetRootCauseStatsQuery,
  useGetChannelsQuery,
} from '../services/pulseApi';
import { formatDate, formatConfidence } from '../utils';
import { usePipelineSocket } from '../hooks/usePipelineSocket';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

/* ── helpers ─────────────────────────────────────────────────────────── */
function sev(s: string) {
  return ({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' } as any)[s] ?? '#6b7280';
}
function sta(s: string) {
  return ({
    OPEN: '#60a5fa', RESOLVED: '#4ade80', ACTIVE: '#60a5fa',
    ACKNOWLEDGED: '#a78bfa', AUTO_RESOLVED: '#4ade80',
    FAILED: '#ef4444', SUCCESS: '#4ade80',
    PENDING: '#9ca3af', REVIEWED: '#4ade80', DISMISSED: '#6b7280',
  } as any)[s] ?? '#9ca3af';
}

/* ── KPI Card ─────────────────────────────────────────────────────────── */
function KPICard({ label, value, Icon, color, sub }: {
  label: string; value: string | number; Icon: any; color: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div className="absolute inset-x-0 top-0" style={{ height: '1px', background: `linear-gradient(90deg,transparent,${color}55,transparent)` }} />
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}16`, border: `1px solid ${color}28` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {sub && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color, background: `${color}15` }}>{sub}</span>}
      </div>
      <p className="text-2xl font-bold text-white leading-none">{value}</p>
      <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</p>
    </div>
  );
}

/* ── Health Gauge ─────────────────────────────────────────────────────── */
function HealthGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 80 ? '#4ade80' : clamped >= 60 ? '#f59e0b' : '#ef4444';
  const deg = (clamped / 100) * 360;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 100, height: 100 }}>
        <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.06) ${deg}deg)` }} />
        <div className="absolute rounded-full flex flex-col items-center justify-center" style={{ inset: 7, background: '#0b0b0f' }}>
          <span className="text-xl font-bold" style={{ color }}>{clamped}</span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-white">Platform Health</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {clamped >= 80 ? 'All systems nominal' : clamped >= 60 ? 'Degraded performance' : 'Critical — action needed'}
        </p>
      </div>
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────── */
function Panel({ title, children, headerRight }: { title: string; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

/* ── Live Feed Row ────────────────────────────────────────────────────── */
function LiveEventRow({ ev }: { ev: any }) {
  const color = ev.incident
    ? (({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' } as any)[ev.incident?.severity] ?? '#6b7280')
    : '#4ade80';
  return (
    <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{ color, background: `${color}1a`, border: `1px solid ${color}30` }}>
        {ev.log?.logLevel ?? 'INFO'}
      </span>
      <span className="text-[11px] font-mono shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {ev.log?.eventCode ?? '—'}
      </span>
      <span className="text-[10px] flex-1 truncate" style={{ color: ev.incident ? color : 'rgba(255,255,255,0.28)' }}>
        {ev.incident ? `→ ${ev.incident.incidentId}` : 'OK'}
      </span>
      <span className="text-[9px] shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>
        {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
function Skeleton({ h = 'h-4' }: { h?: string }) {
  return <div className={`${h} rounded-lg animate-pulse`} style={{ background: 'rgba(255,255,255,0.06)' }} />;
}

/* ── main page ───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary                               } = useGetDashboardSummaryQuery(undefined, { pollingInterval: 5000 });
  const { data: incidents = [], isLoading: incLoading } = useGetIncidentsQuery(undefined, { pollingInterval: 5000 });
  const { data: anomalies = []                        } = useGetAnomalyFlagsQuery();
  const { data: actions   = [], isLoading: shLoading  } = useGetSelfHealActionsQuery();
  const { data: preds                                 } = useGetAIPredictionsQuery();
  const { data: rcStats                               } = useGetRootCauseStatsQuery();
  const { data: channels  = []                        } = useGetChannelsQuery();

  const { status: wsStatus } = usePipelineSocket();
  const pipelineEvents = useSelector((s: RootState) => s.pipeline.events);

  const openInc   = summary?.activeIncidents ?? incidents.filter((i: any) => i.status !== 'RESOLVED' && i.status !== 'AUTO_RESOLVED').length;
  const critical  = incidents.filter((i: any) => i.severity === 'CRITICAL').length;
  const activeAno = anomalies.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FLAGGED').length;
  const predList  = preds?.predictions ?? [];
  const statsList = rcStats?.stats ?? [];

  const atmCounts      = summary?.atms ?? { online: 0, offline: 0, degraded: 0, total: 0 };
  const platformHealth = Math.round(summary?.platformHealth ?? 100);
  const upiRate        = summary?.upiSuccessRate ?? 100;
  const recentEvents   = pipelineEvents.slice(0, 12);

  return (
    <div className="p-5 space-y-4" style={{ color: '#fff', minHeight: '100vh' }}>

      {/* Anomaly Banner */}
      {activeAno > 0 && (
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <AlertTriangle size={13} style={{ color: '#ef4444' }} />
          <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>
            {activeAno} active anomal{activeAno === 1 ? 'y' : 'ies'} — Z-score engine flagged suspicious activity
          </span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>ALERT</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Operations Center</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>PULSE real-time ATM & payment monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          {/* WS status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {wsStatus === 'connected'
              ? <><Wifi size={11} style={{ color: '#4ade80' }} /><span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>Live</span></>
              : <><WifiOff size={11} style={{ color: '#6b7280' }} /><span className="text-[10px]" style={{ color: '#6b7280' }}>Connecting…</span></>}
          </div>
          {/* Fleet quick stats */}
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Server size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-semibold text-white">{atmCounts.total} ATMs</span>
            <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
            {[
              { count: atmCounts.online,   color: '#4ade80', label: 'up' },
              { count: atmCounts.degraded, color: '#f59e0b', label: 'deg' },
              { count: atmCounts.offline,  color: '#ef4444', label: 'dn' },
            ].map(({ count, color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className="text-xs font-bold" style={{ color }}>{count}</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
              </div>
            ))}
            <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <span className="text-xs font-bold" style={{ color: upiRate >= 95 ? '#4ade80' : '#f59e0b' }}>{upiRate}%</span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>UPI</span>
          </div>
        </div>
      </div>

      {/* Payment Channel pills */}
      {(channels as any[]).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(channels as any[]).map((ch: any) => {
            const ok = ch.status === 'ONLINE' || ch.status === 'ACTIVE';
            return (
              <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: ok ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${ok ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#4ade80' : '#ef4444' }} />
                <span className="text-xs font-semibold" style={{ color: ok ? '#4ade80' : '#ef4444' }}>{ch.name}</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{ch.type}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI row — 2 cols on sm, 4 cols on lg+ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Open Incidents"   value={incLoading ? '—' : openInc}   Icon={AlertTriangle} color="#ef4444" sub="active" />
        <KPICard label="Critical Alerts"  value={incLoading ? '—' : critical}  Icon={Activity}      color="#f97316" sub="urgent" />
        <KPICard label="Active Anomalies" value={activeAno}                    Icon={ShieldAlert}   color="#f59e0b" sub="flagged" />
        <KPICard label="AI Predictions"   value={predList.length}              Icon={Brain}         color="#a78bfa" sub="pending" />
      </div>

      {/* 3-column row — stacks to 1 col below lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* System Health */}
        <Panel title="System Health">
          <div className="p-5 flex flex-col items-center gap-4">
            <HealthGauge score={platformHealth} />
            <div className="w-full grid grid-cols-3 gap-2">
              {[
                { label: 'Online',   value: atmCounts.online,   color: '#4ade80' },
                { label: 'Degraded', value: atmCounts.degraded, color: '#f59e0b' },
                { label: 'Offline',  value: atmCounts.offline,  color: '#ef4444' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-2 text-center" style={{ background: `${color}0d`, border: `1px solid ${color}1a` }}>
                  <p className="text-base font-bold" style={{ color }}>{value}</p>
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Live Pipeline Feed */}
        <Panel
          title="Live Pipeline Feed"
          headerRight={
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: wsStatus === 'connected' ? '#4ade80' : '#6b7280', animation: wsStatus === 'connected' ? 'pulse 2s infinite' : 'none' }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{recentEvents.length} events</span>
            </div>
          }
        >
          {recentEvents.length === 0 ? (
            <div className="p-8 text-center">
              <Activity size={22} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 8px' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No events yet — start the simulator</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 230 }}>
              {recentEvents.map((ev: any, i: number) => <LiveEventRow key={`${ev.log?.id}-${i}`} ev={ev} />)}
            </div>
          )}
        </Panel>

        {/* Self-Heal Actions */}
        <Panel title="Self-Heal Actions">
          {shLoading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} h="h-10" />)}
            </div>
          ) : (actions as any[]).length === 0 ? (
            <div className="p-8 text-center">
              <Zap size={22} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 8px' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No actions yet.</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 230 }}>
              {(actions as any[]).slice(0, 10).map((a: any) => (
                <div key={a.id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${sta(a.status)}1a`, border: `1px solid ${sta(a.status)}35` }}>
                    <Zap size={10} style={{ color: sta(a.status) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{a.action_type || a.actionType || 'Action'}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatDate(a.created_at || a.createdAt)}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium" style={{ color: sta(a.status), background: `${sta(a.status)}1a` }}>
                    {a.status || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Recent Incidents table */}
      <Panel title="Recent Incidents" headerRight={
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
          Last {Math.min((incidents as any[]).length, 8)}
        </span>
      }>
        {incLoading ? (
          <div className="p-5 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} h="h-9" />)}</div>
        ) : (incidents as any[]).length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 size={28} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 8px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No incidents recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['ID', 'Title', 'Root Cause', 'Confidence', 'Severity', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(incidents as any[]).slice(0, 8).map((inc: any) => (
                  <tr key={inc.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{String(inc.incidentId || inc.id).slice(0, 12)}</td>
                    <td className="px-4 py-3 text-sm text-white" style={{ maxWidth: 160 }}><span className="truncate block">{inc.title || '—'}</span></td>
                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{inc.rootCauseCategory || '—'}</td>
                    <td className="px-4 py-3">
                      {inc.aiConfidence != null && (
                        <div className="flex items-center gap-2">
                          <div className="rounded-full overflow-hidden" style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.07)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.round(inc.aiConfidence * 100)}%`, background: '#a78bfa' }} />
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: '#a78bfa' }}>{Math.round(inc.aiConfidence * 100)}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: sev(inc.severity), background: `${sev(inc.severity)}1a` }}>{inc.severity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: sta(inc.status), background: `${sta(inc.status)}1a` }}>{inc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDate(inc.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* AI Predictions + Root Cause — 2 cols on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AI Failure Predictions */}
        <Panel title="AI Failure Predictions">
          {predList.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Brain size={26} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No predictions yet — feed more logs to the AI engine.</p>
            </div>
          ) : predList.slice(0, 5).map((p: any, i: number) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <TrendingUp size={13} style={{ color: '#a78bfa' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{p.atmName || p.atm_id || p.atmId || `ATM-${i + 1}`}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {p.weakestComponent || p.failureCategory || 'Unknown'} · {p.predictedIn || 'within 24h'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>{formatConfidence(p.failureProbability ?? p.probability ?? p.confidence)}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>confidence</p>
              </div>
            </div>
          ))}
        </Panel>

        {/* Root Cause Distribution */}
        <Panel title="Root Cause Distribution">
          {statsList.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle size={26} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 8px' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Stats build from incidents. Ingest logs to populate.</p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {statsList.map((s: any, i: number) => {
                const total = statsList.reduce((acc: number, x: any) => acc + (x.count ?? 0), 0);
                const pct   = total > 0 ? ((s.count ?? 0) / total) * 100 : 0;
                const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#a78bfa', '#60a5fa', '#4ade80', '#fb923c'];
                const color  = COLORS[i % COLORS.length];
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{s.category || s.label || 'Unknown'}</span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: '4px', background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

    </div>
  );
}
