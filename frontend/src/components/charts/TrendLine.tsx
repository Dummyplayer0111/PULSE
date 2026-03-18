import React, { useEffect, useRef, useState } from 'react';

interface DataPoint {
  timestamp: string;
  value:     number;
}

interface TrendLineProps {
  data:        DataPoint[];
  color?:      string;
  height?:     number;
  label?:      string;
  strokeWidth?: number;
  showArea?:   boolean;
  showDot?:    boolean;
  noMargin?:   boolean;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  return pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const cpx  = (prev.x + pt.x) / 2;
    return `${acc} C ${cpx} ${prev.y} ${cpx} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');
}

export default function TrendLine({
  data,
  color      = '#e8af48',
  height     = 60,
  label,
  strokeWidth = 2.5,
  showArea   = true,
  showDot    = true,
  noMargin   = false,
}: TrendLineProps) {
  const lineRef  = useRef<SVGPathElement>(null);
  const areaRef  = useRef<SVGPathElement>(null);
  const [areaVisible, setAreaVisible] = useState(false);
  const [dotVisible,  setDotVisible]  = useState(false);

  const W   = 300;
  const H   = height;
  const PAD = 4;

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;

    const len = line.getTotalLength();
    line.style.strokeDasharray  = `${len}`;
    line.style.strokeDashoffset = `${len}`;

    const anim = line.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: 1300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    );

    const t1 = setTimeout(() => setAreaVisible(true), 700);
    const t2 = setTimeout(() => setDotVisible(true),  1100);

    return () => { anim.cancel(); clearTimeout(t1); clearTimeout(t2); };
  }, [data]);

  if (!data || data.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>No data</div>;
  }

  const values = data.map(d => d.value);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;

  const pts = data.map((d, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((d.value - min) / range) * (H - PAD * 2),
  }));

  const linePath = smoothPath(pts);
  const areaPath = `${linePath} L ${W - PAD} ${H} L ${PAD} ${H} Z`;
  const gradId   = `tl-grad-${color.replace(/[^a-z0-9]/gi, '')}`;

  const last = pts[pts.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ margin: noMargin ? '0 -20px' : undefined, width: noMargin ? 'calc(100% + 40px)' : '100%' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {showArea && (
          <path
            ref={areaRef}
            d={areaPath}
            fill={`url(#${gradId})`}
            style={{ opacity: areaVisible ? 1 : 0, transition: 'opacity 0.6s ease' }}
          />
        )}

        {/* Line */}
        <path
          ref={lineRef}
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Last-point dot */}
        {showDot && (
          <circle
            cx={last.x} cy={last.y} r={3.5}
            fill={color}
            stroke="var(--p-bg, #060606)"
            strokeWidth={2}
            style={{
              opacity: dotVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
              filter: `drop-shadow(0 0 5px ${color}90)`,
            }}
          />
        )}
      </svg>
      {label && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0, fontFamily: 'inherit' }}>{label}</p>}
    </div>
  );
}
