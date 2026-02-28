import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Brain, Play, Square, Activity, AlertTriangle, CheckCircle,
  Zap, Wifi, WifiOff, Loader, BarChart2, ChevronDown, ChevronUp,
  X, Info, Shield, Network, HardDrive, CreditCard,
} from 'lucide-react';
import {
  useStartSimulatorMutation,
  useStopSimulatorMutation,
  useGetSimulatorStatusQuery,
  useGetIncidentsQuery,
  useGetRootCauseStatsQuery,
} from '../services/pulseApi';
import { usePipelineSocket, PipelineEvent } from '../hooks/usePipelineSocket';
import { RootState } from '../store';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#f59e0b',
  LOW:      '#4ade80',
};

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  ERROR:    '#f97316',
  WARN:     '#f59e0b',
  INFO:     '#4ade80',
};

const CATEGORY_COLOR: Record<string, string> = {
  NETWORK:  '#60a5fa',
  HARDWARE: '#f97316',
  CASH_JAM: '#f59e0b',
  FRAUD:    '#ef4444',
  UNKNOWN:  '#6b7280',
};

const HEAL_LABEL: Record<string, string> = {
  RESTART_SERVICE: '↺ Restart Service',
  SWITCH_NETWORK:  '⇄ Switch Network',
  FLUSH_CACHE:     '∅ Flush Cache',
  REROUTE_TRAFFIC: '⇀ Reroute Traffic',
  ALERT_ENGINEER:  '🔔 Alert Engineer',
  FREEZE_ATM:      '🔒 Freeze ATM',
  NONE:            '— No action',
};

const CATEGORY_ICON: Record<string, typeof Network> = {
  NETWORK:  Network,
  HARDWARE: HardDrive,
  CASH_JAM: HardDrive,
  FRAUD:    Shield,
  UNKNOWN:  Info,
};

function severityReason(ev: PipelineEvent): string {
  const cl = ev.classification;
  if (!cl || !ev.incident) return '';
  const conf = Math.round(cl.confidence * 100);
  const lvl  = ev.log.logLevel;

  const levelDesc: Record<string, string> = {
    CRITICAL: 'a CRITICAL-level log entry',
    ERROR:    'an ERROR-level log entry',
    WARN:     'a WARN-level log entry',
  };
  const sevDesc: Record<string, string> = {
    CRITICAL: 'CRITICAL — immediate action required',
    HIGH:     'HIGH — serious failure detected',
    MEDIUM:   'MEDIUM — degraded performance',
    LOW:      'LOW — minor issue',
  };

  const sev = ev.incident.severity;
  const cat = cl.category;

  let reason = `The AI engine received ${levelDesc[lvl] ?? 'a log entry'} with event code `
    + `<strong>${ev.log.eventCode}</strong> and classified it as a `
    + `<strong>${cat}</strong> failure with <strong>${conf}% confidence</strong>. `;

  if (cat === 'FRAUD') {
    reason += 'Fraud-related events are always escalated to CRITICAL severity regardless of log level, '
      + 'as they pose an immediate security and financial risk.';
  } else if (lvl === 'CRITICAL') {
    reason += `The log level was already CRITICAL, which maps directly to <strong>${sevDesc[sev]}</strong>.`;
  } else if (lvl === 'ERROR') {
    reason += `ERROR-level events with ≥65% confidence are escalated to <strong>${sevDesc[sev]}</strong>.`;
  } else {
    reason += `WARN-level events with high confidence are classified as <strong>${sevDesc[sev]}</strong>.`;
  }

  return reason;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</span>}
    </div>
  );
}

function LevelPill({ level }: { level: string }) {
  const color = LEVEL_COLOR[level] ?? '#6b7280';
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide shrink-0"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {level}
    </span>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? '#6b7280';
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide shrink-0"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {severity}
    </span>
  );
}

// ─── Detail Panel (expanded single event) ────────────────────────────────────

