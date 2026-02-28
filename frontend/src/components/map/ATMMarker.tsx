import React from 'react';
import { MapPin } from 'lucide-react';

interface ATMMarkerProps {
  atm: any;
  isSelected: boolean;
  onClick: () => void;
}

const statusColor: Record<string, string> = {
  ONLINE:      '#4ade80',
  OFFLINE:     '#ef4444',
  DEGRADED:    '#f59e0b',
  MAINTENANCE: '#6b7280',
};

export default function ATMMarker({ atm, isSelected, onClick }: ATMMarkerProps) {
  const color = statusColor[atm.status] ?? '#6b7280';

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1 transition-all duration-200"
      style={{ transform: isSelected ? 'scale(1.15)' : undefined }}
    >
      {/* Pin icon */}
      <div
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
        style={isSelected ? {
          background: 'rgba(255,255,255,0.15)',
          border: `2px solid ${color}`,
          boxShadow: `0 0 0 4px ${color}20, 0 4px 16px rgba(0,0,0,0.4)`,
        } : {
          background: 'rgba(255,255,255,0.07)',
          border: `1px solid rgba(255,255,255,0.12)`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <MapPin size={16} style={{ color: isSelected ? color : 'rgba(255,255,255,0.7)' }} />
        {/* Status dot */}
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
          style={{
            background: color,
            border: '1.5px solid rgba(11,11,15,1)',
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>

      {/* Label */}
      <span
        className="text-[9px] font-bold whitespace-nowrap px-2 py-0.5 rounded-md"
        style={isSelected ? {
          background: color,
          color: '#0b0b0f',
          boxShadow: `0 2px 8px ${color}50`,
        } : {
          background: 'rgba(0,0,0,0.55)',
          color: 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {atm.name || `ATM-${atm.id}`}
      </span>
    </button>
  );
}
