import React from 'react';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: Segment[];
  size?: number;
  title?: string;
}

export default function DonutChart({ data, size = 160, title }: DonutChartProps) {
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = size / 2 - 20;
  const circ = 2 * Math.PI * r;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-gray-300 text-xs" style={{ width: size, height: size }}>
        No data
      </div>
    );
  }

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="14" />
          {data.map((seg, i) => {
            const len    = (seg.value / total) * circ;
            const dOff   = -offset;
            offset += len;
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${circ}`}
                strokeDashoffset={dOff}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        {/* Center label */}
        {title && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-gray-500 font-medium text-center leading-tight px-2">{title}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {data.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600 whitespace-nowrap">
              {seg.label}
              <span className="text-gray-400 ml-1">({seg.value})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
