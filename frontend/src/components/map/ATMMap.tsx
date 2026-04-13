import React, { useMemo, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface ATMMapProps {
  atms: any[];
  selectedId: string | number | null;
  onATMClick: (atm: any) => void;
  heatmapMode?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  ONLINE:      '#4ade80',
  OFFLINE:     '#ef4444',
  DEGRADED:    '#f59e0b',
  MAINTENANCE: '#6b7280',
};

// Restrict map to India
const INDIA_BOUNDS: L.LatLngBoundsExpression = [[6.5, 68.0], [35.7, 97.5]];
const INDIA_CENTER: L.LatLngExpression = [22.0, 82.5];

function makeIcon(status: string, isSelected: boolean, hasIncident = false) {
  const color = STATUS_COLOR[status] ?? '#6b7280';
  const size  = isSelected ? 44 : 36;
  const ring  = hasIncident
    ? `<div class="atm-incident-ring" style="color:${color};"></div>`
    : '';
  const html  = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${ring}
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
      </div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size] });
}

/** Fit to ATM bounds once on first data load */
function FitBounds({ atms }: { atms: any[] }) {
  const map = useMap();
  const hasFitted = useRef(false);
  const coords = atms
    .filter(a => a.latitude && a.longitude)
    .map(a => [a.latitude, a.longitude] as [number, number]);

  useEffect(() => {
    if (hasFitted.current || coords.length === 0) return;
    hasFitted.current = true;
    // Short delay — map container is stable (overlay approach, no resize)
    const t = setTimeout(() => {
      if (coords.length === 1) {
        map.setView(coords[0], 12);
      } else {
        map.fitBounds(coords as L.LatLngBoundsExpression, { padding: [50, 50], maxZoom: 12, animate: false });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [coords.length]);

  return null;
}

/** Heatmap layer using leaflet.heat */
function HeatmapLayer({ atms }: { atms: any[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    const points = atms
      .filter(a => a.latitude && a.longitude)
      .map(a => {
        // Invert health: low health = high heat intensity
        const intensity = Math.max(0.1, (100 - (a.healthScore ?? 100)) / 100);
        return [a.latitude, a.longitude, intensity] as [number, number, number];
      });
    if (points.length > 0) {
      layerRef.current = (L as any).heatLayer(points, {
        radius: 35,
        blur: 25,
        maxZoom: 12,
        max: 1.0,
        gradient: { 0.2: '#22c55e', 0.4: '#eab308', 0.6: '#f97316', 0.8: '#ef4444', 1.0: '#dc2626' },
      }).addTo(map);
    }
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [atms, map]);

  return null;
}

export default function ATMMap({ atms, selectedId, onATMClick, heatmapMode = false }: ATMMapProps) {
  const validATMs = useMemo(() => atms.filter(a => a.latitude && a.longitude), [atms]);

  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      minZoom={4}
      maxZoom={18}
      maxBounds={INDIA_BOUNDS}
      maxBoundsViscosity={0.85}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url={isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      <FitBounds atms={validATMs} />

      {heatmapMode && <HeatmapLayer atms={validATMs} />}

      {!heatmapMode && validATMs.map(atm => (
        <Marker
          key={atm.id}
          position={[atm.latitude, atm.longitude]}
          icon={makeIcon(atm.status, atm.id === selectedId, atm.status === 'OFFLINE' || atm.status === 'DEGRADED')}
          eventHandlers={{ click: () => onATMClick(atm) }}
        >
          <Popup closeButton={false} className="atm-popup">
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
