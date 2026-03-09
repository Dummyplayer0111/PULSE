import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useGetMyIncidentsQuery, useResolveIncidentMutation, useUpdateIncidentMutation } from '../services/payguardApi';
import { Wrench, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#f87171',
  HIGH:     '#fb923c',
  MEDIUM:   '#facc15',
  LOW:      '#4ade80',
};

function age(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Review Modal ────────────────────────────────────────────────────────────
function ReviewModal({
  inc,
  onClose,
  onResolve,
  onUpdateStatus,
}: {
  inc: any;
  onClose: () => void;
  onResolve: (id: number) => Promise<void>;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
}) {
  const [status, setStatus]     = useState(inc.status);
  const [saving,  setSaving]    = useState(false);
  const [resolving, setResolving] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    await onUpdateStatus(inc.id, status);
    setSaving(false);
    onClose();
  };

  const handleResolve = async () => {
    setResolving(true);
    await onResolve(inc.id);
    setResolving(false);
    onClose();
  };

  const row = (label: string, value: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'var(--p-text-muted)', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: 'var(--p-text)', fontSize: '0.8rem', fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--p-card)', border: '1px solid var(--p-card-border)',
        borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--p-text)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Incident Review</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--p-text)', fontWeight: 600, marginBottom: '1rem' }}>{inc.title}</p>

        <div style={{ marginBottom: '1rem' }}>
          {row('Incident ID',  inc.incidentId || `#${inc.id}`)}
          {row('Severity',     inc.severity)}
          {row('Root Cause',   inc.rootCauseCategory)}
          {row('AI Confidence', `${Math.round((inc.aiConfidence || 0) * 100)}%`)}
          {row('Status',       inc.status)}
          {row('Age',          age(inc.createdAt))}
          {inc.rootCauseDetail && row('Detail', inc.rootCauseDetail)}
        </div>

        {/* Status selector */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: 'var(--p-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Update Status
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{
              width: '100%', padding: '0.6rem 0.8rem', borderRadius: 10,
              background: 'var(--p-input-bg, rgba(255,255,255,0.06))',
              border: '1px solid var(--p-card-border)', color: 'var(--p-text)',
              fontSize: '0.875rem', outline: 'none',
            }}
          >
            {['OPEN','INVESTIGATING','ESCALATED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--p-text)', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleUpdate} disabled={saving} style={{
            padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'var(--p-text)', cursor: 'pointer', opacity: saving ? 0.5 : 1,
          }}>
            {saving ? 'Saving…' : 'Update Status'}
          </button>
          <button onClick={handleResolve} disabled={resolving} style={{
            padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
            background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
            color: '#34d399', cursor: 'pointer', opacity: resolving ? 0.5 : 1,
          }}>
            {resolving ? 'Resolving…' : 'Resolve Incident'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export default function EngineerDashboard() {
  const auth     = useSelector((s: RootState) => s.auth);
  const username = auth.username;

  const [tab, setTab]           = useState<Tab>('OPEN');
  const [reviewInc, setReviewInc] = useState<any>(null);

  // Separate queries so we can poll at different rates
  const { data: activeData = [], refetch: refetchActive } = useGetMyIncidentsQuery(
    { assigned_to: username },
    { pollingInterval: 8000, skip: !username },
  );
  const { data: resolvedData = [], refetch: refetchResolved } = useGetMyIncidentsQuery(
    { assigned_to: username, status: 'RESOLVED' },
    { pollingInterval: 30000, skip: !username },
  );

  const [resolveIncident] = useResolveIncidentMutation();
  const [updateIncident]  = useUpdateIncidentMutation();

  const handleResolve = async (id: number) => {
    await resolveIncident(id);
    refetchActive();
    refetchResolved();
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    await updateIncident({ id, body: { status } });
    refetchActive();
  };

  // Derive counts from activeData
  const openCount         = activeData.filter(i => i.status === 'OPEN').length;
  const investigatingCount = activeData.filter(i => i.status === 'INVESTIGATING').length;
  const resolvedCount     = resolvedData.length;

  const displayData = tab === 'RESOLVED'
    ? resolvedData
    : activeData.filter(i => i.status === tab);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '0.45rem 1rem',
    borderRadius: 10,
    fontSize: '0.8rem',
    fontWeight: 600,
    border: tab === t ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
    background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: tab === t ? 'var(--p-text)' : 'var(--p-text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', background: 'var(--p-page)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Wrench size={22} style={{ color: 'var(--p-text)' }} />
        <h1 style={{ color: 'var(--p-text)', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>My Incidents</h1>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--p-text-muted)',
        }}>
          {username}
        </span>

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[
            { label: 'Pending',       count: openCount,          color: '#facc15' },
            { label: 'Investigating', count: investigatingCount,  color: '#fb923c' },
            { label: 'Resolved',      count: resolvedCount,       color: '#4ade80' },
          ].map(({ label, count, color }) => (
            <span key={label} style={{
              padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              background: `${color}18`, border: `1px solid ${color}40`, color,
            }}>
              {count} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--p-card)', border: '1px solid var(--p-card-border)',
        borderRadius: 18, overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '1rem 1.25rem', borderBottom: '1px solid var(--p-card-border)' }}>
          {(['OPEN', 'INVESTIGATING', 'RESOLVED'] as Tab[]).map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
              {t === 'OPEN' ? 'Pending' : t === 'INVESTIGATING' ? 'Investigating' : 'Resolved'}
            </button>
          ))}
        </div>

        {/* Table */}
        {displayData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <CheckCircle size={36} style={{ color: '#4ade80', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--p-text)', fontWeight: 600, marginBottom: 4 }}>All clear!</p>
            <p style={{ color: 'var(--p-text-muted)', fontSize: '0.85rem' }}>
              No {tab.toLowerCase()} incidents assigned to you.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                  {['ID', 'Title', 'Root Cause', 'Severity', 'Status', 'Age', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600,
                      color: 'var(--p-text-muted)', fontSize: '0.72rem',
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((inc: any) => (
                  <tr key={inc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--p-text-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      #{inc.id}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--p-text)', maxWidth: 220 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inc.title}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--p-text-muted)' }}>{inc.rootCauseCategory}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.55rem', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700,
                        color: SEV_COLOR[inc.severity] || 'var(--p-text)',
                        background: `${SEV_COLOR[inc.severity] || '#fff'}18`,
                        border: `1px solid ${SEV_COLOR[inc.severity] || '#fff'}30`,
                      }}>
                        {inc.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.55rem', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600,
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--p-text)',
                      }}>
                        {inc.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--p-text-muted)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        {age(inc.createdAt)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setReviewInc(inc)}
                          style={{
                            padding: '0.3rem 0.7rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                            color: 'var(--p-text)', cursor: 'pointer',
                          }}
                        >
                          Review
                        </button>
                        {inc.status !== 'RESOLVED' && inc.status !== 'AUTO_RESOLVED' && (
                          <button
                            onClick={() => handleResolve(inc.id)}
                            style={{
                              padding: '0.3rem 0.7rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
                              color: '#34d399', cursor: 'pointer',
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewInc && (
        <ReviewModal
          inc={reviewInc}
          onClose={() => setReviewInc(null)}
          onResolve={handleResolve}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
