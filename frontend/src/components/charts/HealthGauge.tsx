import React from 'react';

interface HealthGaugeProps {
  score: number;   // 0–100
  label?: string;
  size?: number;
}

export default function HealthGauge({ score, label, size = 120 }: HealthGaugeProps) {
  const s      = Math.max(0, Math.min(100, score));
  const cx     = size / 2;
  const cy     = size / 2;
  const r      = size / 2 - 14;
  const circ   = 2 * Math.PI * r;
  // 270° arc starting from bottom-left
  const arc    = circ * 0.75;
  const filled = arc * (s / 100);

  const color =
    s >= 80 ? '#22c55e' :
    s >= 50 ? '#f59e0b' :
    s >= 20 ? '#ef4444' : '#6b7280';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#e5e7eb" strokeWidth="9"
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Score text */}
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          fontSize={size * 0.18}
          fontWeight="700"
          fill="#111827"
        >
          {s}%
        </text>
      </svg>
      {label && (
        <p className="text-xs text-gray-500 font-medium text-center leading-tight">{label}</p>
      )}
    </div>
  );
}
