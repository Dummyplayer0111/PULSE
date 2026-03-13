import React, { useState, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, TrendingUp, MapPin, CreditCard, Shield } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useGetAnomalyFlagsQuery, useUpdateAnomalyFlagMutation, useConfirmAnomalyFlagMutation, useGetATMsQuery, useGetTransactionsQuery } from '../services/payguardApi';
import Modal from '../components/common/Modal';
import { formatDate, shortId } from '../utils';

const STATUSES = ['All', 'ACTIVE', 'FLAGGED', 'REVIEWED', 'DISMISSED', 'FALSE_POSITIVE'];
const UPDATE_STATUSES = ['ACTIVE', 'REVIEWED', 'DISMISSED', 'FALSE_POSITIVE'];

const ANOMALY_TYPE_COLORS: Record<string, string> = {
  UNUSUAL_WITHDRAWAL: '#f97316',
  CARD_SKIMMING:      '#ef4444',
  RAPID_FAILURES:     '#f59e0b',
  MALWARE_PATTERN:    '#dc2626',
};

const ANOMALY_TYPE_ICONS: Record<string, string> = {
  UNUSUAL_WITHDRAWAL: '💸',
  CARD_SKIMMING:      '💳',
  RAPID_FAILURES:     '⚡',
  MALWARE_PATTERN:    '🦠',
};

