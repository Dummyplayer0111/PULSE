import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

interface ATMMapProps {
  atms: any[];
  selectedId: string | number | null;
  onATMClick: (atm: any) => void;
}

const STATUS_COLOR: Record<string, string> = {
  ONLINE:      '#4ade80',
  OFFLINE:     '#ef4444',
  DEGRADED:    '#f59e0b',
  MAINTENANCE: '#6b7280',
};

/** Build a Leaflet DivIcon matching the dark dashboard theme */
function makeIcon(status: string, isSelected: boolean) {
  const color = STATUS_COLOR[status] ?? '#6b7280';
  const size  = isSelected ? 44 : 36;
  const html  = `
    <div style="
      width:${size}px;height:${size}px;
      background:rgba(14,14,20,0.92);
      border:2px solid ${color};
      border-radius:50% 50% 50% 4px;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 0 3px ${color}30, 0 4px 16px rgba(0,0,0,0.6);
      transition:all 0.2s;
    ">
      <div style="
        transform:rotate(45deg);
        width:10px;height:10px;
        border-radius:50%;
        background:${color};
        box-shadow:0 0 6px ${color};
      "></div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor:[0, -size],
  });
}

/** Auto-fit map bounds when ATMs list changes */
function FitBounds({ atms }: { atms: any[] }) {
  const map = useMap();
  const coords = atms.filter(a => a.latitude && a.longitude).map(a => [a.latitude, a.longitude] as [number, number]);
  React.useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 12);
    } else {
      map.fitBounds(coords, { padding: [60, 60], maxZoom: 12 });
    }
  }, [coords.length]);
  return null;
}

export default function ATMMap({ atms, selectedId, onATMClick }: ATMMapProps) {
  const validATMs = useMemo(() => atms.filter(a => a.latitude && a.longitude), [atms]);

  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      style={{ width: '100%', height: '100%', borderRadius: '1rem' }}
      zoomControl={true}
    >
      {/* CartoDB Dark Matter tiles — free, no API key */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      <FitBounds atms={validATMs} />

      {validATMs.map(atm => (
        <Marker
          key={atm.id}
          position={[atm.latitude, atm.longitude]}
          icon={makeIcon(atm.status, atm.id === selectedId)}
          eventHandlers={{ click: () => onATMClick(atm) }}
        >
          <Popup
            closeButton={false}
            className="atm-popup"
          >
            <div style={{
              background: 'rgba(14,14,20,0.97)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '12px 14px',
              minWidth: '160px',
              color: 'white',
              fontFamily: 'inherit',
            }}>
              <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                {atm.name || `ATM #${atm.id}`}
              </p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                {atm.location}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: STATUS_COLOR[atm.status] ?? '#6b7280',
                  boxShadow: `0 0 6px ${STATUS_COLOR[atm.status] ?? '#6b7280'}`,
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: STATUS_COLOR[atm.status] ?? '#6b7280' }}>
                  {atm.status}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: 'white' }}>
                  {atm.healthScore}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>health</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
