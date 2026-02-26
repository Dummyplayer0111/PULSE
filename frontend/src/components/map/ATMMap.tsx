import React from 'react';
import ATMMarker from './ATMMarker';

interface ATMMapProps {
  atms: any[];
  selectedId: string | number | null;
  onATMClick: (atm: any) => void;
}

/**
 * ATMMap — Displays ATM markers in a pseudo-map grid.
 * Replace the inner grid with a real Leaflet/Mapbox component
 * once lat/lng coordinates are available from the ATM model.
 */
export default function ATMMap({ atms, selectedId, onATMClick }: ATMMapProps) {
  return (
    <div className="relative w-full h-full bg-[#f0f4f8] overflow-hidden rounded-xl border border-gray-100">
      {/* Map grid lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Placeholder map note */}
      <div className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-500 border border-gray-200">
        Map view — integrate Leaflet/Mapbox with ATM coordinates
      </div>

      {/* ATM markers scattered in a grid */}
      {atms.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          No ATMs to display.
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-wrap gap-8 items-center justify-center p-12">
          {atms.map((atm, i) => (
            <div
              key={atm.id}
              style={{
                transform: `translate(${Math.sin(i * 1.5) * 40}px, ${Math.cos(i * 1.2) * 30}px)`,
              }}
            >
              <ATMMarker
                atm={atm}
                isSelected={atm.id === selectedId}
                onClick={() => onATMClick(atm)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
