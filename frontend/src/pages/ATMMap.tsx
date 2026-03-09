import React, { useMemo, useState } from 'react';
import { AlertCircle, Map, Wifi, WifiOff, Loader, Filter, ChevronDown } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetATMsQuery } from '../services/payguardApi';
import { selectATM, closeSidePanel } from '../store/uiSlice';
import { RootState } from '../store';
import ATMMapComponent from '../components/map/ATMMap';
import SidePanel from '../components/map/SidePanel';
import { useATMSocket } from '../hooks/useATMSocket';

const STATUS_COLOR: Record<string, string> = {
  ONLINE:      '#4ade80',
  OFFLINE:     '#ef4444',
  DEGRADED:    '#f59e0b',
  MAINTENANCE: '#6b7280',
};

const ALL_STATUSES = ['ALL', 'ONLINE', 'DEGRADED', 'OFFLINE', 'MAINTENANCE'];

export default function ATMMapPage() {
  const dispatch = useDispatch();
  const { selectedATMId, isSidePanelOpen } = useSelector((s: RootState) => s.ui);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cityFilter,   setCityFilter]   = useState<string>('');
  const [healthMin,    setHealthMin]    = useState<number>(0);
  const [healthMax,    setHealthMax]    = useState<number>(100);
  const [filtersOpen,  setFiltersOpen]  = useState<boolean>(false);

  const { data: apiATMs = [], isLoading, error } = useGetATMsQuery(undefined, { pollingInterval: 30_000 });
  const { status: wsStatus, liveATMs } = useATMSocket();

  const atms = useMemo(() => {
    if (liveATMs.length === 0) return apiATMs;
    return apiATMs
      .map((a: any) => { const live = liveATMs.find((l: any) => l.id === a.id); return live ?? a; })
      .concat(liveATMs.filter((l: any) => !apiATMs.find((a: any) => a.id === l.id)));
  }, [apiATMs, liveATMs]);

  const cities = useMemo<string[]>(() => {
    const s = new Set<string>();
    atms.forEach((a: any) => { const c = (a.location ?? '').split(',')[0].trim(); if (c) s.add(c); });
    return Array.from(s).sort();
  }, [atms]);

  const filteredAtms = useMemo(() => atms.filter((a: any) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (cityFilter && (a.location ?? '').split(',')[0].trim() !== cityFilter) return false;
    const score = Math.round(a.healthScore ?? 100);
    return score >= healthMin && score <= healthMax;
  }), [atms, statusFilter, cityFilter, healthMin, healthMax]);

  const isFiltered = statusFilter !== 'ALL' || cityFilter !== '' || healthMin !== 0 || healthMax !== 100;

  const selectedATM =
    filteredAtms.find((a: any) => a.id === selectedATMId) ??
    atms.find((a: any) => a.id === selectedATMId) ??
    null;

  const onlineCount      = atms.filter((a: any) => a.status === 'ONLINE').length;
  const offlineCount     = atms.filter((a: any) => a.status === 'OFFLINE').length;
  const degradedCount    = atms.filter((a: any) => a.status === 'DEGRADED').length;
  const maintenanceCount = atms.filter((a: any) => a.status === 'MAINTENANCE').length;

  // When side panel is open, chips strip shrinks to not overlap it
  const panelW = 320;
  const chipsRight = isSidePanelOpen && selectedATM ? panelW + 20 : 12;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--p-page)' }}>

      {/* ── Compact top bar ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: 'var(--p-card)',
        borderBottom: '1px solid var(--p-card-border)',
      }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)',
          }}>
            <Map size={14} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--p-text)', lineHeight: 1, margin: 0 }}>ATM Network</p>
            <p style={{ fontSize: 10, color: 'var(--p-text-dim)', marginTop: 3, marginBottom: 0 }}>
              {isLoading
                ? 'Loading…'
                : isFiltered
                  ? `${filteredAtms.length} / ${atms.length} terminals`
                  : `${atms.length} terminals · India`}
            </p>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--p-card-border)' }} />

        {/* Status counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {[
            { label: 'Online',  count: onlineCount,      color: '#4ade80' },
            { label: 'Degraded', count: degradedCount,   color: '#f59e0b' },
            { label: 'Maint.',   count: maintenanceCount, color: '#6b7280' },
            { label: 'Offline',  count: offlineCount,     color: '#ef4444' },
          ].filter(s => s.count > 0).map(({ label, count, color }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8,
              background: 'var(--p-card)', border: '1px solid var(--p-card-border)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{count}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* WS indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '4px 10px', borderRadius: 8,
          background: 'var(--p-card)', border: '1px solid var(--p-card-border)',
        }}>
          {wsStatus === 'connected'  ? <><Wifi     size={11} style={{ color: '#4ade80' }} /><span style={{ fontSize: 10, fontWeight: 500, color: '#4ade80' }}>Live</span></> :
           wsStatus === 'connecting' ? <><Loader   size={11} className="animate-spin" style={{ color: '#f59e0b' }} /><span style={{ fontSize: 10, fontWeight: 500, color: '#f59e0b' }}>Connecting</span></> :
                                       <><WifiOff  size={11} style={{ color: '#ef4444' }} /><span style={{ fontSize: 10, fontWeight: 500, color: '#ef4444' }}>Offline</span></>}
        </div>

        {/* Filters button */}
        <button
          onClick={() => setFiltersOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            background: isFiltered ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
            border: isFiltered ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
            color: isFiltered ? '#60a5fa' : 'rgba(255,255,255,0.5)',
          }}
        >
          <Filter size={11} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>Filters{isFiltered ? ' ●' : ''}</span>
          <ChevronDown size={10} style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* ── Collapsible filter bar ── */}
      {filtersOpen && (
        <div style={{
          flexShrink: 0,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
          padding: '8px 20px',
          background: 'var(--p-card)',
          borderBottom: '1px solid var(--p-card-border)',
        }}>
          {/* Status pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Status</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {ALL_STATUSES.map(s => {
                const active = statusFilter === s;
                const color  = s === 'ALL' ? '#60a5fa' : STATUS_COLOR[s] ?? '#6b7280';
                return (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{
                    padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                    border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.07)',
                    color: active ? color : 'rgba(255,255,255,0.45)',
                  }}>
                    {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--p-card-border)' }} />

          {/* City */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-text-muted)' }}>City</span>
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)',
              border: cityFilter ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: cityFilter ? '#60a5fa' : 'rgba(255,255,255,0.55)',
              outline: 'none', minWidth: 110,
            }}>
              <option value="" style={{ background: '#1a1a2e' }}>All cities</option>
              {cities.map(c => <option key={c} value={c} style={{ background: '#1a1a2e' }}>{c}</option>)}
            </select>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--p-card-border)' }} />

          {/* Health range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Health</span>
            <input type="number" min={0} max={healthMax} value={healthMin}
              onChange={e => setHealthMin(Math.max(0, Math.min(Number(e.target.value), healthMax)))}
              style={{ width: 48, padding: '3px 6px', borderRadius: 6, fontSize: 11, textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', outline: 'none' }}
            />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>–</span>
            <input type="number" min={healthMin} max={100} value={healthMax}
              onChange={e => setHealthMax(Math.min(100, Math.max(Number(e.target.value), healthMin)))}
              style={{ width: 48, padding: '3px 6px', borderRadius: 6, fontSize: 11, textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', outline: 'none' }}
            />
          </div>

          {isFiltered && (
            <button
              onClick={() => { setStatusFilter('ALL'); setCityFilter(''); setHealthMin(0); setHealthMax(100); }}
              style={{
                marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                fontSize: 10, fontWeight: 600,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171',
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Map fills remaining height — UI overlays float inside ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>

        {/* Leaflet map (or loading/error state) */}
        {isLoading ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ textAlign: 'center' }}>
              <Loader size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.3)', display: 'block', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Loading ATM network…</p>
            </div>
          </div>
        ) : error ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <AlertCircle size={32} style={{ color: '#f59e0b' }} />
            <p style={{ fontSize: 13, color: 'var(--p-heading)', margin: 0 }}>ATM backend unavailable</p>
          </div>
        ) : (
          <ATMMapComponent
            atms={filteredAtms}
            selectedId={selectedATMId}
            onATMClick={(atm) => dispatch(selectATM(atm.id === selectedATMId ? null : atm.id))}
          />
        )}

        {/* ATM chips strip — absolute bottom, right edge pulls back when panel is open */}
        {!isLoading && !error && filteredAtms.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 12, left: 12, right: chipsRight,
            zIndex: 1000,
            borderRadius: 14,
            background: 'var(--p-card)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--p-card-border)',
            padding: '8px 10px',
            overflowX: 'auto',
            transition: 'right 0.25s ease',
          }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
              {filteredAtms.map((atm: any) => {
                const color = STATUS_COLOR[atm.status] ?? '#6b7280';
                const isSelected = atm.id === selectedATMId;
                return (
                  <button
                    key={atm.id}
                    onClick={() => dispatch(selectATM(atm.id === selectedATMId ? null : atm.id))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '5px 10px', borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                      border: isSelected ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.08)',
                      minWidth: 130, textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'block',
                      background: color, boxShadow: isSelected ? `0 0 6px ${color}` : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {atm.name}
                      </p>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {atm.location?.split(',')[0]}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>
                      {Math.round(atm.healthScore)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SidePanel — absolute right overlay, never leaves the map container */}
        {isSidePanelOpen && selectedATM && (
          <div style={{
            position: 'absolute',
            top: 12, right: 12, bottom: 12,
            width: `${panelW}px`,
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 16,
          }}>
            <SidePanel atm={selectedATM} onClose={() => dispatch(closeSidePanel())} />
          </div>
        )}

      </div>
    </div>
  );
}
