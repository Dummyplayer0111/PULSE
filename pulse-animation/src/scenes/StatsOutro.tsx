import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { T } from '../tokens';

const STATS = [
  { value: '24',    label: 'ATMs Monitored',     sub: 'Across 8 zones',        color: T.gold   },
  { value: '94%',   label: 'AI Accuracy',         sub: 'Root cause classification', color: T.purple },
  { value: '4.2s',  label: 'Avg Recovery Time',   sub: 'Self-heal automation',  color: T.green  },
  { value: '99.7%', label: 'Platform Uptime',      sub: 'SLA guaranteed',        color: T.blue   },
];

const STACK = ['Django 5.2', 'React 19', 'FastAPI', 'Redis', 'WebSocket', 'JWT'];

export const StatsOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: stats wall (0-120)
  // Phase 2: transition to logo (120-180)
  const statsPhase = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const statsFade = interpolate(frame, [115, 135], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoPhaseFade = interpolate(frame, [125, 145], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const logoScale = spring({ frame: Math.max(0, frame - 125), fps, config: { stiffness: 160, damping: 22 }, from: 0.8, to: 1 });

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 800, height: 400,
        background: `radial-gradient(ellipse, ${T.goldDim}14 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />

      {/* Stats phase */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: statsPhase * statsFade }}>
        <div style={{ fontSize: 13, color: T.vdim, fontFamily: T.font, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 40 }}>
          Platform Impact
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
          {STATS.map(({ value, label, sub, color }, i) => {
            const cardScale = spring({ frame: Math.max(0, frame - i * 12), fps, config: { stiffness: 200, damping: 22 }, from: 0.7, to: 1 });
            const cardOpacity = interpolate(frame, [i * 12, i * 12 + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={label} style={{
                opacity: cardOpacity, transform: `scale(${cardScale})`,
                background: `${color}0d`, border: `1px solid ${color}25`,
                borderRadius: 16, padding: '28px 24px', textAlign: 'center', minWidth: 200,
                boxShadow: `0 0 30px ${color}10`,
              }}>
                <div style={{ fontSize: 48, fontWeight: 900, color, fontFamily: T.font, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 10 }}>
                  {value}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>{sub}</div>
              </div>
            );
          })}
        </div>

        {/* Stack badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {STACK.map((s, i) => {
            const sOpacity = interpolate(frame, [50 + i * 6, 62 + i * 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <span key={s} style={{
                opacity: sOpacity,
                fontSize: 11, padding: '4px 12px', borderRadius: 99,
                background: T.card, border: `1px solid ${T.cardBorder}`,
                color: T.dim, fontFamily: T.font,
              }}>{s}</span>
            );
          })}
        </div>
      </div>

      {/* Logo outro phase */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: logoPhaseFade }}>
        <div style={{ transform: `scale(${logoScale})`, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: `linear-gradient(135deg, ${T.gold}30, ${T.goldDim}12)`,
              border: `1.5px solid ${T.gold}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 30px ${T.gold}20`,
            }}>
              <svg viewBox="0 0 24 24" width={30} height={30} fill="none">
                <path d="M12 2L4 6v6c0 5.1 3.4 9.9 8 11 4.6-1.1 8-5.9 8-11V6l-8-4z" fill={`${T.gold}20`} stroke={T.gold} strokeWidth={1.2} />
                <path d="M9 12l2 2 4-4" stroke={T.gold} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 56, fontWeight: 800, color: T.text, fontFamily: T.font, letterSpacing: '-0.04em' }}>
              Pay<span style={{ color: T.gold }}>Guard</span>
            </span>
          </div>

          {/* Taglines */}
          {[
            { text: 'Zero downtime. Zero manual work.', delay: 8 },
            { text: 'ATM Intelligence Platform', delay: 18 },
          ].map(({ text, delay }) => {
            const tOpacity = interpolate(frame - 125, [delay, delay + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={text} style={{ opacity: tOpacity }}>
                <p style={{ fontSize: text.includes('Platform') ? 15 : 18, color: T.dim, fontFamily: T.font, textAlign: 'center', marginBottom: 6 }}>{text}</p>
              </div>
            );
          })}

          {/* Final stack line */}
          <div style={{ opacity: interpolate(frame - 125, [30, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), marginTop: 16 }}>
            <p style={{ fontSize: 11, color: T.vdim, fontFamily: T.font, textAlign: 'center', letterSpacing: '0.12em' }}>
              DJANGO · REACT · FASTAPI · WEBSOCKET · AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
