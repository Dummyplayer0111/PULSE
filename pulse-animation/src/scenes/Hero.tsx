import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { T } from '../tokens';

const FEATURES = ['Real-Time Monitoring', 'AI Classification', 'Self-Healing Automation', 'Customer Portal'];

export const Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { stiffness: 160, damping: 22 }, from: 0.7, to: 1 });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const taglineOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [25, 45], [14, 0], { easing: Easing.out(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const subtitleOpacity = interpolate(frame, [40, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Fade out
  const fadeOut = interpolate(frame, [130, 150], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Grid dots in bg
  const gridOpacity = interpolate(frame, [0, 30], [0, 0.12], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      opacity: fadeOut,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 300,
        background: `radial-gradient(ellipse, ${T.goldDim}18 0%, transparent 70%)`,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: gridOpacity,
        backgroundImage: `linear-gradient(${T.cardBorder} 1px, transparent 1px), linear-gradient(90deg, ${T.cardBorder} 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Logo */}
      <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, textAlign: 'center', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
          {/* Icon mark */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${T.gold}30, ${T.goldDim}15)`,
            border: `1.5px solid ${T.gold}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 24px ${T.gold}20`,
          }}>
            <svg viewBox="0 0 24 24" width={28} height={28} fill="none">
              <path d="M12 2L4 6v6c0 5.1 3.4 9.9 8 11 4.6-1.1 8-5.9 8-11V6l-8-4z" fill={`${T.gold}25`} stroke={T.gold} strokeWidth={1.2} />
              <path d="M9 12l2 2 4-4" stroke={T.gold} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 52, fontWeight: 800, color: T.text, fontFamily: T.font, letterSpacing: '-0.04em' }}>
            Pay<span style={{ color: T.gold }}>Guard</span>
          </span>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ opacity: taglineOpacity, transform: `translateY(${taglineY}px)`, textAlign: 'center', zIndex: 1 }}>
        <p style={{ fontSize: 20, color: T.dim, fontFamily: T.font, fontWeight: 400, letterSpacing: '0.01em', marginBottom: 36 }}>
          ATM Intelligence Platform
        </p>
      </div>

      {/* Feature pills */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
        opacity: subtitleOpacity, zIndex: 1,
      }}>
        {FEATURES.map((f, i) => {
          const pillOpacity = interpolate(frame, [50 + i * 8, 65 + i * 8], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const pillX = interpolate(frame, [50 + i * 8, 65 + i * 8], [12, 0], {
            easing: Easing.out(Easing.quad),
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <div key={f} style={{ opacity: pillOpacity, transform: `translateX(${pillX}px)` }}>
              <span style={{
                fontSize: 12, fontWeight: 500, color: T.goldDim,
                background: `${T.gold}0d`, border: `1px solid ${T.gold}25`,
                borderRadius: 99, padding: '5px 14px', fontFamily: T.font,
              }}>
                {f}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom stat row */}
      <div style={{ position: 'absolute', bottom: 48, display: 'flex', gap: 48, opacity: subtitleOpacity, zIndex: 1 }}>
        {[['24', 'ATMs Monitored'], ['99.7%', 'Uptime SLA'], ['4.2s', 'Avg Recovery']].map(([v, l]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.gold, fontFamily: T.font }}>{v}</div>
            <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
