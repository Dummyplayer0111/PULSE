import React from 'react';

interface DataPoint {
  timestamp: string;
  value: number;
}

interface TrendLineProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  label?: string;
}

export default function TrendLine({ data, color = '#2563EB', height = 60, label }: TrendLineProps) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-300 text-xs" style={{ height }}>
        Not enough data
      </div>
    );
  }

  const W = 240;
  const H = height;
  const PAD = 4;

  const values = data.map(d => d.value);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.value - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* Area fill */}
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${PAD},${H} ${points} ${W - PAD},${H}`}
          fill={`url(#grad-${color})`}
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label && <p className="text-xs text-gray-400">{label}</p>}
    </div>
  );
}
