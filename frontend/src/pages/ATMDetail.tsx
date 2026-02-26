import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import {
  useGetATMQuery,
  useGetATMLogsQuery,
  useGetATMIncidentsQuery,
  useGetATMHealthHistoryQuery,
} from '../services/pulseApi';
import Badge from '../components/common/Badge';
import HealthGauge from '../components/charts/HealthGauge';
import TrendLine from '../components/charts/TrendLine';
import { formatDate, formatDateTime } from '../utils';

const TABS = ['Overview', 'Logs', 'Incidents', 'Health History'] as const;
type Tab = typeof TABS[number];

export default function ATMDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: atm,     isLoading: atmLoading,    error: atmError    } = useGetATMQuery(id);
  const { data: logs    = [], isLoading: logsLoading  } = useGetATMLogsQuery(id,    { skip: tab !== 'Logs'           });
  const { data: incs    = [], isLoading: incsLoading  } = useGetATMIncidentsQuery(id, { skip: tab !== 'Incidents'      });
  const { data: history = [], isLoading: histLoading  } = useGetATMHealthHistoryQuery(id, { skip: tab !== 'Health History' });

  const score = atm?.healthScore ?? 0;
  const healthTrend = history.map((h: any) => ({ timestamp: h.timestamp, value: h.healthScore ?? 0 }));

  return (
    <div className="p-8 space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link to="/atm-map" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ATM #{id}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Device detail &amp; history</p>
        </div>
      </div>

      {atmLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : atmError ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center space-y-2">
          <AlertCircle size={32} className="text-amber-400 mx-auto" />
          <p className="text-gray-500 text-sm">ATM model not yet implemented in the backend.</p>
        </div>
      ) : (
        <>
          {/* Overview strip */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-wrap items-center gap-8">
            <HealthGauge score={score} label="Overall Health" size={100} />
            <div className="flex-1 min-w-[200px]">
              <TrendLine data={healthTrend} label="Health trend" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Network',     value: atm?.networkScore     },
                { label: 'Hardware',    value: atm?.hardwareScore    },
                { label: 'Software',    value: atm?.softwareScore    },
                { label: 'Transaction', value: atm?.transactionScore },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-lg font-bold text-gray-900">{value != null ? `${value}%` : '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-100">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {tab === 'Overview' && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {atm ? Object.entries(atm).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{k}</p>
                    <p className="text-sm text-gray-900 mt-0.5 break-all">{String(v ?? '—')}</p>
                  </div>
                )) : <p className="text-gray-400 text-sm">No data.</p>}
              </div>
            )}

            {tab === 'Logs' && (
              logsLoading
                ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
                : <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Timestamp', 'Level', 'Event Code', 'Message'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.length === 0
                        ? <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">No logs.</td></tr>
                        : (logs as any[]).map((l: any, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(l.timestamp)}</td>
                              <td className="px-4 py-3"><Badge label={l.logLevel} variant="logLevel" /></td>
                              <td className="px-4 py-3 text-xs font-mono text-gray-500">{l.eventCode}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{l.message}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
            )}

            {tab === 'Incidents' && (
              incsLoading
                ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
                : <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['ID', 'Title', 'Severity', 'Status', 'Root Cause', 'Created'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {incs.length === 0
                        ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No incidents.</td></tr>
                        : (incs as any[]).map((inc: any) => (
                            <tr key={inc.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs font-mono text-gray-400">{inc.incidentId || inc.id}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{inc.title}</td>
                              <td className="px-4 py-3"><Badge label={inc.severity} variant="severity" /></td>
                              <td className="px-4 py-3"><Badge label={inc.status} variant="status" /></td>
                              <td className="px-4 py-3 text-xs text-gray-500">{inc.rootCauseCategory}</td>
                              <td className="px-4 py-3 text-xs text-gray-400">{formatDate(inc.createdAt)}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
            )}

            {tab === 'Health History' && (
              histLoading
                ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
                : <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Timestamp', 'Health', 'Status', 'Network', 'Hardware', 'Software', 'Transaction'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.length === 0
                        ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No history.</td></tr>
                        : (history as any[]).map((h: any, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(h.timestamp)}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{h.healthScore ?? '—'}</td>
                              <td className="px-4 py-3"><Badge label={h.status} variant="status" /></td>
                              <td className="px-4 py-3 text-xs text-gray-500">{h.networkScore ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{h.hardwareScore ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{h.softwareScore ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{h.transactionScore ?? '—'}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
