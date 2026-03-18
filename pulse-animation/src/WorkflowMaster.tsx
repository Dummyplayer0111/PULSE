import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion';
import { T } from './tokens';
import { Hero } from './scenes/Hero';
import { Dashboard } from './scenes/Dashboard';
import { AIDetection } from './scenes/AIDetection';
import { SelfHeal } from './scenes/SelfHeal';
import { NetworkMap } from './scenes/NetworkMap';
import { CustomerPortal } from './scenes/CustomerPortal';
import { StatsOutro } from './scenes/StatsOutro';

// ── Scene timing (30fps) ──────────────────────────────────────────────────────
//  Hero            0   – 150  (5s)
//  Dashboard     140   – 330  (6.3s)
//  AIDetection   320   – 510  (6.3s)
//  SelfHeal      500   – 680  (6s)
//  NetworkMap    670   – 840  (5.7s)
//  CustomerPortal 830  – 1010 (6s)
//  StatsOutro    1000  – 1200 (6.7s)
// TOTAL: 1200 frames = 40s

const SCENES = [
  { from: 0,    duration: 150, component: Hero },
  { from: 140,  duration: 190, component: Dashboard },
  { from: 320,  duration: 190, component: AIDetection },
  { from: 500,  duration: 180, component: SelfHeal },
  { from: 670,  duration: 170, component: NetworkMap },
  { from: 830,  duration: 180, component: CustomerPortal },
  { from: 1000, duration: 200, component: StatsOutro },
];

// Crossfade overlay between scenes
const CrossFade: React.FC<{ from: number; duration?: number }> = ({ from, duration = 18 }) => {
  const frame = useCurrentFrame();
  // Local frame within the crossfade window, centered on the scene boundary
  const overlap = Math.max(0, frame - from);
  const opacity = overlap < duration / 2
    ? 0
    : interpolate(overlap - duration / 2, [0, duration / 2], [1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: T.bg,
      opacity, pointerEvents: 'none', zIndex: 100,
    }} />
  );
};

export const WorkflowMaster: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      {SCENES.map(({ from, duration, component: Scene }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <AbsoluteFill>
            <Scene />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
