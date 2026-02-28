import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Activity } from 'lucide-react';
import {
  useGetATMQuery,
  useGetATMLogsQuery,
  useGetATMIncidentsQuery,
  useGetATMHealthHistoryQuery,
} from '../services/pulseApi';
import { formatDate, formatDateTime } from '../utils';

const TABS = ['Overview', 'Logs', 'Incidents', 'Health History'] as const;
type Tab = typeof TABS[number];

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
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

function logStyle(level: string) {
  const m: any = {
    CRITICAL: { color: '#ef4444', bg: '#ef44441a' },
    ERROR:    { color: '#f97316', bg: '#f973161a' },
    WARN:     { color: '#f59e0b', bg: '#f59e0b1a' },
    INFO:     { color: '#9ca3af', bg: '#9ca3af1a' },
  };
  return m[level] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>
    {children}
  </th>
);

export default function ATMDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: atm,     isLoading: atmLoading,    error: atmError    } = useGetATMQuery(id);
  const { data: logs    = [], isLoading: logsLoading  } = useGetATMLogsQuery(id,     { skip: tab !== 'Logs' });
  const { data: incs    = [], isLoading: incsLoading  } = useGetATMIncidentsQuery(id, { skip: tab !== 'Incidents' });
  const { data: history = [], isLoading: histLoading  } = useGetATMHealthHistoryQuery(id, { skip: tab !== 'Health History' });

  return (
    <div className="p-8 space-y-6" style={{ minHeight: '100vh' }}>
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          to="/atm-map"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'white')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)')}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">ATM #{id}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Device detail &amp; history</p>
        </div>
      </div>

      {atmLoading ? (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
        >
          Loading…
        </div>
      ) : atmError ? (
        <div
          className="rounded-2xl p-12 text-center space-y-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <AlertCircle size={36} style={{ color: '#f59e0b', margin: '0 auto' }} />
          <p className="text-sm font-semibold text-white">ATM model not yet implemented</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Create the <code className="font-mono" style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 4 }}>ATM</code> model in backend to activate this page.
          </p>
        </div>
      ) : (
        <>
          {/* Overview strip */}
          <div
            className="rounded-2xl p-6 flex flex-wrap items-center gap-8"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Health score ring */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(#4ade80 ${(atm?.healthScore ?? 0) * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: '#0b0b0f' }}
                >
                  <span className="text-base font-bold text-white">{atm?.healthScore ?? '—'}</span>
                </div>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Health Score</span>
            </div>

            {/* Score grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Network',     value: atm?.networkScore     },
                { label: 'Hardware',    value: atm?.hardwareScore    },
                { label: 'Software',    value: atm?.softwareScore    },
                { label: 'Transaction', value: atm?.transactionScore },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {value != null ? `${value}` : '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* ATM meta */}
            <div className="flex-1 min-w-[200px]">
              {atm && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {['location', 'status', 'model', 'serialNumber'].map(k => (
                    (atm as any)[k] != null && (
                      <div key={k}>
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{k}</p>
                        <p className="text-sm text-white mt-0.5">{String((atm as any)[k])}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-5 py-2.5 text-sm font-medium transition-all"
                style={{
                  color: tab === t ? 'white' : 'rgba(255,255,255,0.4)',
                  borderBottom: tab === t ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >

            {tab === 'Overview' && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {atm ? Object.entries(atm).map(([k, v]) => (
                  <div key={k} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{k}</p>
                    <p className="text-sm text-white mt-1 break-all">{String(v ?? '—')}</p>
                  </div>
                )) : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No data.</p>}
              </div>
            )}

            {tab === 'Logs' && (
              logsLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <TH>Timestamp</TH><TH>Level</TH><TH>Event Code</TH><TH>Message</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs as any[]).length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No logs.</td></tr>
                    ) : (logs as any[]).map((l: any, i) => {
                      const ls = logStyle(l.logLevel || l.log_level);
                      return (
                        <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {formatDateTime(l.timestamp)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: ls.color, background: ls.bg }}>
                              {l.logLevel || l.log_level || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {l.eventCode || l.event_code || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-white max-w-xs truncate">{l.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {tab === 'Incidents' && (
              incsLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <TH>ID</TH><TH>Title</TH><TH>Severity</TH><TH>Status</TH><TH>Root Cause</TH><TH>Created</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {(incs as any[]).length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No incidents.</td></tr>
                    ) : (incs as any[]).map((inc: any) => {
                      const sv = sevStyle(inc.severity); const st = staStyle(inc.status);
                      return (
                        <tr key={inc.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{inc.incidentId || inc.id}</td>
                          <td className="px-5 py-3.5 text-sm text-white max-w-[160px] truncate">{inc.title}</td>
                          <td className="px-5 py-3.5"><span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: sv.color, background: sv.bg }}>{inc.severity}</span></td>
                          <td className="px-5 py-3.5"><span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>{inc.status}</span></td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{inc.rootCauseCategory || '—'}</td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDate(inc.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {tab === 'Health History' && (
              histLoading ? (
                <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <TH>Timestamp</TH><TH>Health</TH><TH>Network</TH><TH>Hardware</TH><TH>Software</TH><TH>Transaction</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {(history as any[]).length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No history.</td></tr>
                    ) : (history as any[]).map((h: any, i) => (
                      <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                      >
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDateTime(h.timestamp)}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-white">{h.healthScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.networkScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.hardwareScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.softwareScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{h.transactionScore ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
