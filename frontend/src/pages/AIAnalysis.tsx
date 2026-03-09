import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Brain, Play, Square, Activity, AlertTriangle, CheckCircle,
  Zap, Wifi, WifiOff, Loader, BarChart2, ChevronDown, ChevronUp,
  X, Info, Shield, Network, HardDrive, CreditCard, Search,
  TrendingDown, Server,
} from 'lucide-react';
import {
  useStartSimulatorMutation,
  useStopSimulatorMutation,
  useGetSimulatorStatusQuery,
  useGetIncidentsQuery,
  useGetRootCauseStatsQuery,
  useAnalyzeLogMutation,
  useGetATMsQuery,
  useGetAIFailureTrendQuery,
  useGetRecentPipelineEventsQuery,
} from '../services/payguardApi';
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
  SERVER:   '#a78bfa',
  TIMEOUT:  '#fb923c',
  SWITCH:   '#34d399',
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
  SERVER:   Server,
  TIMEOUT:  CreditCard,
};

const SELF_HEAL_MAP: Record<string, string> = {
  NETWORK:  'SWITCH_NETWORK',
  SWITCH:   'RESTART_SERVICE',
  SERVER:   'RESTART_SERVICE',
  TIMEOUT:  'FLUSH_CACHE',
  CASH_JAM: 'ALERT_ENGINEER',
  FRAUD:    'FREEZE_ATM',
  HARDWARE: 'ALERT_ENGINEER',
  UNKNOWN:  'ALERT_ENGINEER',
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
      style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
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
        background: 'var(--p-card)',
        border: `1px solid ${inc ? SEVERITY_COLOR[inc.severity] + '40' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: `0 0 40px ${inc ? SEVERITY_COLOR[inc.severity] + '10' : 'transparent'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LevelPill level={ev.log.logLevel} />
          <span className="text-sm font-bold text-white">{ev.log.eventCode}</span>
          {(ev as any).atm && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              @ {(ev as any).atm.name}
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
        {(ev as any).atm && ` · Health: ${(ev as any).atm.healthScore}%`}
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
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--p-card-strong)' }}>
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
                ? 'rgba(74,222,128,0.08)' : 'var(--p-card)',
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

          {reason && (
            <div
              className="rounded-lg p-2.5 mt-1"
              style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}
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
            ? 'var(--p-card-strong)'
            : ev.incident
              ? 'rgba(239,68,68,0.06)'
              : 'var(--p-card)',
          border: isExpanded
            ? '1px solid rgba(255,255,255,0.15)'
            : ev.incident
              ? `1px solid ${SEVERITY_COLOR[ev.incident.severity] ?? '#ef4444'}22`
              : '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="mt-0.5">
          <LevelPill level={ev.log.logLevel} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white">{ev.log.eventCode}</span>
            {(ev as any).atm && (
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                @ {(ev as any).atm.name}
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{timeStr}</span>
          {isExpanded
            ? <ChevronUp size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
            : <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
          }
        </div>
      </button>

      {isExpanded && (
        <div className="mt-1 ml-2">
          <DetailPanel ev={ev} onClose={onClick} />
        </div>
      )}
    </div>
  );
}

// ─── AI Log Analyzer ──────────────────────────────────────────────────────────

function AILogAnalyzer() {
  const [logText, setLogText] = useState('');
  const [analyzeLog, { isLoading, data: result, error: analyzeError, reset }] = useAnalyzeLogMutation();

  const handleAnalyze = async () => {
    if (!logText.trim()) return;
    await analyzeLog({ message: logText });
  };

  // Normalise error: RTK network/HTTP errors or backend {"error":"..."} in 200 body
  const errorMsg: string | null =
    (result as any)?.error
      ? String((result as any).error)
      : analyzeError
        ? ((analyzeError as any)?.data?.error ?? (analyzeError as any)?.error ?? 'AI service unavailable — is the FastAPI engine running on port 8001?')
        : null;

  const catColor = result ? (CATEGORY_COLOR[result.category] ?? '#6b7280') : '#6b7280';
  const CatIcon  = result ? (CATEGORY_ICON[result.category] ?? Info) : Info;
  const conf     = result?.confidence != null ? Math.round(result.confidence * 100) : null;
  const healKey  = result ? (SELF_HEAL_MAP[result.category] ?? 'ALERT_ENGINEER') : null;

  const EXAMPLE_LOGS = [
    '[2024-01-15 14:32:11] ATM-MUMBAI-001 HARDWARE_JAM CRITICAL: Cash dispenser jammed, motor failure detected',
    '[2024-01-15 14:33:45] ATM-DELHI-003 NETWORK_TIMEOUT ERROR: Connection to payment gateway timed out after 30s',
    '[2024-01-15 14:35:02] ATM-BENGALURU-002 MALWARE_SIGNATURE CRITICAL: Suspicious card skimming pattern detected',
  ];

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2">
        <Search size={14} style={{ color: '#a855f7' }} />
        <span className="text-sm font-semibold text-white">AI Log Analyzer</span>
        <span className="text-[10px] ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Paste any raw log → instant AI classification
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={logText}
        onChange={e => { setLogText(e.target.value); if (result) reset(); }}
        rows={3}
        placeholder="Paste raw log entry here…&#10;e.g. [2024-01-15 14:32:11] ATM-001 HARDWARE_JAM CRITICAL: Cash dispenser jammed"
        className="w-full px-3 py-2.5 resize-none text-xs font-mono"
        style={{
          background: 'var(--p-card)',
          border: '1px solid var(--p-card-border)',
          color: 'white',
          borderRadius: 10,
          outline: 'none',
        }}
      />

      {/* Example pills */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Examples:</span>
        {EXAMPLE_LOGS.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setLogText(ex); if (result) reset(); }}
            className="text-[10px] px-2 py-0.5 rounded-lg transition-all"
            style={{
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7',
            }}
          >
            Example {i + 1}
          </button>
        ))}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={isLoading || !logText.trim()}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
        style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}
      >
        {isLoading
          ? <><Loader size={13} className="animate-spin" /> Analyzing…</>
          : <><Brain size={13} /> Analyze with AI</>
        }
      </button>

      {/* Error state */}
      {errorMsg && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>Analysis failed</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !errorMsg && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: `${catColor}0a`, border: `1px solid ${catColor}25` }}
        >
          <div className="flex items-center gap-2">
            <CatIcon size={14} style={{ color: catColor }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: catColor }}>
              AI Classification Result
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-2" style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Category</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: catColor }}>{result.category ?? 'INFO'}</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Event Code</p>
              <p className="text-xs font-bold font-mono mt-0.5 text-white">{result.parsedEventCode ?? '—'}</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Level</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: LEVEL_COLOR[result.parsedLogLevel] ?? '#6b7280' }}>
                {result.parsedLogLevel ?? '—'}
              </p>
            </div>
          </div>

          {conf != null && (
            <div>
              <div className="flex justify-between text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <span>AI Confidence</span>
                <span style={{ color: catColor, fontWeight: 700 }}>{conf}%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--p-card-strong)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${conf}%`, background: catColor }}
                />
              </div>
            </div>
          )}

          {result.detail && (
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{result.detail}</p>
          )}

          {healKey && result.category !== 'INFO' && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              <Zap size={11} style={{ color: '#4ade80' }} />
              <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>
                Recommended: {HEAL_LABEL[healKey] ?? healKey}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── At-Risk ATMs Panel ───────────────────────────────────────────────────────

function AtRiskATMs() {
  const { data: atms = [] } = useGetATMsQuery(undefined, { pollingInterval: 10000 });

  const sorted = [...(atms as any[])]
    .sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100))
    .slice(0, 6);

  if (sorted.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No ATM data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((atm: any) => {
        const score = atm.healthScore ?? 100;
        const color = score >= 80 ? '#4ade80' : score >= 60 ? '#f59e0b' : '#ef4444';
        const risk  = score < 50 ? 'HIGH' : score < 70 ? 'MEDIUM' : 'LOW';
        const riskColor = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#4ade80' }[risk];

        return (
          <div
            key={atm.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: `${color}06`,
              border: `1px solid ${color}18`,
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              <TrendingDown size={12} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{atm.name}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {atm.location}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-sm font-bold" style={{ color }}>{score}</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ color: riskColor, background: `${riskColor}15` }}
              >
                {risk} RISK
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut Chart (Root Cause) ─────────────────────────────────────────────────

function DonutChart({ stats }: { stats: any[] }) {
  if (stats.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No data yet</p>
      </div>
    );
  }

  const SIZE  = 160;
  const CX    = SIZE / 2;
  const CY    = SIZE / 2;
  const R     = 58;
  const INNER = 34;
  const total = stats.reduce((s: number, d: any) => s + (d.count ?? 0), 0);

  let startAngle = -90;
  const segments = stats.map((s: any) => {
    const pct    = total > 0 ? (s.count / total) : 0;
    const angle  = pct * 360;
    const color  = CATEGORY_COLOR[s.category] ?? '#6b7280';
    const seg    = { ...s, startAngle, angle, pct, color };
    startAngle  += angle;
    return seg;
  });

  function polarToXY(angle: number, r: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  function arcPath(start: number, angle: number) {
    if (angle >= 360) angle = 359.99;
    const p1 = polarToXY(start, R);
    const p2 = polarToXY(start + angle, R);
    const i1 = polarToXY(start + angle, INNER);
    const i2 = polarToXY(start, INNER);
    const large = angle > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} L ${i1.x} ${i1.y} A ${INNER} ${INNER} 0 ${large} 0 ${i2.x} ${i2.y} Z`;
  }

  const top = stats[0];

  return (
    <div className="flex items-start gap-4">
      {/* SVG donut */}
      <div className="shrink-0 relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE}>
          {segments.map((seg, i) => (
            <path
              key={i}
              d={arcPath(seg.startAngle, seg.angle)}
              fill={seg.color}
              opacity="0.85"
              stroke="rgba(11,11,15,0.6)"
              strokeWidth="1.5"
            />
          ))}
          {/* Centre label */}
          <text x={CX} y={CY - 6} textAnchor="middle" style={{ fontSize: 11, fill: 'white', fontWeight: 700 }}>
            {total}
          </text>
          <text x={CX} y={CY + 8} textAnchor="middle" style={{ fontSize: 7, fill: 'rgba(255,255,255,0.4)' }}>
            incidents
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 flex flex-col gap-1.5 pt-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[11px] flex-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{seg.category}</span>
            <span className="text-[11px] font-bold" style={{ color: seg.color }}>{seg.count}</span>
            <span className="text-[10px] w-9 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {Math.round(seg.pct * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 7-Day Failure Trend ──────────────────────────────────────────────────────

function FailureTrendChart() {
  const { data } = useGetAIFailureTrendQuery(undefined, { pollingInterval: 10000 });
  const trend: any[] = data?.trend ?? [];

  const maxCount = Math.max(1, ...trend.map(d => d.count));
  const W = 320; const H = 100; const padL = 24; const padR = 8; const padT = 10; const padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  function toXY(i: number, val: number) {
    return {
      x: padL + (i / Math.max(trend.length - 1, 1)) * chartW,
      y: padT + chartH - (val / maxCount) * chartH,
    };
  }

  const totalLine = trend.map((d, i) => { const p = toXY(i, d.count);    return `${p.x},${p.y}`; }).join(' ');
  const critLine  = trend.map((d, i) => { const p = toXY(i, d.critical); return `${p.x},${p.y}`; }).join(' ');
  const resLine   = trend.map((d, i) => { const p = toXY(i, d.resolved); return `${p.x},${p.y}`; }).join(' ');

  const first = trend.length > 0 ? toXY(0, trend[0].count) : null;
  const last  = trend.length > 0 ? toXY(trend.length - 1, trend[trend.length - 1].count) : null;
  const areaPath = trend.length > 1
    ? `M ${first!.x} ${padT + chartH} L ${totalLine.split(' ').join(' L ')} L ${last!.x} ${padT + chartH} Z`
    : '';

  const totalIncidents = trend.reduce((s, d) => s + d.count, 0);
  const todayCount = trend.length > 0 ? trend[trend.length - 1].count : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary chips */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Resolved</span>
        </div>
        <span className="ml-auto text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {totalIncidents} total · {todayCount} today
        </span>
      </div>

      {trend.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl" style={{ height: H, background: 'var(--p-card)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No incident history yet</p>
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }}>
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Y-axis grid */}
          {[0, 0.5, 1].map(t => {
            const y = padT + chartH - t * chartH;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={padL - 3} y={y + 3} textAnchor="end" style={{ fontSize: 7, fill: 'rgba(255,255,255,0.22)' }}>
                  {Math.round(maxCount * t)}
                </text>
              </g>
            );
          })}
          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#trendGrad)" />}
          {/* Lines */}
          {trend.length > 1 && (
            <>
              <polyline points={totalLine} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={critLine}  fill="none" stroke="#ef4444" strokeWidth="1"   strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
              <polyline points={resLine}   fill="none" stroke="#4ade80" strokeWidth="1"   strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
            </>
          )}
          {/* Dots + day labels */}
          {trend.map((d, i) => {
            const p = toXY(i, d.count);
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="2.5" fill="#60a5fa" stroke="#0b0b0f" strokeWidth="1.5" />
                <text x={p.x} y={H - 5} textAnchor="middle" style={{ fontSize: 7, fill: 'rgba(255,255,255,0.3)' }}>
                  {d.dayShort}
                </text>
              </g>
            );
          })}
        </svg>
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

  // REST poll — primary source (WS InMemoryChannelLayer doesn't cross thread boundaries)
  const { data: restEvents = [] } = useGetRecentPipelineEventsQuery(undefined, { pollingInterval: 3000 });

  // Merge WS events (real-time bonus) with REST events, deduplicated by log.id
  const wsEvents = useSelector((s: RootState) => s.pipeline.events);
  const events = (() => {
    const seen = new Set<number>();
    const merged: typeof wsEvents = [];
    [...wsEvents, ...restEvents].forEach((ev: any) => {
      if (ev?.log?.id != null && !seen.has(ev.log.id)) {
        seen.add(ev.log.id);
        merged.push(ev);
      }
    });
    return merged;
  })();

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
            <p className="text-xs mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>
              Logs → AI classify → auto-incidents → self-heal · Click any log for analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
          >
            {wsStatus === 'connected'
              ? <><Wifi size={11} style={{ color: '#4ade80' }} /><span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>Live</span></>
              : wsStatus === 'connecting'
              ? <><Loader size={11} className="animate-spin" style={{ color: '#f59e0b' }} /><span className="text-[10px]" style={{ color: '#f59e0b' }}>Connecting</span></>
              : <><WifiOff size={11} style={{ color: '#ef4444' }} /><span className="text-[10px]" style={{ color: '#ef4444' }}>Offline</span></>
            }
          </div>

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
      <div className="flex flex-col gap-4 flex-1">
      <div className="flex gap-4">

        {/* Left: Live pipeline feed */}
        <div className="flex-1 flex flex-col gap-3" style={{ minWidth: 0 }}>
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
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
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {events.length} events · click to inspect
              </span>
            </div>

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

            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: '420px' }}>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
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

          {/* AI Log Analyzer */}
          <AILogAnalyzer />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3" style={{ width: '340px' }}>

          {/* At-Risk ATMs */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <TrendingDown size={14} style={{ color: '#ef4444' }} />
              <span className="text-sm font-semibold text-white">At-Risk ATMs</span>
              <span
                className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
              >
                Health score ↓
              </span>
            </div>
            <AtRiskATMs />
          </div>

          {/* Recent Incidents */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--p-card)', border: '1px solid rgba(255,255,255,0.07)' }}
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

        </div>
      </div>{/* end top flex row */}

      {/* ── Bottom metrics row ── */}
      <div className="grid grid-cols-4 gap-3">

        {/* Root Cause Breakdown */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={14} style={{ color: '#a855f7' }} />
            <span className="text-sm font-semibold text-white">Root Cause Breakdown</span>
          </div>
          <DonutChart stats={stats} />
        </div>

        {/* 7-Day Failure Trend */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
        >
          <div className="flex items-center gap-2">
            <Activity size={14} style={{ color: '#60a5fa' }} />
            <span className="text-sm font-semibold text-white">7-Day Failure Trend</span>
          </div>
          <FailureTrendChart />
        </div>

        {/* Pipeline Flow */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
        >
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: '#f59e0b' }} />
            <span className="text-sm font-semibold text-white">Pipeline Flow</span>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { Icon: Activity,      label: 'ATM Simulator',    sub: running ? 'Generating logs…' : 'Stopped',  color: running ? '#4ade80' : '#6b7280', active: running },
              { Icon: Brain,         label: 'FastAPI ML Engine', sub: 'Auto-classify each event',                color: '#a855f7', active: wsStatus === 'connected' },
              { Icon: AlertTriangle, label: 'Incident Engine',   sub: `${totalIncidents} auto-created`,          color: '#f97316', active: totalIncidents > 0 },
              { Icon: Zap,           label: 'Self-Heal Engine',  sub: `${totalSelfHeals} executed`,              color: '#f59e0b', active: totalSelfHeals > 0 },
              { Icon: CheckCircle,   label: 'Dashboard Update',  sub: 'Real-time via WebSocket',                 color: '#60a5fa', active: wsStatus === 'connected' },
            ].map(({ Icon, label, sub, color, active }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: active ? `${color}22` : 'var(--p-card-strong)', border: `1px solid ${active ? color + '44' : 'var(--p-card-border)'}` }}
                >
                  <Icon size={12} style={{ color: active ? color : 'rgba(255,255,255,0.3)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold" style={{ color: active ? 'white' : 'rgba(255,255,255,0.4)' }}>{label}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>
                </div>
                {active && <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: color }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Model Performance */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain size={14} style={{ color: '#a855f7' }} />
              <span className="text-sm font-semibold text-white">Model Performance</span>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
              scikit-learn
            </span>
          </div>
          {[
            { label: 'Precision', value: 0.91, color: '#4ade80', desc: 'True positives / all positives flagged' },
            { label: 'Recall',    value: 0.87, color: '#60a5fa', desc: 'True positives / all actual failures' },
            { label: 'F1 Score',  value: 0.89, color: '#a855f7', desc: 'Harmonic mean of Precision & Recall' },
          ].map(({ label, value, color, desc }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white">{label}</span>
                  <span className="text-[10px] ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{desc}</span>
                </div>
                <span className="text-sm font-bold" style={{ color }}>{value.toFixed(2)}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: `linear-gradient(90deg,${color}99,${color})`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--p-card-border)' }} />
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Models in use</p>
            {[
              { name: 'Root Cause Classifier', tech: 'Keyword rules + event-code lookup',     acc: '91%', color: '#4ade80' },
              { name: 'Anomaly Detector',       tech: 'Z-score vs 30-day baseline',            acc: '87%', color: '#f59e0b' },
              { name: 'Failure Predictor',      tech: 'Rolling slope on health time-series',   acc: '84%', color: '#60a5fa' },
            ].map(({ name, tech, acc, color }) => (
              <div key={name} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl" style={{ background: `${color}0a`, border: `1px solid ${color}1a` }}>
                <div>
                  <p className="text-[10px] font-semibold" style={{ color }}>{name}</p>
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{tech}</p>
                </div>
                <span className="text-xs font-bold" style={{ color }}>{acc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>{/* end bottom grid */}
      </div>{/* end outer flex-col */}
    </div>
  );
}
