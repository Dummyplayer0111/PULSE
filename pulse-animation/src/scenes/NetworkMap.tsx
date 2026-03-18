import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { T } from '../tokens';
import { Card } from '../components/Card';
import { SceneLabel } from '../components/SceneLabel';

// Simplified ATM positions (x%, y% within map area) — stylized Bengaluru grid
const ATM_NODES = [
  { id: 'ATM-001', name: 'Koramangala',    x: 52, y: 62, health: 97, zone: 'South' },
  { id: 'ATM-002', name: 'Indiranagar',    x: 64, y: 42, health: 91, zone: 'East' },
  { id: 'ATM-003', name: 'Whitefield',     x: 80, y: 38, health: 78, zone: 'East' },
  { id: 'ATM-004', name: 'HSR Layout',     x: 54, y: 72, health: 95, zone: 'South' },
  { id: 'ATM-005', name: 'Electronic City',x: 56, y: 82, health: 88, zone: 'South' },
  { id: 'ATM-006', name: 'Jayanagar',      x: 42, y: 66, health: 62, zone: 'South' },
  { id: 'ATM-007', name: 'Bannerghatta',   x: 46, y: 78, health: 93, zone: 'South' },
  { id: 'ATM-008', name: 'Marathahalli',   x: 72, y: 50, health: 99, zone: 'East' },
  { id: 'ATM-009', name: 'MG Road',        x: 50, y: 44, health: 96, zone: 'Central', restored: true },
  { id: 'ATM-010', name: 'Cunningham Rd',  x: 46, y: 38, health: 84, zone: 'Central' },
  { id: 'ATM-011', name: 'Yelahanka',      x: 40, y: 18, health: 72, zone: 'North' },
  { id: 'ATM-012', name: 'Bellandur',      x: 68, y: 62, health: 96, zone: 'East' },
  { id: 'ATM-013', name: 'Hebbal',         x: 44, y: 22, health: 90, zone: 'North' },
  { id: 'ATM-014', name: 'Rajajinagar',    x: 34, y: 36, health: 87, zone: 'West' },
  { id: 'ATM-015', name: 'Malleshwaram',   x: 38, y: 30, health: 94, zone: 'West' },
  { id: 'ATM-016', name: 'Yeshwanthpur',   x: 30, y: 32, health: 82, zone: 'West' },
  { id: 'ATM-017', name: 'Mysore Road',    x: 26, y: 52, health: 79, zone: 'West' },
  { id: 'ATM-018', name: 'BTM Layout',     x: 48, y: 70, health: 92, zone: 'South' },
  { id: 'ATM-019', name: 'Bommanahalli',   x: 60, y: 74, health: 88, zone: 'South' },
  { id: 'ATM-020', name: 'Nagarbhavi',     x: 28, y: 44, health: 85, zone: 'West' },
  { id: 'ATM-021', name: 'JP Nagar',       x: 40, y: 74, health: 91, zone: 'South' },
  { id: 'ATM-022', name: 'Basavanagudi',   x: 42, y: 58, health: 96, zone: 'South' },
  { id: 'ATM-023', name: 'Peenya',         x: 24, y: 26, health: 73, zone: 'North' },
  { id: 'ATM-024', name: 'Domlur',         x: 60, y: 48, health: 89, zone: 'Central' },
];

const healthColor = (h: number, restored?: boolean) => {
  if (restored) return T.green;
  return h >= 80 ? T.green : h >= 60 ? T.amber : T.red;
};

const ZONES = ['Central', 'East', 'South', 'West', 'North'];

