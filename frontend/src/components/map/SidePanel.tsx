import React from 'react';
import { X, ExternalLink, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SidePanelProps {
  atm: any;
  onClose: () => void;
}

const statusStyle: Record<string, { color: string; bg: string }> = {
  ONLINE:      { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  OFFLINE:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  DEGRADED:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  MAINTENANCE: { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)'},
};

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v >= 80 ? '#4ade80' : v >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium" style={{ color: 'var(--p-text-dim)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value != null ? value : '—'}</span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: '3px', background: 'var(--p-card-strong)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }}
        />
      </div>
    </div>
  );
}

export default function SidePanel({ atm, onClose }: SidePanelProps) {
  if (!atm) return null;

  const score = atm.healthScore ?? 0;
  const st = statusStyle[atm.status] ?? { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };
  const healthColor = score >= 80 ? '#4ade80' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="w-80 flex flex-col h-full z-20 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--p-card)',
        border: '1px solid var(--p-card-border)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--p-card-border)' }}
      >
        <div>
          <h3 className="text-sm font-bold text-white">{atm.name || `ATM #${atm.id}`}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
            {atm.location || 'Location not set'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--p-text-dim)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--p-card-strong)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={15} />
        </button>
      </div>

      {/* Health score */}
      <div
        className="px-5 py-4 flex items-center gap-5"
        style={{ borderBottom: '1px solid var(--p-card-border)' }}
      >
        {/* Circular gauge */}
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--p-card-strong)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={healthColor} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 201} 201`}
              style={{ filter: `drop-shadow(0 0 4px ${healthColor}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-bold" style={{ color: healthColor }}>{Math.round(score)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium" style={{ color: 'var(--p-text-dim)' }}>Status</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold mt-0.5 inline-block"
              style={{ color: st.color, background: st.bg }}
            >
              {atm.status || '—'}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-medium" style={{ color: 'var(--p-text-dim)' }}>Model</p>
            <p className="text-xs text-white mt-0.5">{atm.model || '—'}</p>
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid var(--p-card-border)' }}>
        <ScoreBar label="Network"     value={atm.networkScore}     />
        <ScoreBar label="Hardware"    value={atm.hardwareScore}    />
        <ScoreBar label="Uptime"      value={atm.softwareScore}    />
        <ScoreBar label="Transaction" value={atm.transactionScore} />
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
        {[
          { label: 'ATM ID',    value: atm.id           },
          { label: 'Address',   value: atm.address       },
          { label: 'Region',    value: atm.region        },
          { label: 'Serial No', value: atm.serialNumber  },
          { label: 'Last Seen', value: atm.lastSeen ? new Date(atm.lastSeen).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null },
        ].filter(r => r.value).map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--p-text-muted)' }}>
              {label}
            </p>
            <p className="text-xs text-white mt-0.5 break-all">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--p-card-border)' }}>
        <Link
          to={`/atm-detail/${atm.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--p-card-strong)',
            border: '1px solid var(--p-card-border)',
            color: 'var(--p-text)',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--p-card-hover)')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--p-card-strong)')}
        >
          <ExternalLink size={13} />
          View Full Detail
        </Link>
      </div>
    </div>
  );
}
