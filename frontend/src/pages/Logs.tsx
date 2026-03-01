import React, { useState, useMemo, useEffect } from 'react';
import { ScrollText, Search, Download, RefreshCw } from 'lucide-react';
import { useGetLogsQuery } from '../services/pulseApi';
import { useWebSocket } from '../hooks/useWebSocket';

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'CRITICAL'] as const;

const LEVEL_STYLE: Record<string, { color: string; bg: string }> = {
  INFO:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  WARN:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ERROR:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  CRITICAL: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
};

const ROW_BG: Record<string, string> = {
  ERROR:    'rgba(239,68,68,0.04)',
  CRITICAL: 'rgba(249,115,22,0.05)',
  WARN:     'rgba(245,158,11,0.03)',
};

function exportCSV(logs: any[]) {
  const header = ['Timestamp', 'Level', 'Source', 'Event Code', 'Message'];
  const rows = logs.map(l => [
    new Date(l.timestamp || l.created_at || l.createdAt).toLocaleString(),
    l.level,
    l.sourceId || l.source || '',
    l.eventCode || l.event_code || '',
    l.message || '',
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `logs_${Date.now()}.csv`;
  a.click();
}

export default function Logs() {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading, isFetching, refetch } = useGetLogsQuery(
    levelFilter !== 'ALL' ? { level: levelFilter } : undefined,
    { pollingInterval: 15_000 },
  );

  const sources = useMemo<string[]>(() => {
    const s = new Set<string>();
    (logs as any[]).forEach(l => { const src = l.sourceId || l.source; if (src) s.add(src); });
    return Array.from(s).sort();
  }, [logs]);

  const [sourceFilter, setSourceFilter] = useState('');

  const filtered = useMemo(() => {
    return (logs as any[]).filter(l => {
      if (sourceFilter && (l.sourceId || l.source) !== sourceFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (l.message || '').toLowerCase().includes(q) ||
        (l.eventCode || l.event_code || '').toLowerCase().includes(q) ||
        (l.sourceId || l.source || '').toLowerCase().includes(q)
      );
    });
  }, [logs, sourceFilter, search]);

  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const atmIntId = sourceFilter
    ? parseInt(sourceFilter.split('-').pop()!, 16)
    : 0;
  const wsUrl = atmIntId ? `ws://localhost:8000/ws/logs/${atmIntId}/` : '';
  const { status: wsStatus, lastMessage: wsMsg } = useWebSocket(wsUrl, { reconnect: !!wsUrl });

  useEffect(() => {
    if (!wsMsg) return;
    if (wsMsg.type === 'log_entry' || wsMsg.log_level) {
      setLiveLogs(prev => [wsMsg, ...prev].slice(0, 200));
    }
  }, [wsMsg]);

  useEffect(() => { setLiveLogs([]); }, [sourceFilter]);

  const displayLogs = useMemo(() => {
    if (!liveLogs.length) return filtered;
    const seen = new Set<string>();
    return [...liveLogs, ...filtered].filter(l => {
      const key = `${l.timestamp}:${l.eventCode ?? l.event_code}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [liveLogs, filtered]);

  return (
    <div className="p-8 space-y-5" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}
          >
            <ScrollText size={16} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Logs</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>
              {isLoading ? 'Loading…' : `${filtered.length} of ${(logs as any[]).length} entries`}
              {isFetching && !isLoading && (
                <span className="ml-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>refreshing…</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)', color: 'rgba(255,255,255,0.6)' }}
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'rgba(255,255,255,0.7)' }}
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level pills */}
        <div className="flex items-center gap-1.5">
          {LEVELS.map(lvl => {
            const active = levelFilter === lvl;
            const style = lvl === 'ALL' ? { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' } : LEVEL_STYLE[lvl];
            return (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={active
                  ? { background: style?.bg ?? 'rgba(255,255,255,0.12)', border: `1px solid ${style?.color ?? '#fff'}40`, color: style?.color ?? 'white' }
                  : { background: 'var(--p-card)', border: '1px solid var(--p-card-border)', color: 'rgba(255,255,255,0.4)' }
                }
              >
                {lvl}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Source dropdown */}
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium appearance-none"
          style={{
            background: 'var(--p-card)',
            border: sourceFilter ? '1px solid rgba(96,165,250,0.4)' : '1px solid var(--p-card-border)',
            color: sourceFilter ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            outline: 'none',
            minWidth: '130px',
          }}
        >
          <option value="" style={{ background: '#1a1a2e' }}>All sources</option>
          {sources.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
        </select>

        {wsUrl && (
          <span style={{ fontSize: 9, color: wsStatus === 'open' ? '#4ade80' : '#6b7280',
            background: wsStatus === 'open' ? 'rgba(74,222,128,0.1)' : 'rgba(107,114,128,0.1)',
            border: `1px solid ${wsStatus === 'open' ? 'rgba(74,222,128,0.3)' : 'rgba(107,114,128,0.2)'}`,
            borderRadius: 4, padding: '1px 5px' }}>
            {wsStatus === 'open' ? '● LIVE' : '○ connecting'}
          </span>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search message or event code…"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs"
            style={{
              background: 'var(--p-card-strong)',
              border: '1px solid var(--p-card-border)',
              color: 'var(--p-text)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
      >
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--p-card)' }} />
              ))}
            </div>
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText size={32} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No log entries match your filters.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                {['Timestamp', 'Level', 'Source', 'Event Code', 'Message'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.28)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayLogs.map((log: any, i: number) => {
                const lvl = log.level as string;
                const style = LEVEL_STYLE[lvl] ?? { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };
                const rowBg = ROW_BG[lvl] ?? 'transparent';
                const ts = log.timestamp || log.created_at || log.createdAt;
                return (
                  <tr
                    key={log.id ?? i}
                    style={{ borderBottom: '1px solid var(--p-card-border)', background: rowBg }}
                  >
                    <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {ts ? new Date(ts).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                        style={{ color: style.color, background: style.bg }}
                      >
                        {lvl}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {log.sourceId || log.source || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {log.eventCode || log.event_code || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-white max-w-[320px]">
                      <span className="truncate block">{log.message || '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
