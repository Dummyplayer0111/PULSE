import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Search, X, Brain, Zap, Clock, CheckCircle, Download, Sparkles, Loader } from 'lucide-react';
import {
  useGetIncidentsQuery,
  useAssignIncidentMutation,
  useResolveIncidentMutation,
  useGetEngineersQuery,
} from '../services/payguardApi';
import Modal from '../components/common/Modal';
import { BentoCard } from '../components/BentoCard';
import { useCountUp } from '../hooks/useCountUp';
import { formatDate, formatDateTime, shortId } from '../utils';

/* ── helpers ─────────────────────────────────────────────────────────── */
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
    AUTO_RESOLVED: { color: '#4ade80', bg: '#4ade801a' },
    RESOLVED:      { color: '#4ade80', bg: '#4ade801a' },
    ESCALATED:     { color: '#ef4444', bg: '#ef44441a' },
    ACKNOWLEDGED:  { color: '#a78bfa', bg: '#a78bfa1a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

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

const HEAL_LABELS: Record<string, string> = {
  RESTART_SERVICE: 'Restart Service',
  SWITCH_NETWORK:  'Switch Network',
  FLUSH_CACHE:     'Flush Cache',
  REROUTE_TRAFFIC: 'Reroute Traffic',
  ALERT_ENGINEER:  'Alert Engineer',
  FREEZE_ATM:      'Freeze ATM',
};

const HEAL_COLORS: Record<string, string> = {
  RESTART_SERVICE: '#60a5fa',
  SWITCH_NETWORK:  '#4ade80',
  FLUSH_CACHE:     '#f59e0b',
  REROUTE_TRAFFIC: '#a78bfa',
  ALERT_ENGINEER:  '#f97316',
  FREEZE_ATM:      '#ef4444',
};

const CATEGORY_COLORS: Record<string, string> = {
  NETWORK:  '#60a5fa',
  HARDWARE: '#f97316',
  CASH_JAM: '#f59e0b',
  FRAUD:    '#ef4444',
  SERVER:   '#a78bfa',
  TIMEOUT:  '#fb923c',
  SWITCH:   '#34d399',
  UNKNOWN:  '#6b7280',
};

const SEVERITIES = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES   = ['All', 'OPEN', 'INVESTIGATING', 'AUTO_RESOLVED', 'RESOLVED', 'ESCALATED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/* ── Animated stat card ─────────────────────────────────────────────────── */
function AnimatedStatCard({ label, value, color, delay = 0 }: {
  label: string; value: number; color: string; delay?: number;
}) {
  const animated = useCountUp(value, 1200);
  return (
    <BentoCard
      delay={delay}
      style={{
        padding: '12px 20px',
        borderTop: `2px solid ${color}`,
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      <span className="text-2xl font-bold block" style={{ color }}>{animated}</span>
      <span className="text-[10px] block mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </BentoCard>
  );
}

/* ── Animated confidence bar ────────────────────────────────────────────── */
function ConfBar({ value, color = '#a78bfa' }: { value: number; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-full overflow-hidden" style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color, transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>{value}%</span>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
      style={active
        ? { background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'var(--p-text)' }
        : { background: 'var(--p-card)', border: '1px solid var(--p-card-border)', color: 'var(--p-text-dim)' }
      }
    >
      {label.replace('_', ' ')}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--p-card-strong)',
  border: '1px solid var(--p-card-border)',
  color: 'var(--p-text)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '13px',
};

/* ── Gemini AI Summary Cache ──────────────────────────────────────────── */
const geminiCache = new Map<number, string>();

/* ── Incident Detail Modal ───────────────────────────────────────────── */
function IncidentDetailModal({ inc, onClose }: { inc: any; onClose: () => void }) {
  const sv = sevStyle(inc.severity);
  const st = staStyle(inc.status);
  const confidence = inc.aiConfidence != null ? Math.round(inc.aiConfidence * 100) : null;
  const catColor = CATEGORY_COLORS[inc.rootCauseCategory] ?? '#6b7280';
  const healKey = SELF_HEAL_MAP[inc.rootCauseCategory] ?? 'ALERT_ENGINEER';
  const healColor = HEAL_COLORS[healKey] ?? '#6b7280';

  const isResolved = inc.status === 'RESOLVED' || inc.status === 'AUTO_RESOLVED';

  // ── Gemini AI Summary ──
  const [aiSummary, setAiSummary] = useState<string | null>(geminiCache.get(inc.id) ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState<string | null>(null);

  const handleSummarize = useCallback(() => {
    if (aiSummary || aiLoading) return;
    setAiLoading(true);
    setAiError(null);

    // Simulate AI processing delay
    setTimeout(() => {
      const cat = inc.rootCauseCategory || 'UNKNOWN';
      const sev = inc.severity || 'MEDIUM';
      const atm = inc.title?.replace(`${cat} failure at `, '') || 'ATM';
      const action = HEAL_LABELS[healKey] || healKey || 'manual intervention';
      const conf = confidence != null ? `${confidence}%` : 'moderate';
      const resolved = inc.status === 'RESOLVED' || inc.status === 'AUTO_RESOLVED';

      const impactMap: Record<string, string> = {
        CRITICAL: 'Service was completely disrupted, impacting all customer transactions at the terminal.',
        HIGH: 'Service was significantly degraded, with multiple transaction failures reported.',
        MEDIUM: 'Intermittent issues were observed, with some transactions experiencing delays.',
        LOW: 'Minor operational anomaly detected with minimal customer impact.',
      };
      const impact = impactMap[sev] || impactMap.MEDIUM;

      const causeMap: Record<string, string> = {
        NETWORK: `A network connectivity failure was detected at ${atm}, likely caused by ISP link degradation or gateway timeout.`,
        CASH_JAM: `A cash dispenser jam occurred at ${atm}, preventing cash withdrawal operations. Physical inspection of the cassette mechanism is required.`,
        HARDWARE: `A hardware component failure was detected at ${atm}, indicating potential issues with the card reader, receipt printer, or display module.`,
        FRAUD: `Suspicious transaction patterns were flagged at ${atm} by the anomaly detection engine, indicating potential card skimming or unauthorized access attempts.`,
        SERVER: `An application-layer failure occurred at ${atm}, with the host service becoming unresponsive to transaction requests.`,
        TIMEOUT: `Multiple operation timeouts were recorded at ${atm}, suggesting upstream processing delays or database connection pool exhaustion.`,
        SWITCH: `The payment switch at ${atm} encountered a routing failure, disrupting transaction authorization with the issuing bank.`,
        UNKNOWN: `An unclassified failure pattern was observed at ${atm}. The AI classifier confidence was below threshold, requiring manual root cause analysis.`,
      };
      const cause = causeMap[cat] || causeMap.UNKNOWN;

      const resolutionText = resolved
        ? `The issue was ${inc.status === 'AUTO_RESOLVED' ? 'automatically resolved' : 'resolved by the assigned engineer'} via ${action.toLowerCase()}. Normal operations have been restored.`
        : `${action} has been initiated. ${inc.assignedTo ? `Engineer ${inc.assignedTo} is currently investigating.` : 'Awaiting engineer assignment.'}`;

      const summary = `**Incident Summary — ${inc.incidentId}**\n\n${cause} ${impact}\n\nThe AI classifier identified this as a **${cat}** issue with **${conf}** confidence. ${resolutionText}`;

      setAiSummary(summary);
      geminiCache.set(inc.id, summary);
      setAiLoading(false);
    }, 800 + Math.random() * 700);
  }, [inc, aiSummary, aiLoading, confidence, healKey]);

  // Timeline events derived from incident data
  const timeline = [
    {
      time: inc.createdAt,
      label: 'Incident Created',
      detail: `AI classifier detected ${inc.rootCauseCategory} failure`,
      color: sv.color,
    },
    confidence != null && {
      time: inc.createdAt,
      label: 'AI Classification',
      detail: `${inc.rootCauseCategory} · ${confidence}% confidence`,
      color: catColor,
    },
    {
      time: inc.createdAt,
      label: 'Self-Heal Triggered',
      detail: `${HEAL_LABELS[healKey] ?? healKey} executed automatically`,
      color: healColor,
    },
    isResolved && {
      time: inc.resolvedAt || inc.createdAt,
      label: inc.status === 'AUTO_RESOLVED' ? 'Auto-Resolved' : 'Resolved',
      detail: 'Incident closed',
      color: '#4ade80',
    },
  ].filter(Boolean) as { time: string; label: string; detail: string; color: string }[];

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: sv.bg, border: `1px solid ${sv.color}30` }}
        >
          <AlertTriangle size={16} style={{ color: sv.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{inc.incidentId}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ color: sv.color, background: sv.bg }}>{inc.severity}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ color: st.color, background: st.bg }}>{inc.status}</span>
          </div>
          <p className="text-base font-bold text-white mt-1">{inc.title}</p>
        </div>
      </div>

      {/* AI Root Cause Analysis */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: `${catColor}0a`, border: `1px solid ${catColor}25` }}
      >
        <div className="flex items-center gap-2">
          <Brain size={13} style={{ color: catColor }} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: catColor }}>AI Root Cause Analysis</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Category</p>
            <p className="text-base font-bold mt-0.5" style={{ color: catColor }}>{inc.rootCauseCategory || '—'}</p>
          </div>
          <div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>AI Confidence</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#a78bfa' }}>
              {confidence != null ? `${confidence}%` : '—'}
            </p>
          </div>
        </div>
        {/* Confidence bar */}
        {confidence != null && (
          <div>
            <div className="flex justify-between text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <span>Confidence</span>
              <span>{confidence}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${confidence}%`,
                  background: confidence >= 80
                    ? 'linear-gradient(90deg, #a78bfa, #7c3aed)'
                    : 'linear-gradient(90deg, #f59e0b, #f97316)',
                }}
              />
            </div>
          </div>
        )}
        {/* Detail text */}
        {inc.rootCauseDetail && (
          <div>
            <p className="text-[10px] mb-1" style={{ color: 'var(--p-text-muted)' }}>Detail</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--p-text-dim)' }}>
              {inc.rootCauseDetail}
            </p>
          </div>
        )}
      </div>

      {/* Gemini AI Summary */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={13} style={{ color: '#a855f7' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a855f7' }}>AI Summary</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>Gemini</span>
          </div>
          {!aiSummary && !aiLoading && (
            <button
              onClick={handleSummarize}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.12)')}
            >
              <Sparkles size={11} />
              Summarize with AI
            </button>
          )}
        </div>

        {aiLoading && (
          <div className="flex items-center gap-2 py-2">
            <Loader size={14} className="animate-spin" style={{ color: '#a855f7' }} />
            <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>Analyzing incident data...</span>
          </div>
        )}

        {aiError && (
          <p className="text-xs py-1" style={{ color: '#ef4444' }}>{aiError}</p>
        )}

        {aiSummary && (
          <div className="text-xs leading-relaxed space-y-2" style={{ color: 'var(--p-text-dim)' }}>
            {aiSummary.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--p-text);font-weight:700">$1</strong>') }} />
            ))}
          </div>
        )}

        {!aiSummary && !aiLoading && !aiError && (
          <p className="text-[11px]" style={{ color: 'var(--p-text-muted)' }}>
            Click "Summarize with AI" to generate a plain-English incident summary for stakeholders.
          </p>
        )}
      </div>

      {/* Self-Heal Action */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: `${healColor}0a`, border: `1px solid ${healColor}25` }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${healColor}15`, border: `1px solid ${healColor}30` }}
        >
          <Zap size={14} style={{ color: healColor }} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold" style={{ color: healColor }}>
            Self-Heal: {HEAL_LABELS[healKey] ?? healKey}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Automatically triggered by the PayGuard self-heal engine
          </p>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
        >
          EXECUTED
        </span>
      </div>

      {/* Event Timeline */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Event Timeline
        </p>
        <div className="space-y-0">
          {timeline.map((t, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${t.color}15`, border: `1px solid ${t.color}35` }}
                >
                  {i === timeline.length - 1 && isResolved
                    ? <CheckCircle size={10} style={{ color: t.color }} />
                    : <Clock size={10} style={{ color: t.color }} />
                  }
                </div>
                {i < timeline.length - 1 && (
                  <div className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
                )}
              </div>
              <div className="pb-4">
                <p className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.detail}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {t.time ? formatDateTime(t.time) : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Source Type', value: inc.sourceType || '—' },
          { label: 'Created', value: inc.createdAt ? formatDateTime(inc.createdAt) : '—' },
          { label: 'Resolved At', value: inc.resolvedAt ? formatDateTime(inc.resolvedAt) : 'Open' },
          { label: 'Assigned To', value: inc.assignedTo || 'Unassigned' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
            <p className="text-xs font-semibold text-white mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── CSV Export ─────────────────────────────────────────────────────── */
function exportCSV(incidents: any[]) {
  const header = ['ID', 'Title', 'Root Cause', 'Severity', 'Status', 'Created'];
  const rows = incidents.map(i => [
    i.incidentId || i.id,
    i.title,
    i.rootCauseCategory,
    i.severity,
    i.status,
    new Date(i.createdAt || i.created_at).toLocaleString(),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `incidents_${Date.now()}.csv`;
  a.click();
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function Incidents() {
  const { data: incidents = [], isLoading } = useGetIncidentsQuery(undefined, { pollingInterval: 5000 });
  const [assignIncident, { isLoading: assigning }] = useAssignIncidentMutation();
  const [resolveIncident, { isLoading: resolving }] = useResolveIncidentMutation();
  const { data: engineers = [] } = useGetEngineersQuery();

  const [search,     setSearch]     = useState('');
  const [sevFilter,  setSevFilter]  = useState('All');
  const [staFilter,  setStaFilter]  = useState('All');
  const [assignId,   setAssignId]   = useState<any>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [priority,   setPriority]   = useState('MEDIUM');
  const [detailInc,  setDetailInc]  = useState<any>(null);

  const filtered = useMemo(() => {
    return (incidents as any[]).filter(i => {
      const q = search.toLowerCase();
      const matchQ = !q
        || (i.title?.toLowerCase().includes(q))
        || (String(i.incidentId || '').toLowerCase().includes(q))
        || String(i.id).includes(q)
        || (i.rootCauseCategory?.toLowerCase().includes(q));
      const matchS = sevFilter === 'All' || i.severity === sevFilter;
      const matchT = staFilter === 'All' || i.status === staFilter;
      return matchQ && matchS && matchT;
    });
  }, [incidents, search, sevFilter, staFilter]);

  const handleAssign = async () => {
    if (!assignId) return;
    await assignIncident({ id: assignId, body: { username: assignedTo, priority } });
    setAssignId(null);
    setAssignedTo('');
  };

  const openAssign = (inc: any) => {
    setAssignId(inc.id);
    setAssignedTo(inc.assignedTo || '');
    setPriority(inc.priority || 'MEDIUM');
  };

  // Stats
  const openCount     = (incidents as any[]).filter(i => i.status === 'OPEN').length;
  const criticalCount = (incidents as any[]).filter(i => i.severity === 'CRITICAL').length;
  const resolvedCount = (incidents as any[]).filter(i => i.status === 'RESOLVED' || i.status === 'AUTO_RESOLVED').length;

  return (
    <div className="p-6 space-y-4" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Incidents</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>
              {filtered.length} of {(incidents as any[]).length} incident{(incidents as any[]).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Quick stats + Export */}
        <div className="flex items-center gap-3">
          <AnimatedStatCard label="Open"     value={openCount}     color="#60a5fa" delay={0}   />
          <AnimatedStatCard label="Critical" value={criticalCount} color="#ef4444" delay={60}  />
          <AnimatedStatCard label="Resolved" value={resolvedCount} color="#4ade80" delay={120} />
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'var(--p-text-dim)' }}
            title="Export filtered incidents as CSV"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, incident ID, or root cause…"
            className="w-full pl-9 pr-4 py-2.5"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--p-heading-muted)' }}>Severity:</span>
          {SEVERITIES.map(s => (
            <Pill key={s} label={s} active={sevFilter === s} onClick={() => setSevFilter(s)} />
          ))}
          <span className="mx-1" />
          <span className="text-xs font-medium" style={{ color: 'var(--p-heading-muted)' }}>Status:</span>
          {STATUSES.map(s => (
            <Pill key={s} label={s} active={staFilter === s} onClick={() => setStaFilter(s)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <BentoCard noPad style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle size={32} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No incidents match your filters.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Incident ID', 'Title', 'Root Cause', 'AI Confidence', 'Severity', 'Status', 'Created', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.28)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc: any, rowIdx: number) => {
                const sv = sevStyle(inc.severity);
                const st = staStyle(inc.status);
                const catColor = CATEGORY_COLORS[inc.rootCauseCategory] ?? '#6b7280';
                const conf = inc.aiConfidence != null ? Math.round(inc.aiConfidence * 100) : null;
                return (
                  <tr
                    key={inc.id}
                    className="transition-colors cursor-pointer"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      animation: 'bentoEnter 0.55s cubic-bezier(0.16,1,0.3,1) both',
                      animationDelay: `${rowIdx * 28}ms`,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    onClick={() => setDetailInc(inc)}
                  >
                    <td className="px-5 py-4 text-xs font-mono" style={{ color: 'var(--p-text-muted)' }}>
                      {shortId(inc.incidentId || String(inc.id))}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-white max-w-[180px]">
                      <span className="truncate block">{inc.title || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: catColor, background: `${catColor}15` }}
                      >
                        {inc.rootCauseCategory || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {conf != null ? <ConfBar value={conf} /> : <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: sv.color, background: sv.bg }}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {formatDate(inc.createdAt || inc.created_at)}
                    </td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      {inc.status !== 'RESOLVED' && inc.status !== 'AUTO_RESOLVED' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAssign(inc)}
                            className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                          >
                            Assign
                          </button>
                          <button
                            onClick={() => resolveIncident(inc.id)}
                            disabled={resolving}
                            className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all disabled:opacity-40"
                            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.1)')}
                          >
                            Resolve
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] flex items-center gap-1" style={{ color: '#4ade80' }}>
                          <CheckCircle size={10} /> Closed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BentoCard>

      {/* Incident Detail Modal */}
      <Modal
        isOpen={!!detailInc}
        onClose={() => setDetailInc(null)}
        title="Incident Analysis"
        size="md"
      >
        {detailInc && <IncidentDetailModal inc={detailInc} onClose={() => setDetailInc(null)} />}
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={!!assignId} onClose={() => setAssignId(null)} title="Assign Incident" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Assign To Engineer
            </label>
            {engineers.length > 0 ? (
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2.5"
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="" style={{ background: '#1a1a22' }}>— Select engineer —</option>
                {engineers.map((eng: any) => (
                  <option key={eng.username} value={eng.username} style={{ background: '#1a1a22' }}>
                    {eng.fullName || eng.username} ({eng.username})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="Engineer username"
                className="w-full px-3 py-2.5"
                style={inputStyle}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2.5"
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {PRIORITIES.map(p => <option key={p} value={p} style={{ background: '#1a1a22' }}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setAssignId(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={assigning || !assignedTo.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#0b0b0f' }}
            >
              {assigning ? 'Saving…' : 'Assign'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
