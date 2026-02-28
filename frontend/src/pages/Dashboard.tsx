import React from 'react';
import { AlertTriangle, Activity, ShieldAlert, Brain, Zap, TrendingUp } from 'lucide-react';
import {
  useGetIncidentsQuery,
  useGetAnomalyFlagsQuery,
  useGetSelfHealActionsQuery,
  useGetAIPredictionsQuery,
  useGetRootCauseStatsQuery,
} from '../services/pulseApi';
import { formatDate, formatConfidence } from '../utils';

/* ── helpers ─────────────────────────────────────────────────────────── */
function sev(s: string) {
  return ({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' } as any)[s] ?? '#6b7280';
}
function sta(s: string) {
  return ({
    OPEN: '#60a5fa', RESOLVED: '#4ade80', ACTIVE: '#60a5fa',
    ACKNOWLEDGED: '#a78bfa', FAILED: '#ef4444', SUCCESS: '#4ade80',
    PENDING: '#9ca3af', REVIEWED: '#4ade80', DISMISSED: '#6b7280',
  } as any)[s] ?? '#9ca3af';
}

/* ── sub-components ──────────────────────────────────────────────────── */
function KPICard({
  label, value, Icon, color, sub,
}: { label: string; value: string | number; Icon: any; color: string; sub?: string }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* top shimmer line */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: '1px', background: `linear-gradient(90deg,transparent,${color}50,transparent)` }}
      />
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}16`, border: `1px solid ${color}28` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {sub && (
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs mt-1.5 font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="px-5 py-4 flex items-center"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th
    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
    style={{ color: 'rgba(255,255,255,0.3)' }}
  >
    {children}
  </th>
);

/* ── main page ───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: incidents = [], isLoading: incLoading } = useGetIncidentsQuery();
  const { data: anomalies = [], isLoading: anoLoading } = useGetAnomalyFlagsQuery();
  const { data: actions   = [], isLoading: shLoading  } = useGetSelfHealActionsQuery();
  const { data: preds                                  } = useGetAIPredictionsQuery();
  const { data: rcStats                                } = useGetRootCauseStatsQuery();

  const openInc    = incidents.filter((i: any) => i.status !== 'RESOLVED').length;
  const critical   = incidents.filter((i: any) => i.severity === 'CRITICAL').length;
  const activeAno  = anomalies.filter((a: any) => a.status === 'ACTIVE').length;
  const predList   = preds?.predictions ?? [];
  const statsList  = rcStats?.stats ?? [];

  return (
    <div className="p-8 space-y-6" style={{ color: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Center</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            PULSE real-time monitoring dashboard
          </p>
        </div>
        <div
          className="flex items-center gap-2.5 px-4 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Systems Operational
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Open Incidents"   value={incLoading ? '—' : openInc}   Icon={AlertTriangle} color="#ef4444" sub="active" />
        <KPICard label="Critical Alerts"  value={incLoading ? '—' : critical}  Icon={Activity}      color="#f97316" sub="urgent" />
        <KPICard label="Active Anomalies" value={anoLoading ? '—' : activeAno} Icon={ShieldAlert}   color="#f59e0b" sub="flagged" />
        <KPICard label="AI Predictions"   value={predList.length}              Icon={Brain}         color="#a78bfa" sub="pending" />
      </div>

      {/* Incidents + Self-Heal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Incidents table */}
        <div className="xl:col-span-2">
          <Panel title="Recent Incidents">
            {incLoading ? (
              <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
            ) : incidents.length === 0 ? (
              <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No incidents recorded.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <TH>ID</TH><TH>Title</TH><TH>Severity</TH><TH>Status</TH><TH>Created</TH>
                  </tr>
                </thead>
                <tbody>
                  {(incidents as any[]).slice(0, 7).map((inc: any) => (
                    <tr
                      key={inc.id}
                      className="transition-colors cursor-default"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    >
                      <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {String(inc.incidentId || inc.id).slice(0, 10)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-white max-w-[180px] truncate">
                        {inc.title || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ color: sev(inc.severity), background: `${sev(inc.severity)}1a` }}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ color: sta(inc.status), background: `${sta(inc.status)}1a` }}
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {formatDate(inc.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* Self-Heal feed */}
        <Panel title="Self-Heal Actions">
          {shLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
          ) : actions.length === 0 ? (
            <div className="p-8 text-center">
              <Zap size={24} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 8px' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No actions yet.</p>
            </div>
          ) : (
            <div>
              {(actions as any[]).slice(0, 7).map((a: any) => (
                <div
                  key={a.id}
                  className="px-5 py-3.5 flex items-start gap-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${sta(a.status)}1a`, border: `1px solid ${sta(a.status)}35` }}
                  >
                    <Zap size={11} style={{ color: sta(a.status) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {a.action_type || a.actionType || 'Action'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {a.triggered_by || a.triggeredBy || 'System'} · {formatDate(a.created_at || a.createdAt)}
                    </p>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                    style={{ color: sta(a.status), background: `${sta(a.status)}1a` }}
                  >
                    {a.status || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* AI Predictions + Root Cause */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* AI Predictions */}
        <Panel title="AI Failure Predictions">
          {predList.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Brain size={28} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No predictions yet. Feed more logs to the AI engine.
              </p>
            </div>
          ) : (
            <div>
              {predList.slice(0, 5).map((p: any, i: number) => (
                <div
                  key={i}
                  className="px-5 py-4 flex items-center gap-4"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)' }}
                  >
                    <TrendingUp size={14} style={{ color: '#a78bfa' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">
                      {p.atm_id || p.atmId || `ATM-${i + 1}`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {p.failure_type || p.failureType || 'Unknown'} · {p.predicted_time || p.predictedTime || 'Soon'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold" style={{ color: '#a78bfa' }}>
                      {formatConfidence(p.probability ?? p.confidence)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>confidence</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Root Cause Distribution */}
        <Panel title="Root Cause Distribution">
          {statsList.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No data yet. Stats build from resolved incidents.
              </p>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              {statsList.map((s: any, i: number) => {
                const total = statsList.reduce((acc: number, x: any) => acc + (x.count ?? 0), 0);
                const pct = total > 0 ? ((s.count ?? 0) / total) * 100 : 0;
                const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#a78bfa', '#60a5fa', '#4ade80', '#fb923c'];
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        {s.category || s.label || 'Unknown'}
                      </span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {s.count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: '4px', background: 'rgba(255,255,255,0.07)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}70, ${color})`,
                          transition: 'width 0.6s ease',
                        }}
                      />
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
