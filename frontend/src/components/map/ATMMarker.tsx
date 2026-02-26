import React from 'react';
import { MapPin } from 'lucide-react';

interface ATMMarkerProps {
  atm: any;
  isSelected: boolean;
  onClick: () => void;
}

const statusColors: Record<string, string> = {
  ONLINE:      'bg-green-500',
  OFFLINE:     'bg-red-500',
  DEGRADED:    'bg-amber-400',
  MAINTENANCE: 'bg-gray-400',
};

export default function ATMMarker({ atm, isSelected, onClick }: ATMMarkerProps) {
  const dot = statusColors[atm.status] ?? 'bg-gray-400';

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col items-center gap-1 transition-transform
        ${isSelected ? 'scale-110 z-10' : 'hover:scale-105'}
      `}
    >
      <div className={`
        relative w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors
        ${isSelected ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-700 group-hover:bg-blue-50'}
        border-2 ${isSelected ? 'border-blue-400' : 'border-gray-200'}
      `}>
        <MapPin size={18} />
        {/* Status dot */}
        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${dot}`} />
      </div>
      <span className={`text-[10px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-md ${
        isSelected ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-600 border border-gray-200'
      }`}>
        {atm.name || `ATM-${atm.id}`}
      </span>
    </button>
  );
}