export const NetworkMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [150, 170], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Map reveal
  const mapOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  // ATM nodes stagger in
  const nodeCount = Math.floor(interpolate(frame, [10, 80], [0, ATM_NODES.length], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));

  // Connection lines pulse
  const linePulse = interpolate(frame % 40, [0, 20, 40], [0.3, 0.7, 0.3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Zoom into Central zone at frame 80
  const mapScale = interpolate(frame, [80, 110], [1, 1.18], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const mapX = interpolate(frame, [80, 110], [0, -4], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const mapY = interpolate(frame, [80, 110], [0, 3], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ATM-009 restored pulse
  const pulse = interpolate(frame % 20, [0, 10, 20], [0.7, 1.4, 0.7], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      padding: '20px 32px', boxSizing: 'border-box',
      opacity: fadeOut,
    }}>
      <SceneLabel tag="Live ATM Network" title="Fleet Overview — Bengaluru" />

      <div style={{ marginTop: 100, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, height: 'calc(100% - 120px)' }}>

        {/* MAP */}
        <Card style={{ opacity: mapOpacity, overflow: 'hidden', position: 'relative', padding: 0 }}>
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(196,151,70,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(196,151,70,0.04) 1px, transparent 1px)`,
            backgroundSize: '8% 8%',
          }} />

          {/* Zone labels */}
          {[
            { label: 'NORTH', x: '40%', y: '8%' },
            { label: 'WEST', x: '8%', y: '45%' },
            { label: 'CENTRAL', x: '47%', y: '38%' },
            { label: 'EAST', x: '75%', y: '38%' },
            { label: 'SOUTH', x: '47%', y: '78%' },
          ].map(({ label, x, y }) => (
            <div key={label} style={{
              position: 'absolute', left: x, top: y,
              fontSize: 8, color: T.vdim, fontFamily: T.font,
              letterSpacing: '0.2em', fontWeight: 600,
              transform: 'translate(-50%, -50%)',
            }}>{label}</div>
          ))}

          {/* ATM nodes and connections */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, transform: `scale(${mapScale}) translate(${mapX}%, ${mapY}%)` }}>
            {/* Thin grid city lines */}
            {['30%', '45%', '60%', '75%'].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2="100%" stroke={`rgba(196,151,70,0.06)`} strokeWidth={0.5} />
            ))}
            {['25%', '40%', '55%', '70%', '85%'].map(y => (
              <line key={y} x1="0" y1={y} x2="100%" y2={y} stroke={`rgba(196,151,70,0.06)`} strokeWidth={0.5} />
            ))}

            {/* Connection lines between nearby ATMs */}
            {ATM_NODES.slice(0, Math.min(nodeCount, ATM_NODES.length)).map((a, i) =>
              ATM_NODES.slice(0, i).map(b => {
                const dist = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
                if (dist > 18 || dist < 2) return null;
                return (
                  <line key={`${a.id}-${b.id}`}
                    x1={`${a.x}%`} y1={`${a.y}%`}
                    x2={`${b.x}%`} y2={`${b.y}%`}
                    stroke={T.gold} strokeWidth={0.5}
                    opacity={linePulse * 0.25}
                  />
                );
              })
            )}

            {/* ATM dots */}
            {ATM_NODES.map((atm, i) => {
              if (i >= nodeCount) return null;
              const color = healthColor(atm.health, atm.restored);
              const isRestored = atm.restored && frame >= 20;
              const r = isRestored ? 7 * pulse : 7;
              return (
                <g key={atm.id}>
                  {/* Outer pulse ring for restored ATM */}
                  {isRestored && (
                    <circle cx={`${atm.x}%`} cy={`${atm.y}%`} r={r * 2}
                      fill="none" stroke={T.green} strokeWidth={0.8}
                      opacity={0.3}
                    />
                  )}
                  {/* Main dot */}
                  <circle cx={`${atm.x}%`} cy={`${atm.y}%`} r={r}
                    fill={`${color}30`} stroke={color} strokeWidth={1.5}
                  />
                  <circle cx={`${atm.x}%`} cy={`${atm.y}%`} r={3}
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>

          {/* Tooltip for ATM-009 */}
          {frame >= 85 && (
            <div style={{
              position: 'absolute', left: '51%', top: '35%',
              background: T.cardStrong, border: `1px solid ${T.green}40`,
              borderRadius: 8, padding: '8px 12px', zIndex: 10,
              opacity: interpolate(frame, [85, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, fontFamily: T.font }}>✓ ATM-009 Restored</div>
              <div style={{ fontSize: 10, color: T.dim, fontFamily: T.font }}>MG Road · Health 96%</div>
            </div>
          )}
        </Card>

        {/* Right panel: zone stats + legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Legend */}
          <Card style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 12 }}>Health Legend</div>
            {[
              { color: T.green, label: 'Healthy', range: '≥ 80%', count: 19 },
              { color: T.amber, label: 'Degraded', range: '60–79%', count: 4 },
              { color: T.red, label: 'Critical', range: '< 60%', count: 1 },
            ].map(({ color, label, range, count }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: `1.5px solid ${color}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T.dim, fontFamily: T.font, flex: 1 }}>{label}</span>
                <span style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>{range}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: T.mono, minWidth: 20, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </Card>

          {/* Zone breakdown */}
          <Card style={{ padding: '14px 18px', flex: 1 }}>
            <div style={{ fontSize: 10, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 12 }}>Zones</div>
            {[
              { zone: 'Central', count: 3, health: 90 },
              { zone: 'East', count: 5, health: 88 },
              { zone: 'South', count: 9, health: 92 },
              { zone: 'West', count: 4, health: 82 },
              { zone: 'North', count: 3, health: 78 },
            ].map(({ zone, count, health }, i) => {
              const barOpacity = interpolate(frame, [25 + i * 8, 38 + i * 8], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              return (
                <div key={zone} style={{ opacity: barOpacity, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.text, fontFamily: T.font }}>{zone}</span>
                    <span style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>{count} ATMs</span>
                  </div>
                  <div style={{ width: '100%', height: 3, background: T.cardStrong, borderRadius: 2 }}>
                    <div style={{ height: 3, width: `${health}%`, background: health >= 85 ? T.green : T.amber, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: health >= 85 ? T.green : T.amber, fontFamily: T.mono, marginTop: 2 }}>{health}%</div>
                </div>
              );
            })}
          </Card>

          {/* Summary stat */}
          <Card style={{ padding: '14px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { v: '24', l: 'Total ATMs', c: T.gold },
                { v: '8', l: 'Zones', c: T.blue },
              ].map(({ v, l, c }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c, fontFamily: T.font }}>{v}</div>
                  <div style={{ fontSize: 9, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
