import React, { useEffect, useRef, useState } from 'react';

interface HealthGaugeProps {
  score:  number;   // 0–100
  label?: string;
  size?:  number;
}

function easeOutExpo(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

export default function HealthGauge({ score, label, size = 120 }: HealthGaugeProps) {
  const s    = Math.max(0, Math.min(100, score));
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;

  const color = s >= 80 ? '#22c55e' : s >= 50 ? '#f59e0b' : s >= 20 ? '#ef4444' : '#6b7280';

  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const dur   = 1200;
    const tick  = (ts: number) => {
      const t = Math.min((ts - start) / dur, 1);
      setProgress(easeOutExpo(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [s]);

  const filled = arc * (s / 100) * progress;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9"
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
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
        {/* Score */}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={size * 0.18} fontWeight="800" fill="var(--p-text, #f8f8f8)" fontFamily="inherit">
          {Math.round(s * progress)}%
        </text>
      </svg>
      {label && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center', fontFamily: 'inherit' }}>{label}</p>
      )}
    </div>
  );
}