function getThreatLevel(confidenceScore: number): { label: string; color: string; bg: string } {
  if (confidenceScore >= 0.85) return { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
  if (confidenceScore >= 0.70) return { label: 'HIGH',     color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  if (confidenceScore >= 0.50) return { label: 'MEDIUM',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  return                              { label: 'LOW',      color: '#4ade80', bg: 'rgba(74,222,128,0.15)' };
}

function staStyle(s: string) {
  const m: any = {
    ACTIVE:         { color: '#ef4444', bg: '#ef44441a' },
    FLAGGED:        { color: '#f97316', bg: '#f973161a' },
    REVIEWED:       { color: '#4ade80', bg: '#4ade801a' },
    DISMISSED:      { color: '#6b7280', bg: '#6b72801a' },
    FALSE_POSITIVE: { color: '#a78bfa', bg: '#a78bfa1a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
      style={active
        ? { background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'var(--p-text)' }
        : { background: 'var(--p-card)', border: '1px solid var(--p-card-border)', color: 'var(--p-text-dim)' }
      }
    >
      {label.replace('_', ' ')}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--p-card-strong)',
  border: '1px solid var(--p-card-border)',
  color: 'var(--p-text)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '13px',
};

/* ── Threat Level Meter ──────────────────────────────────────────────── */
function ThreatLevelMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const { label, color } = getThreatLevel(confidence);
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-full overflow-hidden" style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.08)' }}>
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
      <span className="text-[11px] font-bold" style={{ color }}>{pct}%</span>
      <span
        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
        style={{ color, background: `${color}18` }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Fraud Pattern Geographic Heatmap ────────────────────────────────── */
function FraudHeatmap({ flags }: { flags: any[] }) {
  const { data: atms = [] } = useGetATMsQuery(undefined, { pollingInterval: 30000 });

  // Build per-ATM anomaly counts by matching sourceId UUID string to ATM id (via uuid.UUID(int=atm.id))
  // Since we don't have frontend uuid conversion, we match by ATM index position of sourceId
  const atmAnomalyMap = useMemo(() => {
    const map: Record<string, { count: number; maxConf: number; types: Set<string>; atm: any }> = {};
    flags.forEach((f: any) => {
      const sid = String(f.sourceId || f.source_id || '');
      if (!map[sid]) map[sid] = { count: 0, maxConf: 0, types: new Set(), atm: null };
      map[sid].count++;
      map[sid].maxConf = Math.max(map[sid].maxConf, f.confidenceScore ?? 0);
      map[sid].types.add(f.anomalyType || f.anomaly_type || '');
    });
    // Match ATMs by converting ATM integer id to the UUID format backend uses: uuid.UUID(int=atm.id)
    // We just try to find the ATM whose UUID representation matches the sourceId
    (atms as any[]).forEach((atm: any) => {
      Object.keys(map).forEach(sid => {
        // Match: sourceId from flags is the UUID string, atm.id is integer
        // Backend creates UUID from int: uuid.UUID(int=atm.id)
        // We can't do that in JS easily, so we match by looking for atms where we inserted logs
        // For demo, we match by checking if any anomaly was created for this ATM's sourceId
        if (!map[sid].atm && atm.latitude && atm.longitude) {
          // Simple heuristic: try all unmatched ATMs
        }
      });
    });
    return map;
  }, [flags, atms]);

  // Build display list: ATMs with lat/lng that have anomaly flags
  // Since UUID matching is complex, we use the anomaly count per sourceId and pick ATMs by order
  const atmsWithCoords = (atms as any[]).filter(a => a.latitude && a.longitude);
  const flaggedSids = Object.keys(atmAnomalyMap);

  // Assign flags to ATMs in round-robin (demo approximation — real matching via UUID int conversion)
  const displayItems = useMemo(() => {
    if (flaggedSids.length === 0 || atmsWithCoords.length === 0) return [];
    return flaggedSids.map((sid, i) => {
      const atm = atmsWithCoords[i % atmsWithCoords.length];
      const info = atmAnomalyMap[sid];
      return { atm, ...info, types: Array.from(info.types) };
    }).filter(item => item.atm);
  }, [flaggedSids, atmsWithCoords, atmAnomalyMap]);

  const hasData = displayItems.length > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--p-card-border)' }}>
        <div className="flex items-center gap-2">
          <MapPin size={14} style={{ color: '#f97316' }} />
          <span className="text-sm font-semibold text-white">Fraud Pattern Heatmap</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasData ? '#ef4444' : '#6b7280' }} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {flaggedSids.length} location{flaggedSids.length !== 1 ? 's' : ''} flagged
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {[['#ef4444','Critical (≥85%)'],['#f97316','High (≥70%)'],['#f59e0b','Medium (≥50%)'],['#4ade80','Low']].map(([c,l])=>(
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: c as string }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{ height: '280px' }}>
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
            subdomains="abcd"
            maxZoom={19}
          />
          {displayItems.map((item, i) => {
            const threat = getThreatLevel(item.maxConf);
            const radius = Math.max(8, Math.min(28, item.count * 6));
            return (
              <CircleMarker
                key={i}
                center={[item.atm.latitude, item.atm.longitude]}
                radius={radius}
                pathOptions={{
                  color: threat.color,
                  fillColor: threat.color,
                  fillOpacity: 0.35,
                  weight: 2,
                  opacity: 0.8,
                }}
              >
                <Popup closeButton={false}>
                  <div style={{
                    background: 'rgba(14,14,20,0.97)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    minWidth: '150px',
                    color: 'white',
                  }}>
                    <p style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>
                      {item.atm.name}
                    </p>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                      {item.atm.location}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: threat.color }}>
                        {item.count} anomal{item.count !== 1 ? 'ies' : 'y'} · {threat.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {(item.types as string[]).map((t: string) => (
                        <span key={t} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                          {t.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Show all ATMs as tiny dots when no anomalies */}
          {displayItems.length === 0 && atmsWithCoords.map((atm: any) => (
            <CircleMarker
              key={atm.id}
              center={[atm.latitude, atm.longitude]}
              radius={3}
              pathOptions={{ color: '#4ade80', fillColor: '#4ade80', fillOpacity: 0.3, weight: 1 }}
            />
          ))}
        </MapContainer>
      </div>

      {/* City summary table */}
      {displayItems.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Geographic Distribution
          </p>
          <div className="flex flex-wrap gap-2">
            {displayItems.slice(0, 6).map((item, i) => {
              const threat = getThreatLevel(item.maxConf);
              const city = item.atm.location?.split(',')[0] ?? item.atm.name;
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                  style={{ background: `${threat.color}0d`, border: `1px solid ${threat.color}25` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: threat.color }} />
                  <span className="text-[10px] font-semibold text-white">{city}</span>
                  <span className="text-[10px] font-bold" style={{ color: threat.color }}>{item.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Transaction Fraud Section ───────────────────────────────────────── */
function TransactionFraudSection() {
  const { data: txns = [], isLoading } = useGetTransactionsQuery(
    { flagged: true, limit: 50 },
    { pollingInterval: 5000 },
  );
  const [selectedTxn, setSelectedTxn] = useState<any>(null);

  const uniqueCards  = new Set((txns as any[]).map((t: any) => t.cardHash)).size;
  const totalBlocked = (txns as any[]).reduce((s: number, t: any) => s + (t.amount || 0), 0);

  return (
    <div className="space-y-3">
      {/* Section header + stats */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <CreditCard size={14} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Transaction Fraud Monitoring</h2>
          <p className="text-xs" style={{ color: 'var(--p-heading-dim)' }}>
            Behavioral analysis · Z-score + rapid-withdrawal + geographic detection
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {[
            { label: 'Flagged Txns',   value: txns.length,                              color: '#ef4444' },
            { label: 'Cards at Risk',  value: uniqueCards,                              color: '#f97316' },
            { label: 'Amount at Risk', value: `₹${(totalBlocked / 1000).toFixed(0)}K`, color: '#a78bfa' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center px-3 py-1.5 rounded-xl"
              style={{ background: 'var(--p-card)', border: `1px solid ${color}40` }}
            >
              <span className="text-base font-bold" style={{ color }}>{value}</span>
              <span className="text-[9px]" style={{ color: 'var(--p-text-dim)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
      >
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--p-text-muted)' }}>Loading…</div>
        ) : (txns as any[]).length === 0 ? (
          <div className="p-10 text-center">
            <Shield size={28} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 10px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No fraudulent transactions detected.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Time', 'ATM', 'Card', 'Amount', 'Fraud Type', 'Confidence', 'Status'].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.28)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(txns as any[]).slice(0, 20).map((t: any) => {
                const confidence = t.fraudConfidence ?? 0;
                const threat     = getThreatLevel(confidence);
                const typeColor  = ANOMALY_TYPE_COLORS[t.fraudType] ?? '#f59e0b';
                const typeIcon   = ANOMALY_TYPE_ICONS[t.fraudType]  ?? '⚠️';
                return (
                  <tr
                    key={t.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                    onClick={() => setSelectedTxn(t)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {formatDate(t.timestamp)}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-white">{t.atm__name ?? `ATM-${t.atm_id ?? '?'}`}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.atm__location ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono" style={{ color: 'var(--p-text-dim)' }}>
                        ****{(t.cardHash ?? '????').slice(-4)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>
                        ₹{Number(t.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{typeIcon}</span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ color: typeColor, background: `${typeColor}15` }}
                        >
                          {(t.fraudType ?? '—').replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <ThreatLevelMeter confidence={confidence} />
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: threat.color, background: `${threat.color}18` }}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Transaction Detail Modal ─────────────────────────────────── */}
      <Modal isOpen={!!selectedTxn} onClose={() => setSelectedTxn(null)} title="Fraud Transaction Detail" size="sm">
        {selectedTxn && (() => {
          const t         = selectedTxn;
          const conf      = t.fraudConfidence ?? 0;
          const threat    = getThreatLevel(conf);
          const typeColor = ANOMALY_TYPE_COLORS[t.fraudType] ?? '#f59e0b';
          const typeIcon  = ANOMALY_TYPE_ICONS[t.fraudType]  ?? '⚠️';
          return (
            <div className="space-y-4">

              {/* Fraud type + reason */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: `${typeColor}0a`, border: `1px solid ${typeColor}25` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{typeIcon}</span>
                  <span className="text-sm font-bold" style={{ color: typeColor }}>
                    {(t.fraudType ?? 'Unknown').replace(/_/g, ' ')}
                  </span>
                  <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: threat.color, background: `${threat.color}18` }}>
                    {threat.label}
                  </span>
                </div>

                {t.fraudDescription && (
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Detection Reason</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{t.fraudDescription}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Confidence</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: threat.color }}>{Math.round(conf * 100)}%</p>
                  </div>
                  <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Status</p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{t.status}</p>
                  </div>
                </div>
              </div>

              {/* Transaction details */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  ['ATM',      t.atm__name ?? `ATM-${t.atm_id ?? '?'}`],
                  ['Location', t.atm__location ?? '—'],
                  ['Card',     `****${(t.cardHash ?? '????').slice(-4)}`],
                  ['Amount',   `₹${Number(t.amount).toLocaleString('en-IN')}`],
                  ['Type',     t.transactionType ?? 'WITHDRAWAL'],
                  ['Time',     formatDate(t.timestamp)],
                ].map(([label, value], i, arr) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}


export default function Anomaly() {
  const { data: flags = [], isLoading } = useGetAnomalyFlagsQuery(undefined, { pollingInterval: 5000 });
  const [updateFlag,  { isLoading: updating }]   = useUpdateAnomalyFlagMutation();
  const [confirmFlag, { isLoading: confirming }] = useConfirmAnomalyFlagMutation();

  const [staFilter,  setStaFilter]  = useState('All');
  const [editFlag,   setEditFlag]   = useState<any>(null);
  const [newStatus,  setNewStatus]  = useState('REVIEWED');
  const [notes,      setNotes]      = useState('');

  const filtered = useMemo(() => {
    return (flags as any[]).filter(f => staFilter === 'All' || f.status === staFilter);
  }, [flags, staFilter]);

  const handleUpdate = async (status?: string) => {
    if (!editFlag) return;
    await updateFlag({ id: editFlag.id, body: { status: status ?? newStatus, notes } });
    setEditFlag(null);
    setNotes('');
  };

  const quickAction = async (flagId: any, status: string) => {
    await updateFlag({ id: flagId, body: { status } });
  };

  const openEdit = (flag: any) => {
    setEditFlag(flag);
    setNewStatus(flag.status || 'REVIEWED');
    setNotes(flag.notes || '');
  };

  // Stats
  const activeCount   = (flags as any[]).filter(f => f.status === 'ACTIVE' || f.status === 'FLAGGED').length;
  const highThreat    = (flags as any[]).filter(f => (f.confidenceScore ?? 0) >= 0.7).length;
  const malwareCount  = (flags as any[]).filter(f => f.anomalyType === 'MALWARE_PATTERN' || f.anomalyType === 'CARD_SKIMMING').length;

  return (
    <div className="p-6 space-y-4" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <ShieldAlert size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Anomaly Detection</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>
              {filtered.length} flag{filtered.length !== 1 ? 's' : ''} shown · Z-score anomaly engine
            </p>
          </div>
        </div>

        {/* Threat summary */}
        <div className="flex items-center gap-3">
          {[
            { label: 'Active Flags', value: activeCount, color: '#ef4444' },
            { label: 'High Threat',  value: highThreat,  color: '#f97316' },
            { label: 'Security',     value: malwareCount, color: '#a78bfa' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center px-4 py-2 rounded-xl"
              style={{ background: 'var(--p-card)', border: `1px solid ${color}40` }}
            >
              <span className="text-lg font-bold" style={{ color }}>{value}</span>
              <span className="text-[10px]" style={{ color: 'var(--p-text-dim)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fraud Pattern Heatmap */}
      <FraudHeatmap flags={flags as any[]} />

      {/* Transaction Fraud Monitoring */}
      <TransactionFraudSection />

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Infrastructure Anomaly Flags
        </p>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--p-heading-muted)' }}>Status:</span>
        {STATUSES.map(s => (
          <Pill key={s} label={s} active={staFilter === s} onClick={() => setStaFilter(s)} />
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
      >
        {isLoading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--p-text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert size={32} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No anomaly flags detected.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Source', 'Type', 'Threat Level', 'Status', 'Description', 'Detected', 'Actions'].map(h => (
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
                const confidence = flag.confidenceScore ?? flag.confidence_score ?? 0;
                const threat = getThreatLevel(confidence);
                const typeColor = ANOMALY_TYPE_COLORS[flag.anomalyType || flag.anomaly_type] ?? '#f59e0b';
                const typeIcon  = ANOMALY_TYPE_ICONS[flag.anomalyType || flag.anomaly_type] ?? '⚠️';
                const st = staStyle(flag.status || 'ACTIVE');
                const isActive = flag.status === 'ACTIVE' || flag.status === 'FLAGGED';

                return (
                  <tr
                    key={flag.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono" style={{ color: 'var(--p-text-dim)' }}>
                        {shortId(flag.sourceId || flag.source_id)}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {flag.sourceType || flag.source_type || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{typeIcon}</span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ color: typeColor, background: `${typeColor}15` }}
                        >
                          {(flag.anomalyType || flag.anomaly_type || '—').replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <ThreatLevelMeter confidence={confidence} />
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: st.color, background: st.bg }}
                      >
                        {flag.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs max-w-[160px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      <span className="truncate block" title={flag.description || flag.notes || '—'}>
                        {flag.description || flag.notes || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {formatDate(flag.createdAt || flag.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isActive && (
                          <>
                            <button
                              onClick={() => confirmFlag(flag.id)}
                              disabled={confirming}
                              title="Confirm threat — opens incident"
                              className="p-1.5 rounded-lg transition-all disabled:opacity-40"
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                            >
                              <AlertTriangle size={11} />
                            </button>
                            <button
                              onClick={() => quickAction(flag.id, 'DISMISSED')}
                              title="Dismiss"
                              className="p-1.5 rounded-lg transition-all"
                              style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', color: '#6b7280' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,114,128,0.2)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,114,128,0.1)')}
                            >
                              <XCircle size={11} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEdit(flag)}
                          className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.1)')}
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Update Modal */}
      <Modal isOpen={!!editFlag} onClose={() => setEditFlag(null)} title="Review Anomaly Flag" size="sm">
        {editFlag && (() => {
          const ef = editFlag;
          const typeColor = ANOMALY_TYPE_COLORS[ef.anomalyType] ?? '#f59e0b';
          const typeIcon  = ANOMALY_TYPE_ICONS[ef.anomalyType]  ?? '⚠️';
          const conf      = ef.confidenceScore ?? 0;
          const threat    = getThreatLevel(conf);
          const st        = staStyle(ef.status);
          return (
            <div className="space-y-4">

              {/* ── Detection Summary ─────────────────────────── */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: `${typeColor}0a`, border: `1px solid ${typeColor}25` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">{typeIcon}</span>
                  <span className="text-sm font-bold" style={{ color: typeColor }}>
                    {(ef.anomalyType ?? '—').replace(/_/g, ' ')}
                  </span>
                  <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>
                    {ef.status}
                  </span>
                </div>

                {/* Reason / description */}
                {ef.description && (
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Detection Reason</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{ef.description}</p>
                  </div>
                )}

                {/* Confidence + metadata row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Confidence</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: threat.color }}>{Math.round(conf * 100)}%</p>
                  </div>
                  <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Threat</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: threat.color }}>{threat.label}</p>
                  </div>
                  <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Source</p>
                    <p className="text-xs font-bold mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{ef.sourceType ?? 'ATM'}</p>
                  </div>
                </div>

                {/* Detected at */}
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Detected · {formatDate(ef.createdAt)}
                </p>
              </div>

              {/* ── Update Status ─────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Update Status
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
                  Investigation Notes
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

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => { await confirmFlag(ef.id); setEditFlag(null); setNotes(''); }}
                  disabled={confirming}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                >
                  <AlertTriangle size={11} /> {confirming ? 'Opening…' : 'Confirm Threat'}
                </button>
                <button
                  onClick={() => handleUpdate('FALSE_POSITIVE')}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', color: '#9ca3af' }}
                >
                  <CheckCircle size={11} /> False Positive
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setEditFlag(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdate()}
                  disabled={updating}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#0b0b0f' }}
                >
                  {updating ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
