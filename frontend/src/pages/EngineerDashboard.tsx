import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useGetMyIncidentsQuery, useResolveIncidentMutation, useUpdateIncidentMutation } from '../services/payguardApi';
import { Wrench, CheckCircle, Clock, AlertTriangle, X, Search, Filter, MapPin, Activity, MessageSquare, ChevronDown, Timer } from 'lucide-react';
import { useToast } from '../components/notifications/ToastProvider';
import { BentoCard } from '../components/BentoCard';

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#f87171',
  HIGH:     '#fb923c',
  MEDIUM:   '#facc15',
  LOW:      '#4ade80',
};

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const RC_COLORS: Record<string, string> = {
  NETWORK: '#60a5fa', HARDWARE: '#f97316', CASH_JAM: '#eab308',
  FRAUD: '#ef4444', SERVER: '#a78bfa', TIMEOUT: '#fb923c',
  SWITCH: '#34d399', UNKNOWN: '#6b7280',
};

const SLA_MTTA_LIMIT_MS = 15 * 60 * 1000; // 15 min
const SLA_MTTR_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours

function age(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── SLA Countdown ─────────────────────────────────────────────────────── */
function SLACountdown({ createdAt, isResolved }: { createdAt: string; isResolved: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (isResolved) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isResolved]);

  if (isResolved) return <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Resolved</span>;

  const elapsed = now - new Date(createdAt).getTime();
  const remaining = SLA_MTTR_LIMIT_MS - elapsed;
  const breached = remaining <= 0;

  if (breached) {
    const over = Math.abs(remaining);
    const mins = Math.floor(over / 60000);
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
        <Timer size={10} />
        SLA breached ({mins}m over)
      </span>
    );
  }

  const totalMins = Math.floor(remaining / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const urgent = remaining < 30 * 60 * 1000; // < 30 min
  const warning = remaining < 60 * 60 * 1000; // < 1 hour
  const color = urgent ? '#ef4444' : warning ? '#f97316' : '#4ade80';

  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: 3, fontVariantNumeric: 'tabular-nums' }}>
      <Timer size={10} />
      {hours}h {mins}m left
    </span>
  );
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
  onUpdateStatus: (id: number, status: string, extra?: Record<string, string>) => Promise<void>;
}) {
  const [status, setStatus] = useState(inc.status);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [escalationReason, setEscalationReason] = useState(inc.escalationReason || '');
  const [notes, setNotes] = useState(inc.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const { push: pushToast } = useToast();

  const handleUpdate = async () => {
    setSaving(true);
    const extra: Record<string, string> = {};
    if (status === 'ESCALATED' && escalationReason) {
      extra.escalationReason = escalationReason;
    }
    if (notes !== (inc.notes || '')) {
      extra.notes = notes;
    }
    await onUpdateStatus(inc.id, status, extra);
    pushToast('success', 'Status Updated', `Incident #${inc.id} → ${status}`);
    setSaving(false);
    onClose();
  };

  const handleResolve = async () => {
    setResolving(true);
    await onResolve(inc.id);
    pushToast('success', 'Incident Resolved', `Incident #${inc.id} marked as resolved`);
    setResolving(false);
    onClose();
  };

  const handleSaveNotes = async () => {
    await onUpdateStatus(inc.id, inc.status, { notes });
    setNotesSaved(true);
    pushToast('info', 'Notes Saved', 'Your notes have been saved');
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const isResolved = inc.status === 'RESOLVED' || inc.status === 'AUTO_RESOLVED';

  const row = (label: string, value: React.ReactNode) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'var(--p-text-muted)', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: 'var(--p-text)', fontSize: '0.8rem', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
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
        borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 520,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--p-text)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Incident Review</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--p-text)', fontWeight: 600, marginBottom: '0.75rem' }}>{inc.title}</p>

        {/* ATM Location context */}
        {inc.atmName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, marginBottom: '0.75rem',
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
          }}>
            <MapPin size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa' }}>{inc.atmName}</span>
              <span style={{ fontSize: 11, color: 'var(--p-text-dim)', marginLeft: 8 }}>{inc.atmLocation}</span>
            </div>
            {inc.atmHealthScore != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Activity size={10} style={{ color: inc.atmHealthScore >= 60 ? '#4ade80' : '#ef4444' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: inc.atmHealthScore >= 60 ? '#4ade80' : '#ef4444' }}>{Math.round(inc.atmHealthScore)}</span>
              </div>
            )}
          </div>
        )}

        {/* SLA Timer */}
        <div style={{ padding: '8px 12px', borderRadius: 10, marginBottom: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--p-text-muted)' }}>SLA Status</span>
          <SLACountdown createdAt={inc.createdAt} isResolved={isResolved} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          {row('Incident ID', inc.incidentId || `#${inc.id}`)}
          {row('Severity', <span style={{ color: SEV_COLOR[inc.severity], fontWeight: 700 }}>{inc.severity}</span>)}
          {row('Root Cause', <span style={{ color: RC_COLORS[inc.rootCauseCategory] ?? 'var(--p-text)' }}>{inc.rootCauseCategory}</span>)}
          {row('AI Confidence', `${Math.round((inc.aiConfidence || 0) * 100)}%`)}
          {row('Status', inc.status)}
          {row('Age', age(inc.createdAt))}
          {inc.rootCauseDetail && row('Detail', inc.rootCauseDetail)}
          {inc.escalationReason && row('Escalation Reason', inc.escalationReason)}
        </div>

        {/* Notes / comments */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: 'var(--p-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <MessageSquare size={11} /> Engineer Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes for shift handoff, investigation context, or remediation steps..."
            rows={3}
            style={{
              width: '100%', padding: '0.6rem 0.8rem', borderRadius: 10,
              background: 'var(--p-input-bg, rgba(255,255,255,0.06))',
              border: '1px solid var(--p-card-border)', color: 'var(--p-text)',
              fontSize: '0.82rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={handleSaveNotes} style={{
              padding: '0.3rem 0.8rem', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600,
              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)',
              color: '#60a5fa', cursor: 'pointer',
            }}>
              {notesSaved ? 'Saved!' : 'Save Notes'}
            </button>
          </div>
        </div>

        {/* Status selector */}
        {!isResolved && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: 'var(--p-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
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
              {['OPEN', 'INVESTIGATING', 'ESCALATED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Escalation reason — shown when status is ESCALATED */}
        {status === 'ESCALATED' && !isResolved && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#f87171', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Escalation Reason *
            </label>
            <textarea
              value={escalationReason}
              onChange={e => setEscalationReason(e.target.value)}
              placeholder="Why is this being escalated? (required for audit trail)"
              rows={2}
              style={{
                width: '100%', padding: '0.6rem 0.8rem', borderRadius: 10,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)', color: 'var(--p-text)',
                fontSize: '0.82rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--p-text)', cursor: 'pointer',
          }}>
            Cancel
          </button>
          {!isResolved && (
            <>
              <button
                onClick={handleUpdate}
                disabled={saving || (status === 'ESCALATED' && !escalationReason.trim())}
                style={{
                  padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  color: 'var(--p-text)', cursor: 'pointer',
                  opacity: saving || (status === 'ESCALATED' && !escalationReason.trim()) ? 0.4 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Update Status'}
              </button>
              <button onClick={handleResolve} disabled={resolving} style={{
                padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
                color: '#34d399', cursor: 'pointer', opacity: resolving ? 0.5 : 1,
              }}>
                {resolving ? 'Resolving…' : 'Resolve Incident'}
              </button>
            </>
          )}
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
  const { push: pushToast } = useToast();

  const [tab, setTab]             = useState<Tab>('OPEN');
  const [reviewInc, setReviewInc] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sevFilter, setSevFilter]     = useState<string>('ALL');
  const [rcFilter, setRcFilter]       = useState<string>('ALL');
  const [sortBy, setSortBy]           = useState<'severity' | 'age'>('severity');

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
    pushToast('success', 'Incident Resolved', `Incident #${id} marked as resolved`);
    refetchActive();
    refetchResolved();
  };

  const handleUpdateStatus = async (id: number, status: string, extra?: Record<string, string>) => {
    await updateIncident({ id, body: { status, ...extra } });
    refetchActive();
  };

  // Derive counts
  const openCount         = activeData.filter(i => i.status === 'OPEN').length;
  const investigatingCount = activeData.filter(i => i.status === 'INVESTIGATING').length;
  const escalatedCount     = activeData.filter(i => i.status === 'ESCALATED').length;
  const resolvedCount     = resolvedData.length;

  // Get unique root cause categories for filter
  const allRootCauses = useMemo(() => {
    const s = new Set<string>();
    [...activeData, ...resolvedData].forEach(i => { if (i.rootCauseCategory) s.add(i.rootCauseCategory); });
    return Array.from(s).sort();
  }, [activeData, resolvedData]);

  // Filter + sort
  const displayData = useMemo(() => {
    let data = tab === 'RESOLVED'
      ? resolvedData
      : activeData.filter(i => i.status === tab);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.incidentId || '').toLowerCase().includes(q) ||
        (i.rootCauseCategory || '').toLowerCase().includes(q) ||
        (i.atmName || '').toLowerCase().includes(q) ||
        (i.atmLocation || '').toLowerCase().includes(q) ||
        String(i.id).includes(q)
      );
    }

    // Severity filter
    if (sevFilter !== 'ALL') {
      data = data.filter(i => i.severity === sevFilter);
    }

    // Root cause filter
    if (rcFilter !== 'ALL') {
      data = data.filter(i => i.rootCauseCategory === rcFilter);
    }

    // Sort
    data = [...data].sort((a, b) => {
      if (sortBy === 'severity') {
        const diff = (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return data;
  }, [tab, activeData, resolvedData, searchQuery, sevFilter, rcFilter, sortBy]);

  // SLA breach count
  const slaBreachCount = useMemo(() => {
    return activeData.filter(i => {
      const elapsed = Date.now() - new Date(i.createdAt).getTime();
      return elapsed > SLA_MTTR_LIMIT_MS && i.status !== 'RESOLVED' && i.status !== 'AUTO_RESOLVED';
    }).length;
  }, [activeData]);

  const isFiltered = searchQuery || sevFilter !== 'ALL' || rcFilter !== 'ALL';

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
          {slaBreachCount > 0 && (
            <span style={{
              padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Timer size={11} /> {slaBreachCount} SLA Breach{slaBreachCount > 1 ? 'es' : ''}
            </span>
          )}
          {[
            { label: 'Pending',       count: openCount,          color: '#facc15' },
            { label: 'Investigating', count: investigatingCount,  color: '#fb923c' },
            { label: 'Escalated',     count: escalatedCount,      color: '#f87171' },
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

      {/* Search & Filters bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', flex: 1, minWidth: 200, maxWidth: 350,
        }}>
          <Search size={13} style={{ color: 'var(--p-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title, ATM, ID, root cause..."
            style={{
              background: 'none', border: 'none', outline: 'none', color: 'var(--p-text)',
              fontSize: '0.82rem', width: '100%', fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-text-muted)', padding: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Severity filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={11} style={{ color: 'var(--p-text-muted)' }} />
          <select
            value={sevFilter}
            onChange={e => setSevFilter(e.target.value)}
            style={{
              padding: '5px 8px', borderRadius: 8, fontSize: '0.78rem',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: sevFilter !== 'ALL' ? SEV_COLOR[sevFilter] : 'var(--p-text-muted)',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="ALL">All Severity</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Root cause filter */}
        <select
          value={rcFilter}
          onChange={e => setRcFilter(e.target.value)}
          style={{
            padding: '5px 8px', borderRadius: 8, fontSize: '0.78rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: rcFilter !== 'ALL' ? RC_COLORS[rcFilter] ?? 'var(--p-text)' : 'var(--p-text-muted)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="ALL">All Root Causes</option>
          {allRootCauses.map(rc => (
            <option key={rc} value={rc}>{rc}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          style={{
            padding: '5px 8px', borderRadius: 8, fontSize: '0.78rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--p-text-muted)', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="severity">Sort: Severity</option>
          <option value="age">Sort: Newest</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => { setSearchQuery(''); setSevFilter('ALL'); setRcFilter('ALL'); }}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--p-card)', border: '1px solid var(--p-card-border)',
        borderRadius: 18, overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '1rem 1.25rem', borderBottom: '1px solid var(--p-card-border)', alignItems: 'center' }}>
          {(['OPEN', 'INVESTIGATING', 'RESOLVED'] as Tab[]).map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
              {t === 'OPEN' ? 'Pending' : t === 'INVESTIGATING' ? 'Investigating' : 'Resolved'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--p-text-muted)' }}>
            {displayData.length} incident{displayData.length !== 1 ? 's' : ''}
            {isFiltered ? ' (filtered)' : ''}
          </span>
        </div>

        {/* Table */}
        {displayData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <CheckCircle size={36} style={{ color: '#4ade80', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--p-text)', fontWeight: 600, marginBottom: 4 }}>
              {isFiltered ? 'No matching incidents' : 'All clear!'}
            </p>
            <p style={{ color: 'var(--p-text-muted)', fontSize: '0.85rem' }}>
              {isFiltered ? 'Try adjusting your filters.' : `No ${tab.toLowerCase()} incidents assigned to you.`}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                  {['ID', 'Title', 'ATM', 'Root Cause', 'Severity', 'SLA', 'Age', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600,
                      color: 'var(--p-text-muted)', fontSize: '0.72rem',
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((inc: any) => {
                  const isResolved = inc.status === 'RESOLVED' || inc.status === 'AUTO_RESOLVED';
                  return (
                    <tr
                      key={inc.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--p-text-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        #{inc.id}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--p-text)', maxWidth: 200 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inc.title}
                        </span>
                        {inc.notes && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: '#60a5fa', marginTop: 2 }}>
                            <MessageSquare size={9} /> has notes
                          </span>
                        )}
                      </td>
                      {/* ATM context column */}
                      <td style={{ padding: '0.75rem 1rem', maxWidth: 160 }}>
                        {inc.atmName ? (
                          <div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--p-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {inc.atmName}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <MapPin size={9} style={{ color: 'var(--p-text-muted)' }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--p-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(inc.atmLocation || '').split(',')[0]}
                              </span>
                              {inc.atmHealthScore != null && (
                                <span style={{
                                  fontSize: '0.68rem', fontWeight: 700, marginLeft: 4,
                                  color: inc.atmHealthScore >= 60 ? '#4ade80' : inc.atmHealthScore >= 30 ? '#eab308' : '#ef4444',
                                }}>
                                  {Math.round(inc.atmHealthScore)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--p-text-muted)', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ color: RC_COLORS[inc.rootCauseCategory] ?? 'var(--p-text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>
                          {inc.rootCauseCategory}
                        </span>
                      </td>
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
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <SLACountdown createdAt={inc.createdAt} isResolved={isResolved} />
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
                          {!isResolved && (
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
                  );
                })}
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
