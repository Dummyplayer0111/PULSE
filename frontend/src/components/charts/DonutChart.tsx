import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCountUp } from '../../hooks/useCountUp';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data:    Segment[];
  size?:   number;
  title?:  string;
  showLegend?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  NETWORK: '🌐', HARDWARE: '⚙️', CASH_JAM: '💵',
  FRAUD: '🚨', SERVER: '🖥️', TIMEOUT: '⏱️',
  SWITCH: '🔁', UNKNOWN: '❓',
};

function easeOutExpo(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

export default function DonutChart({ data, size = 160, title, showLegend = true }: DonutChartProps) {
  const R         = size / 2 - 18;
  const CX        = size / 2;
  const CY        = size / 2;
  const CIRC      = 2 * Math.PI * R;
  const STROKE    = 14;
  const GAP       = (3.5 / 360) * CIRC;

  const total     = data.reduce((s, d) => s + d.value, 0);
  const animated  = useCountUp(total, 1600);

  const [progress, setProgress]     = useState(0);
  const [hovered,  setHovered]      = useState<number | null>(null);
  const [tooltip,  setTooltip]      = useState<{ x: number; y: number; seg: Segment } | null>(null);
  const rafRef = useRef<number>(0);

  /* ── Draw-in animation on mount ─────────────────────────────────────── */
  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    const tick = (ts: number) => {
      const t = Math.min((ts - start) / dur, 1);
      setProgress(easeOutExpo(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ── Segment geometry ───────────────────────────────────────────────── */
  let accumulated = 0;
  const segs = data.map(seg => {
    const totalLen   = total > 0 ? (seg.value / total) * CIRC : 0;
    const displayLen = Math.max(0, totalLen - GAP);
    const startOff   = accumulated;
    accumulated += totalLen;
    return { ...seg, displayLen, startOff };
  });

  const handleMove = useCallback((e: React.MouseEvent, seg: Segment) => {
    setTooltip({ x: e.clientX, y: e.clientY, seg });
  }, []);

  if (!data.length || total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
        No data
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track ring */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={STROKE}
          />

          {segs.map((seg, i) => {
            const sw  = hovered === i ? STROKE + 6 : STROKE;
            const opa = hovered !== null && hovered !== i ? 0.22 : 1;
            const drawnLen = seg.displayLen * progress;

            return (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={sw}
                strokeDasharray={`${drawnLen} ${CIRC}`}
                strokeDashoffset={-seg.startOff}
                strokeLinecap="round"
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{
                  transition: 'stroke-width 0.22s ease, opacity 0.22s ease',
                  opacity: opa,
                  cursor: 'pointer',
                  filter: hovered === i ? `drop-shadow(0 0 6px ${seg.color}60)` : undefined,
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => { setHovered(null); setTooltip(null); }}
                onMouseMove={e => handleMove(e, seg)}
              />
            );
          })}

          {/* Inner circle — prevent the SVG strokes from being clickable there */}
          <circle cx={CX} cy={CY} r={R - STROKE / 2 - 2} fill="var(--p-gauge-inner, #0d0d0d)" />

          {/* Center text */}
          <text x={CX} y={CY - 5} textAnchor="middle" fill="var(--p-text, #f8f8f8)" fontSize={size * 0.135} fontWeight="800" fontFamily="inherit">
            {animated}
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize={size * 0.065} fontFamily="inherit">
            {title ?? 'total'}
          </text>
        </svg>
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center' }}>
          {data.map((seg, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, cursor: 'default',
                opacity: hovered !== null && hovered !== i ? 0.35 : 1,
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {seg.label}
                <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: 3 }}>({seg.value})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 14,
          top:  tooltip.y - 48,
          background: 'rgba(8,8,8,0.96)',
          border: `1px solid ${tooltip.seg.color}40`,
          borderRadius: 10,
          padding: '8px 12px',
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
          minWidth: 140,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `${tooltip.seg.color}20`,
            border: `1px solid ${tooltip.seg.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>
            {CATEGORY_ICONS[tooltip.seg.label] ?? '📊'}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: tooltip.seg.color, fontFamily: 'inherit' }}>{tooltip.seg.label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'white', fontFamily: 'inherit' }}>
              {tooltip.seg.value}
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>
                ({total > 0 ? Math.round((tooltip.seg.value / total) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