function DetailPanel({ ev, onClose }: { ev: PipelineEvent; onClose: () => void }) {
  const cl  = ev.classification;
  const inc = ev.incident;
  const catColor = cl ? (CATEGORY_COLOR[cl.category] ?? '#6b7280') : '#6b7280';
  const CatIcon  = cl ? (CATEGORY_ICON[cl.category] ?? Info) : Info;
  const t = new Date(ev.log.timestamp);
  const reason = severityReason(ev);

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{
        background: 'rgba(14,14,20,0.98)',
        border: `1px solid ${inc ? SEVERITY_COLOR[inc.severity] + '40' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: `0 0 40px ${inc ? SEVERITY_COLOR[inc.severity] + '10' : 'transparent'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LevelPill level={ev.log.logLevel} />
          <span className="text-sm font-bold text-white">{ev.log.eventCode}</span>
          {ev.atm && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              @ {ev.atm.name}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-all shrink-0"
        >
          <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </button>
      </div>

      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {t.toLocaleDateString('en-IN')} · {t.toLocaleTimeString('en-IN')}
        {ev.atm && ` · Health: ${ev.atm.healthScore}%`}
      </div>

      {/* AI Classification */}
      {cl ? (
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: `${catColor}0d`, border: `1px solid ${catColor}22` }}
        >
          <div className="flex items-center gap-2">
            <CatIcon size={13} style={{ color: catColor }} />
            <span className="text-xs font-bold" style={{ color: catColor }}>AI Classification</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Category</p>
              <p className="text-sm font-bold" style={{ color: catColor }}>{cl.category}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Confidence</p>
              <p className="text-sm font-bold text-white">{Math.round(cl.confidence * 100)}%</p>
            </div>
          </div>
          {/* Confidence bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${cl.confidence * 100}%`, background: catColor }}
            />
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{cl.detail}</p>
        </div>
      ) : (
        <div
          className="rounded-xl p-3 text-xs"
          style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ade80' }}
        >
          ✓ Informational log — no failure detected, no incident created
        </div>
      )}

      {/* Self-Heal */}
      {cl && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Self-Heal Action
          </p>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: ev.selfHealAction && ev.selfHealAction !== 'NONE'
                ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
              border: ev.selfHealAction && ev.selfHealAction !== 'NONE'
                ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <span
              className="text-xs font-semibold"
              style={{ color: ev.selfHealAction && ev.selfHealAction !== 'NONE' ? '#4ade80' : 'rgba(255,255,255,0.3)' }}
            >
              {HEAL_LABEL[ev.selfHealAction ?? 'NONE'] ?? ev.selfHealAction}
            </span>
            {ev.selfHealAction && ev.selfHealAction !== 'NONE' && (
              <span
                className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}
              >
                EXECUTED
              </span>
            )}
          </div>
          {cl.recommendedAction && (
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{cl.recommendedAction}</p>
          )}
        </div>
      )}

      {/* Auto-created Incident */}
      {inc && (
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{
            background: `${SEVERITY_COLOR[inc.severity] ?? '#f97316'}0d`,
            border: `1px solid ${SEVERITY_COLOR[inc.severity] ?? '#f97316'}30`,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} style={{ color: SEVERITY_COLOR[inc.severity] }} />
            <span className="text-xs font-bold" style={{ color: SEVERITY_COLOR[inc.severity] }}>
              Auto-Created Incident
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-white">{inc.incidentId}</span>
            <SeverityPill severity={inc.severity} />
          </div>
          <p className="text-xs text-white font-medium">{inc.title}</p>

          {/* Why critical */}
          {reason && (
            <div
              className="rounded-lg p-2.5 mt-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Why this severity?
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                dangerouslySetInnerHTML={{ __html: reason }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({
  ev, isExpanded, onClick,
}: {
  ev: PipelineEvent;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const cl = ev.classification;
  const catColor = cl ? (CATEGORY_COLOR[cl.category] ?? '#6b7280') : '#6b7280';
  const t = new Date(ev.log.timestamp);
  const timeStr = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col">
      <button
        onClick={onClick}
        className="flex items-start gap-3 py-2.5 px-3 rounded-xl transition-all text-left w-full"
        style={{
          background: isExpanded
            ? 'rgba(255,255,255,0.06)'
            : ev.incident
              ? 'rgba(239,68,68,0.06)'
              : 'rgba(255,255,255,0.02)',
          border: isExpanded
            ? '1px solid rgba(255,255,255,0.15)'
            : ev.incident
              ? `1px solid ${SEVERITY_COLOR[ev.incident.severity] ?? '#ef4444'}22`
              : '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Level */}
        <div className="mt-0.5">
          <LevelPill level={ev.log.logLevel} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white">{ev.log.eventCode}</span>
            {ev.atm && (
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                @ {ev.atm.name}
              </span>
            )}
            {cl && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${catColor}22`, color: catColor }}
              >
                {cl.category} · {Math.round(cl.confidence * 100)}%
              </span>
            )}
          </div>
          {ev.incident && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <AlertTriangle size={9} style={{ color: SEVERITY_COLOR[ev.incident.severity] }} />
              <span className="text-[10px] font-mono" style={{ color: SEVERITY_COLOR[ev.incident.severity] }}>
                {ev.incident.incidentId}
              </span>
              <SeverityPill severity={ev.incident.severity} />
              {ev.selfHealAction && ev.selfHealAction !== 'NONE' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{
                  background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                  border: '1px solid rgba(74,222,128,0.2)',
                }}>
                  ⚡ {ev.selfHealAction}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{timeStr}</span>
          {isExpanded
            ? <ChevronUp size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
            : <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-1 ml-2">
          <DetailPanel ev={ev} onClose={onClick} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIAnalysisPage() {
  const [startSim] = useStartSimulatorMutation();
  const [stopSim]  = useStopSimulatorMutation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: simStatus } = useGetSimulatorStatusQuery(undefined, { pollingInterval: 2000 });
  const { data: incidents = [] } = useGetIncidentsQuery(undefined, { pollingInterval: 5000 });
  const { data: rootStats }      = useGetRootCauseStatsQuery(undefined, { pollingInterval: 10000 });

  const { status: wsStatus } = usePipelineSocket();

  // Read persisted events from Redux (survive navigation)
  const events = useSelector((s: RootState) => s.pipeline.events);

  const running = simStatus?.running ?? false;

  const totalProcessed = simStatus?.logsProcessed ?? 0;
  const totalIncidents = simStatus?.incidentsCreated ?? 0;
  const totalSelfHeals = simStatus?.selfHealsTriggered ?? 0;

  const classifiedEvents = events.filter(e => e.classification);
  const avgConfidence = classifiedEvents.length > 0
    ? Math.round(classifiedEvents.reduce((s, e) => s + (e.classification?.confidence ?? 0), 0) / classifiedEvents.length * 100)
    : 0;

  const recentIncidents = [...incidents]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const stats = rootStats?.stats ?? [];

  const handleRowClick = (id: number) =>
    setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="p-6 flex flex-col gap-5" style={{ minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            <Brain size={16} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Automation Pipeline</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              FinEdge · Logs → AI classify → auto-incidents → self-heal · Click any log for analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* WS status */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {wsStatus === 'connected'
              ? <><Wifi size={11} style={{ color: '#4ade80' }} /><span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>Live</span></>
              : wsStatus === 'connecting'
              ? <><Loader size={11} className="animate-spin" style={{ color: '#f59e0b' }} /><span className="text-[10px]" style={{ color: '#f59e0b' }}>Connecting</span></>
              : <><WifiOff size={11} style={{ color: '#ef4444' }} /><span className="text-[10px]" style={{ color: '#ef4444' }}>Offline</span></>
            }
          </div>

          {/* Start / Stop */}
          <button
            onClick={() => running ? stopSim() : startSim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: running ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
              border: running ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(74,222,128,0.3)',
              color: running ? '#ef4444' : '#4ade80',
            }}
          >
            {running
              ? <><Square size={13} fill="currentColor" /> Stop Simulator</>
              : <><Play size={13} fill="currentColor" /> Start Simulator</>
            }
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Logs Processed" value={totalProcessed.toLocaleString()}
          sub={running ? 'Simulator active' : 'Simulator stopped'} color="#60a5fa" />
        <StatCard label="Incidents Created" value={totalIncidents} sub="Auto by AI" color="#f97316" />
        <StatCard label="Self-Heals Triggered" value={totalSelfHeals} sub="AUTO pipeline" color="#4ade80" />
        <StatCard
          label="Avg AI Confidence"
          value={classifiedEvents.length > 0 ? `${avgConfidence}%` : '—'}
          sub={`${classifiedEvents.length} classified`}
          color="#a855f7"
        />
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-4 flex-1">

        {/* Left: Live pipeline feed */}
        <div className="flex-1 flex flex-col gap-3" style={{ minWidth: 0 }}>
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Feed header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} style={{ color: '#60a5fa' }} />
                <span className="text-sm font-semibold text-white">Live Pipeline Feed</span>
                {running && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
                    <span className="text-[10px]" style={{ color: '#4ade80' }}>Processing</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {events.length} events · click to inspect
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4">
              {[
                { label: 'Critical', color: '#ef4444' },
                { label: 'Error',    color: '#f97316' },
                { label: 'Warning',  color: '#f59e0b' },
                { label: 'Info',     color: '#4ade80' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded" style={{ background: `${color}33`, border: `1px solid ${color}55` }} />
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                </div>
              ))}
              <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>
                ↑ newest · scroll for history
              </span>
            </div>

            {/* Feed list */}
            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: '520px' }}>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  {running ? (
                    <>
                      <Loader size={24} className="animate-spin" style={{ color: 'rgba(255,255,255,0.2)' }} />
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Waiting for first log…</p>
                    </>
                  ) : (
                    <>
                      <Brain size={28} style={{ color: 'rgba(255,255,255,0.1)' }} />
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Press <strong className="text-white">Start Simulator</strong> to begin
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        ATM logs → AI classify → auto incidents → self-heal
                      </p>
                    </>
                  )}
                </div>
              ) : (
                events.map((ev, i) => (
                  <EventRow
                    key={`${ev.log.id}-${i}`}
                    ev={ev}
                    isExpanded={expandedId === ev.log.id}
                    onClick={() => handleRowClick(ev.log.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3" style={{ width: '340px' }}>

          {/* Recent Incidents */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: '#f97316' }} />
              <span className="text-sm font-semibold text-white">Recent Incidents</span>
              <span
                className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}
              >
                {incidents.length} total
              </span>
            </div>

            <div className="flex flex-col gap-2" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {recentIncidents.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  No incidents yet
                </p>
              ) : recentIncidents.map((inc: any) => {
                const color = SEVERITY_COLOR[inc.severity] ?? '#6b7280';
                const catColor = CATEGORY_COLOR[inc.rootCauseCategory] ?? '#6b7280';
                return (
                  <div
                    key={inc.id}
                    className="rounded-xl p-3 flex flex-col gap-1.5"
                    style={{ background: `${color}0d`, border: `1px solid ${color}22` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{inc.incidentId}</span>
                      <SeverityPill severity={inc.severity} />
                      <span className="ml-auto text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {new Date(inc.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-white truncate">{inc.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${catColor}22`, color: catColor }}>
                        {inc.rootCauseCategory}
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {Math.round((inc.aiConfidence ?? 0) * 100)}% conf
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Root Cause Breakdown */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <BarChart2 size={14} style={{ color: '#a855f7' }} />
              <span className="text-sm font-semibold text-white">Root Cause Breakdown</span>
            </div>
            {stats.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>No data yet</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {stats.map((s: any) => {
                  const color = CATEGORY_COLOR[s.category] ?? '#6b7280';
                  return (
                    <div key={s.category} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color }}>{s.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.percentage}%</span>
                          <span className="text-[10px] font-bold text-white">{s.count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${s.percentage}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pipeline Flow */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: '#f59e0b' }} />
              <span className="text-sm font-semibold text-white">Pipeline Flow</span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { Icon: Activity,      label: 'ATM Simulator',     sub: running ? 'Generating logs…' : 'Stopped', color: running ? '#4ade80' : '#6b7280', active: running },
                { Icon: Brain,         label: 'FastAPI ML Engine',  sub: 'Auto-classify each event',  color: '#a855f7', active: wsStatus === 'connected' },
                { Icon: AlertTriangle, label: 'Incident Engine',    sub: `${totalIncidents} auto-created`,         color: '#f97316', active: totalIncidents > 0 },
                { Icon: Zap,           label: 'Self-Heal Engine',   sub: `${totalSelfHeals} executed`,             color: '#f59e0b', active: totalSelfHeals > 0 },
                { Icon: CheckCircle,   label: 'Dashboard Update',   sub: 'Real-time via WebSocket',   color: '#60a5fa', active: wsStatus === 'connected' },
              ].map(({ Icon, label, sub, color, active }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? color + '44' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <Icon size={12} style={{ color: active ? color : 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold" style={{ color: active ? 'white' : 'rgba(255,255,255,0.4)' }}>
                      {label}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>
                  </div>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: color }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
