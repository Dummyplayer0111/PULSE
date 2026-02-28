import React, { useState, useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useGetAnomalyFlagsQuery, useUpdateAnomalyFlagMutation } from '../services/pulseApi';
import Modal from '../components/common/Modal';
import { formatDate, shortId } from '../utils';

const STATUSES = ['All', 'ACTIVE', 'REVIEWED', 'DISMISSED', 'FALSE_POSITIVE'];
const UPDATE_STATUSES = ['ACTIVE', 'REVIEWED', 'DISMISSED', 'FALSE_POSITIVE'];

function staStyle(s: string) {
  const m: any = {
    ACTIVE:         { color: '#60a5fa', bg: '#60a5fa1a' },
    REVIEWED:       { color: '#4ade80', bg: '#4ade801a' },
    DISMISSED:      { color: '#6b7280', bg: '#6b72801a' },
    FALSE_POSITIVE: { color: '#f97316', bg: '#f973161a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

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

export default function Anomaly() {
  const { data: flags = [], isLoading } = useGetAnomalyFlagsQuery();
  const [updateFlag, { isLoading: updating }] = useUpdateAnomalyFlagMutation();

  const [staFilter,  setStaFilter]  = useState('All');
  const [editId,     setEditId]     = useState<any>(null);
  const [newStatus,  setNewStatus]  = useState('REVIEWED');
  const [notes,      setNotes]      = useState('');

  const filtered = useMemo(() => {
    return (flags as any[]).filter(f => staFilter === 'All' || f.status === staFilter);
  }, [flags, staFilter]);

  const handleUpdate = async () => {
    if (!editId) return;
    await updateFlag({ id: editId, body: { status: newStatus, notes } });
    setEditId(null);
    setNotes('');
  };

  const openEdit = (flag: any) => {
    setEditId(flag.id);
    setNewStatus(flag.status || 'REVIEWED');
    setNotes(flag.notes || '');
  };

  return (
    <div className="p-8 space-y-5" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <ShieldAlert size={16} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Anomaly Detection</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {filtered.length} flag{filtered.length !== 1 ? 's' : ''} shown
          </p>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Status:</span>
        {STATUSES.map(s => (
          <Pill key={s} label={s} active={staFilter === s} onClick={() => setStaFilter(s)} />
        ))}
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
            <ShieldAlert size={32} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No anomaly flags detected.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Source', 'Type', 'Confidence', 'Status', 'Notes', 'Detected', 'Action'].map(h => (
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
              {filtered.map((flag: any) => {
                const confidence = flag.confidenceScore ?? flag.confidence_score ?? null;
                const pct = confidence != null ? Math.round(confidence * 100) : null;
                const st = staStyle(flag.status || 'ACTIVE');
                return (
                  <tr
                    key={flag.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {shortId(flag.sourceId || flag.source_id)}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {flag.sourceType || flag.source_type || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }}
                      >
                        {flag.anomalyType || flag.anomaly_type || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {pct != null ? (
                        <div className="space-y-1 w-24">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">{pct}%</span>
                          </div>
                          <div
                            className="w-full rounded-full overflow-hidden"
                            style={{ height: '4px', background: 'rgba(255,255,255,0.08)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 80
                                  ? 'linear-gradient(90deg, #f97316, #ef4444)'
                                  : pct >= 60
                                    ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                                    : 'linear-gradient(90deg, #22c55e, #4ade80)',
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: st.color, background: st.bg }}
                      >
                        {flag.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs max-w-[140px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {flag.notes || '—'}
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {formatDate(flag.createdAt || flag.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openEdit(flag)}
                        className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                        style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.1)')}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Update Modal */}
      <Modal isOpen={!!editId} onClose={() => setEditId(null)} title="Update Anomaly Flag" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              New Status
            </label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2.5"
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {UPDATE_STATUSES.map(s => (
                <option key={s} value={s} style={{ background: '#1a1a22' }}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 resize-none"
              style={inputStyle}
              placeholder="Add investigation notes…"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setEditId(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#0b0b0f' }}
            >
              {updating ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
