import React, { useState, useMemo } from 'react';
import { AlertTriangle, Search, X, Brain, Zap, Clock, CheckCircle, Download } from 'lucide-react';
import {
  useGetIncidentsQuery,
  useAssignIncidentMutation,
  useResolveIncidentMutation,
} from '../services/pulseApi';
import Modal from '../components/common/Modal';
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

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
      style={active
        ? { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }
        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
      }
    >
      {label.replace('_', ' ')}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '13px',
};

/* ── Incident Detail Modal ───────────────────────────────────────────── */
function IncidentDetailModal({ inc, onClose }: { inc: any; onClose: () => void }) {
  const sv = sevStyle(inc.severity);
  const st = staStyle(inc.status);
  const confidence = inc.aiConfidence != null ? Math.round(inc.aiConfidence * 100) : null;
  const catColor = CATEGORY_COLORS[inc.rootCauseCategory] ?? '#6b7280';
  const healKey = SELF_HEAL_MAP[inc.rootCauseCategory] ?? 'ALERT_ENGINEER';
  const healColor = HEAL_COLORS[healKey] ?? '#6b7280';

  const isResolved = inc.status === 'RESOLVED' || inc.status === 'AUTO_RESOLVED';

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
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {inc.rootCauseDetail}
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
            Automatically triggered by the PULSE self-heal engine
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
    await assignIncident({ id: assignId, body: { assigned_to: assignedTo, priority } });
    setAssignId(null);
    setAssignedTo('');
  };

  const openAssign = (inc: any) => {
    setAssignId(inc.id);
    setAssignedTo(inc.assignedTo || inc.assigned_to || '');
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
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {filtered.length} of {(incidents as any[]).length} incident{(incidents as any[]).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Quick stats + Export */}
        <div className="flex items-center gap-3">
          {[
            { label: 'Open', value: openCount, color: '#60a5fa' },
            { label: 'Critical', value: criticalCount, color: '#ef4444' },
            { label: 'Resolved', value: resolvedCount, color: '#4ade80' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center px-4 py-2 rounded-xl"
              style={{ background: `${color}0a`, border: `1px solid ${color}20` }}
            >
              <span className="text-lg font-bold" style={{ color }}>{value}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
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
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Severity:</span>
          {SEVERITIES.map(s => (
            <Pill key={s} label={s} active={sevFilter === s} onClick={() => setSevFilter(s)} />
          ))}
          <span className="mx-1" />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Status:</span>
          {STATUSES.map(s => (
            <Pill key={s} label={s} active={staFilter === s} onClick={() => setStaFilter(s)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
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
              {filtered.map((inc: any) => {
                const sv = sevStyle(inc.severity);
                const st = staStyle(inc.status);
                const catColor = CATEGORY_COLORS[inc.rootCauseCategory] ?? '#6b7280';
                const conf = inc.aiConfidence != null ? Math.round(inc.aiConfidence * 100) : null;
                return (
                  <tr
                    key={inc.id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    onClick={() => setDetailInc(inc)}
                  >
                    <td className="px-5 py-4 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
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
                      {conf != null ? (
                        <div className="flex items-center gap-2">
                          <div className="rounded-full overflow-hidden" style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.07)' }}>
                            <div className="h-full rounded-full" style={{ width: `${conf}%`, background: '#a78bfa' }} />
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: '#a78bfa' }}>{conf}%</span>
                        </div>
                      ) : '—'}
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
      </div>

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
              Assigned To
            </label>
            <input
              type="text"
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              placeholder="Engineer name or team"
              className="w-full px-3 py-2.5"
              style={inputStyle}
            />
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
