import React, { useMemo } from 'react';
import { AlertCircle, Map, Wifi, WifiOff, Loader } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetATMsQuery } from '../services/pulseApi';
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

export default function ATMMapPage() {
  const dispatch = useDispatch();
  const { selectedATMId, isSidePanelOpen } = useSelector((s: RootState) => s.ui);

  // REST fetch (initial + background refresh)
  const { data: apiATMs = [], isLoading, error } = useGetATMsQuery(undefined, {
    pollingInterval: 30_000, // background poll every 30s as fallback
  });

  // WebSocket real-time updates
  const { status: wsStatus, liveATMs } = useATMSocket();

  // Merge: live WS updates take priority over API data
  const atms = useMemo(() => {
    if (liveATMs.length === 0) return apiATMs;
    return apiATMs.map((a: any) => {
      const live = liveATMs.find((l: any) => l.id === a.id);
      return live ?? a;
    }).concat(
      // append truly new ATMs from WS that aren't in the API list yet
      liveATMs.filter((l: any) => !apiATMs.find((a: any) => a.id === l.id))
    );
  }, [apiATMs, liveATMs]);

  const selectedATM = atms.find((a: any) => a.id === selectedATMId) ?? null;

  const onlineCount     = atms.filter((a: any) => a.status === 'ONLINE').length;
  const offlineCount    = atms.filter((a: any) => a.status === 'OFFLINE').length;
  const degradedCount   = atms.filter((a: any) => a.status === 'DEGRADED').length;
  const maintenanceCount= atms.filter((a: any) => a.status === 'MAINTENANCE').length;

  return (
    <div className="p-6 flex flex-col" style={{ minHeight: '100vh', gap: '16px' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}
          >
            <Map size={16} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ATM Network</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {isLoading ? 'Loading…' : `${atms.length} terminals · India`}
            </p>
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-3">
          {/* WS indicator */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {wsStatus === 'connected' ? (
              <><Wifi size={12} style={{ color: '#4ade80' }} /><span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>Live</span></>
            ) : wsStatus === 'connecting' ? (
              <><Loader size={12} className="animate-spin" style={{ color: '#f59e0b' }} /><span className="text-[10px] font-medium" style={{ color: '#f59e0b' }}>Connecting</span></>
            ) : (
              <><WifiOff size={12} style={{ color: '#ef4444' }} /><span className="text-[10px] font-medium" style={{ color: '#ef4444' }}>Offline</span></>
            )}
          </div>

          {/* Status counts */}
          {[
            { label: 'Online',      count: onlineCount,      color: '#4ade80' },
            { label: 'Degraded',    count: degradedCount,    color: '#f59e0b' },
            { label: 'Maintenance', count: maintenanceCount, color: '#6b7280' },
            { label: 'Offline',     count: offlineCount,     color: '#ef4444' },
          ].filter(s => s.count > 0).map(({ label, count, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] font-semibold text-white">{count}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map + Side panel row */}
      <div className="flex gap-4 flex-1" style={{ minHeight: '680px' }}>

        {/* Map */}
        <div className="flex-1 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {isLoading ? (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="text-center space-y-3">
                <Loader size={28} className="animate-spin mx-auto" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading ATM network…</p>
              </div>
            </div>
          ) : error ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-4"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <AlertCircle size={32} style={{ color: '#f59e0b' }} />
              <p className="text-sm text-white">ATM backend unavailable</p>
            </div>
          ) : (
            <ATMMapComponent
              atms={atms}
              selectedId={selectedATMId}
              onATMClick={(atm) => dispatch(selectATM(atm.id === selectedATMId ? null : atm.id))}
            />
          )}
        </div>

        {/* Side panel slides in when ATM selected */}
        {isSidePanelOpen && selectedATM && (
          <SidePanel atm={selectedATM} onClose={() => dispatch(closeSidePanel())} />
        )}
      </div>

      {/* Bottom ATM list (quick status overview) */}
      {atms.length > 0 && (
        <div
          className="rounded-2xl p-4 overflow-x-auto"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {atms.map((atm: any) => {
              const color = STATUS_COLOR[atm.status] ?? '#6b7280';
              const isSelected = atm.id === selectedATMId;
              return (
                <button
                  key={atm.id}
                  onClick={() => dispatch(selectATM(atm.id === selectedATMId ? null : atm.id))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border: isSelected ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.07)',
                    minWidth: '140px',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color, boxShadow: isSelected ? `0 0 6px ${color}` : 'none' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{atm.name}</p>
                    <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {atm.location?.split(',')[0]}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold shrink-0" style={{ color }}>
                    {Math.round(atm.healthScore)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
