import React, { useState, useMemo } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import {
  useGetIncidentsQuery,
  useAssignIncidentMutation,
  useResolveIncidentMutation,
} from '../services/pulseApi';
import Modal from '../components/common/Modal';
import { formatDate, shortId } from '../utils';

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
    OPEN:         { color: '#60a5fa', bg: '#60a5fa1a' },
    RESOLVED:     { color: '#4ade80', bg: '#4ade801a' },
    ACKNOWLEDGED: { color: '#a78bfa', bg: '#a78bfa1a' },
    ACTIVE:       { color: '#60a5fa', bg: '#60a5fa1a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

const SEVERITIES = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES   = ['All', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
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
      {label}
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

export default function Incidents() {
  const { data: incidents = [], isLoading } = useGetIncidentsQuery();
  const [assignIncident, { isLoading: assigning }] = useAssignIncidentMutation();
  const [resolveIncident, { isLoading: resolving }] = useResolveIncidentMutation();

  const [search,     setSearch]     = useState('');
  const [sevFilter,  setSevFilter]  = useState('All');
  const [staFilter,  setStaFilter]  = useState('All');
  const [assignId,   setAssignId]   = useState<any>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [priority,   setPriority]   = useState('MEDIUM');

  const filtered = useMemo(() => {
    return (incidents as any[]).filter(i => {
      const q = search.toLowerCase();
      const matchQ = !q
        || (i.title?.toLowerCase().includes(q))
        || (String(i.incidentId || '').toLowerCase().includes(q))
        || String(i.id).includes(q);
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

  return (
    <div className="p-8 space-y-5" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {filtered.length} of {(incidents as any[]).length} incident{(incidents as any[]).length !== 1 ? 's' : ''}
          </p>
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
            placeholder="Search by title or incident ID…"
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
                {['Incident ID', 'Title', 'Severity', 'Status', 'Root Cause', 'Assigned To', 'Created', 'Actions'].map(h => (
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
                return (
                  <tr
                    key={inc.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-4 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      {shortId(inc.incidentId || String(inc.id))}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-white max-w-[160px]">
                      <span className="truncate block">{inc.title || '—'}</span>
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
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {inc.rootCauseCategory || inc.root_cause_category || '—'}
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {inc.assignedTo || inc.assigned_to || '—'}
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {formatDate(inc.createdAt || inc.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      {inc.status !== 'RESOLVED' ? (
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
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
