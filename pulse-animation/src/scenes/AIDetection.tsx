import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { T, CAT } from '../tokens';
import { Card, CardHeader } from '../components/Card';
import { Pill } from '../components/Pill';
import { FadeSlide } from '../components/FadeSlide';
import { SceneLabel } from '../components/SceneLabel';

const CATEGORIES = [
  { cat: 'CASH_JAM', pct: 94, label: 'Cash Jam', highlight: true },
  { cat: 'HARDWARE', pct: 4, label: 'Hardware Fault' },
  { cat: 'UNKNOWN',  pct: 2, label: 'Unknown' },
];

const EVENT_CODES = [
  'CASH_JAM_003',
  'DISPENSE_TIMEOUT',
  'MOTOR_STALL_ERR',
  'CASH_UNIT_FAULT',
];

export const AIDetection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [165, 185], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Left panel: incident card fades in first
  const incidentIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const incidentY = interpolate(frame, [0, 20], [20, 0], { easing: Easing.out(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Right panel: AI "analyzing" bar
  const analyzeWidth = interpolate(frame, [15, 50], [0, 100], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Category bars stagger in after analysis completes
  const catBarsStart = 55;
  const confidencePopFrame = 95;

  // Confidence score pop
  const confScale = spring({
    frame: Math.max(0, frame - confidencePopFrame), fps,
    config: { stiffness: 220, damping: 18 }, from: 0, to: 1,
  });

  // Action badge
  const actionOpacity = interpolate(frame, [110, 125], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const actionScale = spring({ frame: Math.max(0, frame - 110), fps, config: { stiffness: 200, damping: 20 }, from: 0.7, to: 1 });

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      padding: '20px 32px', boxSizing: 'border-box',
      opacity: fadeOut,
    }}>
      <SceneLabel tag="AI-Powered Detection" title="Automated Incident Classification" />

      <div style={{ marginTop: 100, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* LEFT: Incident card */}
        <div style={{ opacity: incidentIn, transform: `translateY(${incidentY}px)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Incident ID</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.mono }}>INC-20260318-047</div>
              </div>
              <Pill label="CRITICAL" color={T.red} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.red, fontFamily: T.font, marginBottom: 10 }}>
              Cash Dispenser Jam — ATM Offline
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                ['ATM', 'ATM-009'],
                ['Location', 'MG Road Branch'],
                ['Status', 'OFFLINE'],
                ['Detected', '14:32:11'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font }}>{k}</div>
                  <div style={{ fontSize: 12, color: T.text, fontFamily: k === 'ATM' ? T.mono : T.font, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 6 }}>Error Codes Received</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {EVENT_CODES.map(code => (
                  <span key={code} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    color: T.red, fontFamily: T.mono, fontWeight: 600,
                  }}>{code}</span>
                ))}
              </div>
            </div>
          </Card>

          {/* Event timeline */}
          <Card noPad>
            <CardHeader label="Event Timeline" />
            <div style={{ padding: '10px 0' }}>
              {[
                { t: '14:32:11', e: 'CASH_JAM_003 — Motor stall on unit 2', sev: T.red },
                { t: '14:32:09', e: 'DISPENSE_TIMEOUT — 3 retries failed', sev: T.orange },
                { t: '14:32:07', e: 'MOTOR_STALL_ERR — Jam sensor triggered', sev: T.orange },
                { t: '14:32:03', e: 'CARD_READ_OK — Transaction initiated', sev: T.blue },
              ].map((ev, i) => {
                const evOpacity = interpolate(frame, [8 + i * 6, 20 + i * 6], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                return (
                  <div key={i} style={{ opacity: evOpacity, display: 'flex', gap: 12, padding: '8px 16px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: ev.sev, marginTop: 2 }} />
                      {i < 3 && <div style={{ width: 1, height: 22, background: T.cardBorder, marginTop: 2 }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: T.vdim, fontFamily: T.mono }}>{ev.t}</div>
                      <div style={{ fontSize: 11, color: T.text, fontFamily: T.font }}>{ev.e}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT: AI Engine */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card noPad style={{ flex: 1 }}>
            <CardHeader label="AI Classification Engine" right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.purple, boxShadow: `0 0 6px ${T.purple}` }} />
                <span style={{ fontSize: 10, color: T.purple, fontFamily: T.font }}>Active</span>
              </div>
            } />

            <div style={{ padding: '16px 20px' }}>
              {/* Analyzing bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: T.dim, fontFamily: T.font }}>
                    {frame < 50 ? 'Analyzing event stream...' : 'Analysis complete'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.purple, fontFamily: T.mono }}>
                    {Math.round(analyzeWidth)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 4, background: T.cardStrong, borderRadius: 2 }}>
                  <div style={{
                    height: 4, width: `${analyzeWidth}%`, borderRadius: 2,
                    background: `linear-gradient(90deg, ${T.purple}, ${T.blue})`,
                  }} />
                </div>
              </div>

              {/* Category breakdown */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.vdim, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 10 }}>
                  Root Cause Analysis
                </div>
                {CATEGORIES.map(({ cat, pct, label, highlight }, i) => {
                  const barW = interpolate(frame, [catBarsStart + i * 10, catBarsStart + i * 10 + 25], [0, pct], {
                    easing: Easing.out(Easing.cubic),
                    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                  });
                  const catOpacity = interpolate(frame, [catBarsStart + i * 10 - 5, catBarsStart + i * 10 + 5], [0, 1], {
                    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                  });
                  const color = CAT[cat];
                  return (
                    <div key={cat} style={{
                      opacity: catOpacity, marginBottom: 12,
                      padding: highlight ? '10px 12px' : '6px 0',
                      background: highlight ? `${color}12` : undefined,
                      border: highlight ? `1px solid ${color}25` : undefined,
                      borderRadius: highlight ? 8 : undefined,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: highlight ? color : T.dim, fontFamily: T.font }}>
                          {highlight && '⚡ '}{label}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: T.mono }}>{Math.round(barW)}%</span>
                      </div>
                      <div style={{ width: '100%', height: highlight ? 5 : 3, background: T.cardStrong, borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confidence score */}
              {frame >= confidencePopFrame && (
                <div style={{
                  transform: `scale(${confScale})`,
                  background: `${CAT['CASH_JAM']}15`, border: `1px solid ${CAT['CASH_JAM']}35`,
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confidence Score</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: CAT['CASH_JAM'], fontFamily: T.font, lineHeight: 1.1 }}>94.2%</div>
                    <div style={{ fontSize: 10, color: T.dim, fontFamily: T.font }}>High confidence · CASH_JAM confirmed</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>⚠️</div>
                    <Pill label="CASH_JAM" color={CAT['CASH_JAM']} />
                  </div>
                </div>
              )}

              {/* Recommended action */}
              {frame >= 110 && (
                <div style={{
                  opacity: actionOpacity, transform: `scale(${actionScale})`,
                  background: `${T.blue}10`, border: `1px solid ${T.blue}30`,
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: `${T.blue}20`, border: `1px solid ${T.blue}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>🔄</div>
                  <div>
                    <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recommended Action</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.blue, fontFamily: T.mono }}>RESTART_SERVICE</div>
                    <div style={{ fontSize: 10, color: T.dim, fontFamily: T.font }}>Auto-dispatching to ATM-009...</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
