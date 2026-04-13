import React, { useState, useMemo } from 'react';
import {
  useGetATMsQuery,
  useGetIncidentsQuery,
  useGetDashboardSummaryQuery,
} from '../services/payguardApi';
import { BentoCard } from '../components/BentoCard';
import {
  CheckCircle2, AlertTriangle, MapPin, Search,
  RefreshCw, ChevronDown, Clock, Wifi, WifiOff,
  CreditCard, Shield, Activity, HelpCircle,
} from 'lucide-react';

/* ── helpers ───────────────────────────────────────────────────────────── */
const HP_COLOR = (s: number) => s >= 80 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';
const HP_LABEL = (s: number) => s >= 80 ? 'Available' : s >= 50 ? 'Slow' : 'Unavailable';
const STATUS_ICON = (s: string) => s === 'ONLINE' ? Wifi : WifiOff;

function timeAgo(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* customer-friendly issue descriptions — no internal jargon */
const FRIENDLY_ISSUE: Record<string, string> = {
  NETWORK:  'Connectivity issue — transactions may time out.',
  CASH_JAM: 'Cash dispenser temporarily unavailable.',
  SWITCH:   'Payment processing disruption — card payments may fail.',
  SERVER:   'System maintenance in progress.',
  FRAUD:    'Security check in progress — service paused for your protection.',
  TIMEOUT:  'Slow response times — transactions may take longer.',
  HARDWARE: 'Machine under maintenance.',
  UNKNOWN:  'Temporary service disruption.',
};

const FRIENDLY_STATUS: Record<string, { label: string; color: string; msg: string }> = {
  OPEN:          { label: 'Reported',     color: '#60a5fa', msg: 'We\'re aware of this issue and looking into it.' },
  INVESTIGATING: { label: 'Being Fixed',  color: '#f97316', msg: 'Our team is actively working on a fix.' },
  ESCALATED:     { label: 'Being Fixed',  color: '#f97316', msg: 'Our senior team is handling this — should be resolved soon.' },
  RESOLVED:      { label: 'Fixed',        color: '#22c55e', msg: 'This issue has been resolved. Service is back to normal.' },
  AUTO_RESOLVED: { label: 'Auto-Fixed',   color: '#22c55e', msg: 'Our systems automatically fixed this. All clear!' },
};

/* ── Health bar ───────────────────────────────────────────────────────── */
function HealthBar({ score }: { score: number }) {
  const color = HP_COLOR(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{HP_LABEL(score)}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   VIEWER DASHBOARD — Customer-facing ATM status & issue tracker
═══════════════════════════════════════════════════════════════════════ */
export default function ViewerDashboard() {
  const { data: atms = [] } = useGetATMsQuery(undefined, { pollingInterval: 15000 });
  const { data: incidents = [] } = useGetIncidentsQuery(undefined, { pollingInterval: 15000 });
  const { data: summary } = useGetDashboardSummaryQuery(undefined, { pollingInterval: 15000 });

  const [atmSearch, setAtmSearch] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const now = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* ── Derived data ─────────────────────────────────────────────── */
  const onlineATMs = (atms as any[]).filter(a => a.status === 'ONLINE').length;
  const totalATMs = (atms as any[]).length;
  const platformHealth = Math.round(summary?.platformHealth ?? 100);
  const allGood = platformHealth >= 80 && onlineATMs === totalATMs;

  // Active issues (customer-visible: only OPEN/INVESTIGATING/ESCALATED, hide internal details)
  const activeIssues = useMemo(() =>
    [...(incidents as any[])]
      .filter(i => i.status !== 'RESOLVED' && i.status !== 'AUTO_RESOLVED')
      .sort((a: any, b: any) => {
        const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
      })
  , [incidents]);

  const recentlyFixed = useMemo(() =>
    [...(incidents as any[])]
      .filter(i => i.status === 'RESOLVED' || i.status === 'AUTO_RESOLVED')
      .sort((a: any, b: any) => new Date(b.resolvedAt || b.createdAt).getTime() - new Date(a.resolvedAt || a.createdAt).getTime())
      .slice(0, 5)
  , [incidents]);

  // ATM search for "Find a working ATM"
  const filteredATMs = useMemo(() => {
    let list = [...(atms as any[])].sort((a: any, b: any) => (b.healthScore ?? 0) - (a.healthScore ?? 0));
    if (atmSearch.trim()) {
      const q = atmSearch.toLowerCase();
      list = list.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q) ||
        (a.atmId || '').toLowerCase().includes(q)
      );
    }
    return showAll ? list : list.slice(0, 8);
  }, [atms, atmSearch, showAll]);

  return (
    <div className="p-5 space-y-5" style={{ minHeight: '100vh' }}>

      {/* ── Service status banner ────────────────────────────────── */}
      <div style={{
        borderRadius: 14, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16,
        background: allGood ? 'rgba(74,222,128,0.06)' : 'rgba(234,179,8,0.06)',
        border: `1px solid ${allGood ? 'rgba(74,222,128,0.2)' : 'rgba(234,179,8,0.2)'}`,
        animation: 'bentoEnter 0.5s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: allGood ? 'rgba(74,222,128,0.12)' : 'rgba(234,179,8,0.12)',
        }}>
          {allGood
            ? <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
            : <AlertTriangle size={20} style={{ color: '#eab308' }} />
          }
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--p-text)', margin: 0 }}>
            {allGood ? 'All Systems Operational' : 'Some Services Affected'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--p-text-muted)', margin: '4px 0 0' }}>
            {allGood
              ? 'All ATMs are working normally. Your transactions should go through without any issues.'
              : `${activeIssues.length} known issue${activeIssues.length !== 1 ? 's' : ''} being worked on. Most ATMs are still available.`
            }
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <RefreshCw size={10} className="animate-spin" style={{ color: '#22c55e', animationDuration: '3s' }} />
          <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600 }}>Live</span>
          <span style={{ fontSize: 9, color: 'var(--p-text-dim)', marginLeft: 4 }}>{now}</span>
        </div>
      </div>

      {/* ── Quick stats ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          {
            label: 'ATMs Available',
            value: `${onlineATMs} / ${totalATMs}`,
            color: onlineATMs === totalATMs ? '#22c55e' : '#eab308',
            icon: CreditCard,
            sub: onlineATMs === totalATMs ? 'All ATMs ready to use' : `${totalATMs - onlineATMs} temporarily unavailable`,
          },
          {
            label: 'Known Issues',
            value: String(activeIssues.length),
            color: activeIssues.length === 0 ? '#22c55e' : '#f97316',
            icon: HelpCircle,
            sub: activeIssues.length === 0 ? 'No issues right now' : 'Our team is on it',
          },
          {
            label: 'Recently Fixed',
            value: String(recentlyFixed.length),
            color: '#22c55e',
            icon: CheckCircle2,
            sub: 'Issues resolved recently',
          },
        ].map((m, i) => (
          <BentoCard key={m.label} delay={i * 60}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-dim)' }}>{m.label}</span>
                <m.icon size={13} style={{ color: m.color }} />
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: m.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{m.value}</p>
              <p style={{ fontSize: 10, color: 'var(--p-text-dim)', margin: '4px 0 0' }}>{m.sub}</p>
            </div>
          </BentoCard>
        ))}
      </div>

      {/* ── Two-column layout ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* LEFT: Known issues / your affected transactions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Active issues */}
          <BentoCard delay={200} noPad>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--p-card-border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text)' }}>Known Issues</span>
              {activeIssues.length > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)',
                }}>{activeIssues.length} active</span>
              )}
            </div>

            {activeIssues.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <CheckCircle2 size={28} style={{ color: '#22c55e', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--p-text)', margin: 0 }}>No issues right now</p>
                <p style={{ fontSize: 11, color: 'var(--p-text-muted)', margin: '6px 0 0' }}>
                  All ATMs are working normally. If you're having trouble with a transaction, try a different ATM nearby.
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {activeIssues.map((inc: any) => {
                  const sev = inc.severity;
                  const isCritical = sev === 'CRITICAL' || sev === 'HIGH';
                  const dotColor = isCritical ? '#ef4444' : '#eab308';
                  const info = FRIENDLY_STATUS[inc.status] || FRIENDLY_STATUS.OPEN;
                  const expanded = expandedIssue === inc.id;

                  return (
                    <div
                      key={inc.id}
                      onClick={() => setExpandedIssue(expanded ? null : inc.id)}
                      style={{
                        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--p-card-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {/* Severity indicator */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4,
                          boxShadow: `0 0 8px ${dotColor}`,
                          animation: isCritical ? 'pulse 2s infinite' : 'none',
                        }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* What's happening (customer-friendly) */}
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
                            {FRIENDLY_ISSUE[inc.rootCauseCategory] || FRIENDLY_ISSUE.UNKNOWN}
                          </p>

                          {/* ATM location */}
                          {(inc.atmName || inc.atmLocation) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <MapPin size={10} style={{ color: 'var(--p-text-muted)' }} />
                              <span style={{ fontSize: 10, color: 'var(--p-text-muted)' }}>
                                {inc.atmName}{inc.atmLocation ? ` — ${(inc.atmLocation || '').split(',')[0]}` : ''}
                              </span>
                            </div>
                          )}

                          {/* Status + time */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                              background: `${info.color}14`, color: info.color, border: `1px solid ${info.color}25`,
                            }}>
                              {info.label}
                            </span>
                            <span style={{ fontSize: 9, color: 'var(--p-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={8} /> {timeAgo(inc.createdAt)}
                            </span>
                          </div>
                        </div>

                        <ChevronDown size={12} style={{
                          color: 'var(--p-text-muted)', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4,
                          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                        }} />
                      </div>

                      {/* Expanded: reassurance message */}
                      {expanded && (
                        <div style={{
                          marginTop: 12, marginLeft: 20, padding: '12px 16px', borderRadius: 10,
                          background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Shield size={14} style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }} />
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', margin: 0 }}>
                                {info.msg}
                              </p>
                              <p style={{ fontSize: 11, color: 'var(--p-text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                                If your transaction was affected, don't worry — no money has been deducted.
                                Please try again at a nearby ATM, or wait for this issue to be resolved.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </BentoCard>

          {/* Recently fixed */}
          {recentlyFixed.length > 0 && (
            <BentoCard delay={260} noPad>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--p-card-border)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text)' }}>Recently Fixed</span>
              </div>
              <div>
                {recentlyFixed.map((inc: any) => (
                  <div key={inc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <CheckCircle2 size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--p-text)', margin: 0 }}>
                        {FRIENDLY_ISSUE[inc.rootCauseCategory] || 'Service restored'}
                      </p>
                      <p style={{ fontSize: 9, color: 'var(--p-text-muted)', margin: '2px 0 0' }}>
                        {inc.atmName ? `${inc.atmName} — ` : ''}{inc.status === 'AUTO_RESOLVED' ? 'Auto-fixed' : 'Fixed'} {timeAgo(inc.resolvedAt || inc.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          )}
        </div>

        {/* RIGHT: Find a working ATM */}
        <BentoCard delay={300} noPad style={{ alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--p-card-border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text)' }}>Find a Working ATM</span>
            <span style={{ fontSize: 9, color: 'var(--p-text-dim)' }}>{onlineATMs} available</span>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Search size={12} style={{ color: 'var(--p-text-muted)' }} />
              <input
                type="text" value={atmSearch} onChange={e => setAtmSearch(e.target.value)}
                placeholder="Search by ATM name or location..."
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--p-text)', fontSize: 12, width: '100%', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* ATM list */}
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {filteredATMs.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <MapPin size={20} style={{ color: 'var(--p-text-muted)', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: 12, color: 'var(--p-text-muted)' }}>No ATMs found matching your search.</p>
              </div>
            ) : (
              filteredATMs.map((atm: any) => {
                const score = atm.healthScore ?? 0;
                const color = HP_COLOR(score);
                const isOnline = atm.status === 'ONLINE';
                const SIcon = STATUS_ICON(atm.status);

                return (
                  <div
                    key={atm.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: isOnline ? 1 : 0.6,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--p-card-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Status icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isOnline ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${isOnline ? 'rgba(74,222,128,0.18)' : 'rgba(239,68,68,0.18)'}`,
                      flexShrink: 0,
                    }}>
                      <SIcon size={14} style={{ color: isOnline ? '#22c55e' : '#ef4444' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {atm.name}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--p-text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(atm.location || 'Unknown location')}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <HealthBar score={score} />
                      {!isOnline && (
                        <p style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, margin: '2px 0 0', textTransform: 'uppercase' }}>
                          {atm.status === 'DEGRADED' ? 'Slow service' : 'Out of service'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Show all toggle */}
          {!atmSearch && (atms as any[]).length > 8 && (
            <div
              onClick={() => setShowAll(!showAll)}
              style={{
                padding: '10px 20px', textAlign: 'center', cursor: 'pointer',
                borderTop: '1px solid var(--p-card-border)',
                fontSize: 11, fontWeight: 600, color: '#e8af48',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,151,70,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {showAll ? 'Show less' : `Show all ${(atms as any[]).length} ATMs`}
            </div>
          )}
        </BentoCard>
      </div>

      {/* ── Help footer ─────────────────────────────────────────── */}
      <BentoCard delay={400}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <HelpCircle size={18} style={{ color: '#e8af48', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>Having trouble with a transaction?</p>
            <p style={{ fontSize: 11, color: 'var(--p-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
              If your card was charged but cash wasn't dispensed, the amount will be automatically reversed within 24 hours.
              For urgent help, contact your bank's customer service or visit the nearest working ATM shown above.
            </p>
          </div>
        </div>
      </BentoCard>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
