import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { T } from '../tokens';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { SceneLabel } from '../components/SceneLabel';

const STEPS = [
  { id: 'DETECT',   label: 'Anomaly Detected',      time: '14:32:11', detail: 'CASH_JAM_003 event fired' },
  { id: 'CLASSIFY', label: 'AI Classification',      time: '14:32:11', detail: 'CASH_JAM · 94.2% confidence' },
  { id: 'DISPATCH', label: 'Action Dispatched',      time: '14:32:12', detail: 'RESTART_SERVICE → ATM-009' },
  { id: 'EXECUTE',  label: 'Self-Heal Executing',    time: '14:32:13', detail: 'Service restart in progress' },
  { id: 'VERIFY',   label: 'Health Check',           time: '14:32:15', detail: 'ATM-009 responding normally' },
  { id: 'RESOLVED', label: 'Incident Resolved',      time: '14:32:16', detail: 'ATM-009 back online' },
];

export const SelfHeal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [155, 175], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Steps appear one every ~18 frames
  const stepsVisible = Math.floor(interpolate(frame, [0, 108], [0, 6], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));

  // ATM health color transition: red → amber → green
  // 0-70 = red, 70-120 = amber, 120+ = green
  const rR = interpolate(frame, [70, 100], [239, 245], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rG = interpolate(frame, [70, 100], [68, 158], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rB = interpolate(frame, [70, 100], [68, 11], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const gR = interpolate(frame, [100, 130], [245, 34], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const gG = interpolate(frame, [100, 130], [158, 197], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const gB = interpolate(frame, [100, 130], [11, 94], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const atmColor = frame < 100 ? `rgb(${Math.round(rR)},${Math.round(rG)},${Math.round(rB)})` : `rgb(${Math.round(gR)},${Math.round(gG)},${Math.round(gB)})`;

  // Health score restore
  const healthScore = Math.round(interpolate(frame, [100, 145], [0, 96], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));

  // Timer
  const timerVal = interpolate(frame, [30, 120], [0, 4.2], {
    easing: Easing.in(Easing.linear), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Final resolved checkmark
  const resolvedScale = spring({ frame: Math.max(0, frame - 118), fps, config: { stiffness: 240, damping: 18 }, from: 0, to: 1 });

  const atmStatus = frame < 70 ? 'OFFLINE' : frame < 100 ? 'RESTARTING' : 'ONLINE';
  const atmPill = frame < 70 ? { label: 'OFFLINE', color: T.red } : frame < 100 ? { label: 'RESTARTING', color: T.amber } : { label: 'ONLINE', color: T.green };

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      padding: '20px 32px', boxSizing: 'border-box',
      opacity: fadeOut,
    }}>
      <SceneLabel tag="Auto-Remediation" title="Self-Healing Engine" />

      <div style={{ marginTop: 100, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>

        {/* Pipeline steps */}
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 20 }}>
            Resolution Pipeline
          </div>
          <div>
            {STEPS.map((step, i) => {
              const visible = i < stepsVisible;
              const active = i === stepsVisible - 1;
              const done = i < stepsVisible - 1;
              const stepOpacity = interpolate(frame, [i * 18, i * 18 + 12], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              const color = step.id === 'RESOLVED' ? T.green : active ? T.gold : done ? T.green : T.vdim;

              return (
                <div key={step.id} style={{ opacity: visible ? stepOpacity : 0, display: 'flex', gap: 14, marginBottom: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: done || step.id === 'RESOLVED' ? `${T.green}20` : active ? `${T.gold}20` : T.cardStrong,
                      border: `1.5px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12,
                    }}>
                      {done ? '✓' : active ? '◎' : '○'}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ width: 1.5, height: 32, background: done ? T.green : T.cardBorder, marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 4, paddingBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: step.id === 'RESOLVED' ? T.green : active ? T.gold : T.text, fontFamily: T.font }}>{step.label}</div>
                    <div style={{ fontSize: 10, color: T.dim, fontFamily: T.font }}>{step.detail}</div>
                    <div style={{ fontSize: 9, color: T.vdim, fontFamily: T.mono, marginTop: 2 }}>{step.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ATM Status Card */}
          <Card style={{ border: `1px solid ${atmColor}35`, background: `${atmColor}06` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>ATM Status</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: T.mono }}>ATM-009</div>
                <div style={{ fontSize: 11, color: T.dim, fontFamily: T.font }}>MG Road Branch, Bengaluru</div>
              </div>
              <Pill label={atmPill.label} color={atmPill.color} />
            </div>

            {/* Health bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>Health Score</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: atmColor, fontFamily: T.mono }}>{healthScore}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: T.cardStrong, borderRadius: 3 }}>
                <div style={{ height: 6, width: `${healthScore}%`, background: atmColor, borderRadius: 3 }} />
              </div>
            </div>

            {/* Timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${T.cardBorder}` }}>
              <span style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>Recovery Time</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.gold, fontFamily: T.mono }}>{timerVal.toFixed(1)}s</span>
            </div>
          </Card>

          {/* Self-heal log */}
          <Card style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 12 }}>Action Log</div>
            {[
              { action: 'RESTART_SERVICE', status: 'SUCCESS', t: '14:32:12' },
              { action: 'HEALTH_CHECK', status: frame >= 120 ? 'SUCCESS' : 'PENDING', t: '14:32:15' },
              { action: 'ALERT_ENGINEER', status: frame >= 130 ? 'SUCCESS' : frame >= 100 ? 'ACTIVE' : 'PENDING', t: '14:32:16' },
            ].map((a, i) => {
              const aOpacity = interpolate(frame, [30 + i * 25, 42 + i * 25], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              const sColor = a.status === 'SUCCESS' ? T.green : a.status === 'ACTIVE' ? T.amber : T.vdim;
              return (
                <div key={i} style={{ opacity: aOpacity, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 2 ? `1px solid rgba(255,255,255,0.04)` : undefined }}>
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.text }}>{a.action}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: T.vdim, fontFamily: T.mono }}>{a.t}</span>
                    <Pill label={a.status} color={sColor} size="xs" />
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Resolved banner */}
          {frame >= 118 && (
            <div style={{
              transform: `scale(${resolvedScale})`,
              background: `${T.green}12`, border: `1px solid ${T.green}35`,
              borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ fontSize: 28 }}>✅</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.green, fontFamily: T.font }}>Incident Resolved</div>
                <div style={{ fontSize: 11, color: T.dim, fontFamily: T.font }}>ATM-009 back online · 4.2s recovery · No data loss</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
