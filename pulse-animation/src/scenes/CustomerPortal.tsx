import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { T } from '../tokens';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { SceneLabel } from '../components/SceneLabel';

export const CustomerPortal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [155, 175], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phone slides in from right
  const phoneX = spring({ frame, fps, config: { stiffness: 160, damping: 24 }, from: 80, to: 0 });
  const phoneOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  // Left: feature description appears
  const leftOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const leftY = interpolate(frame, [15, 35], [18, 0], { easing: Easing.out(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // OTP dots appear
  const otpOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Status card reveals
  const statusIn = interpolate(frame, [50, 68], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const statusY = interpolate(frame, [50, 68], [20, 0], { easing: Easing.out(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Hindi text
  const hindiOpacity = interpolate(frame, [80, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // SMS notification
  const smsScale = spring({ frame: Math.max(0, frame - 100), fps, config: { stiffness: 200, damping: 20 }, from: 0.85, to: 1 });
  const smsOpacity = interpolate(frame, [100, 114], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Notification badge pulse
  const notifPulse = interpolate((frame - 104) % 24, [0, 12, 24], [1, 1.15, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      padding: '20px 32px', boxSizing: 'border-box',
      opacity: fadeOut,
    }}>
      <SceneLabel tag="Customer Portal" title="Transparent Transaction Status" />

      <div style={{ marginTop: 100, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, height: 'calc(100% - 130px)', alignItems: 'start' }}>

        {/* LEFT: Feature description */}
        <div style={{ opacity: leftOpacity, transform: `translateY(${leftY}px)` }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.text, fontFamily: T.font, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
              Customers Stay<br />
              <span style={{ color: T.gold }}>Informed, Always</span>
            </div>
            <div style={{ fontSize: 14, color: T.dim, fontFamily: T.font, lineHeight: 1.6, maxWidth: 480 }}>
              When an ATM fails, customers receive instant status updates — no confusion, no repeated visits. The portal shows real-time recovery status in English and Hindi.
            </div>
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { icon: '📱', label: 'OTP-secured portal', detail: 'No app download required' },
              { icon: '🔄', label: 'Real-time status updates', detail: 'WebSocket-powered live feed' },
              { icon: '🇮🇳', label: 'Bilingual — EN + HI', detail: '8 Indian languages supported' },
              { icon: '⚡', label: 'Instant SMS alerts', detail: 'When ATM is back online' },
            ].map(({ icon, label, detail }, i) => {
              const itemOpacity = interpolate(frame, [25 + i * 8, 38 + i * 8], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              return (
                <div key={label} style={{
                  opacity: itemOpacity,
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font }}>{label}</div>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.font }}>{detail}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SMS notification */}
          {frame >= 100 && (
            <div style={{
              opacity: smsOpacity, transform: `scale(${smsScale})`,
              background: 'rgba(34,197,94,0.07)', border: `1px solid rgba(34,197,94,0.25)`,
              borderRadius: 12, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 22, transform: `scale(${frame >= 104 ? notifPulse : 1})` }}>💬</div>
              <div>
                <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>SMS Alert Sent</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.green, fontFamily: T.font }}>
                  "MG Road ATM service restored. Your transaction can now be processed."
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Phone mockup */}
        <div style={{
          opacity: phoneOpacity,
          transform: `translateX(${phoneX}px)`,
          display: 'flex', justifyContent: 'center',
        }}>
          {/* Phone frame */}
          <div style={{
            width: 280, height: 560,
            background: '#111111',
            borderRadius: 40,
            border: '8px solid #1a1a1a',
            boxShadow: '0 30px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.06)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Notch */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 100, height: 26, background: '#111111', borderRadius: '0 0 14px 14px',
              zIndex: 10,
            }} />

            {/* Screen content */}
            <div style={{ width: '100%', height: '100%', background: '#0f0f14', overflow: 'hidden', padding: '36px 16px 20px', boxSizing: 'border-box' }}>

              {/* Top bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.gold, fontFamily: T.font }}>PayGuard</span>
                <span style={{ fontSize: 9, color: T.vdim, fontFamily: T.font }}>14:36 ●●●●</span>
              </div>

              {/* Page title */}
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>Transaction Status</div>
              <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, marginBottom: 14 }}>MG Road Branch, Bengaluru</div>

              {/* OTP section */}
              <div style={{ opacity: otpOpacity }}>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: T.vdim, fontFamily: T.font, marginBottom: 6 }}>Verified via OTP ✓</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['9', '8', '7', '2', '3', '4'].map((d, i) => (
                      <div key={i} style={{
                        width: 26, height: 28, borderRadius: 5,
                        background: T.cardStrong, border: `1px solid ${T.cardBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: T.gold, fontFamily: T.mono,
                      }}>{d}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status card */}
              <div style={{
                opacity: statusIn, transform: `translateY(${statusY}px)`,
                background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 10, padding: '12px',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.green, fontFamily: T.font }}>✓ Service Restored</span>
                  <span style={{ fontSize: 9, color: T.vdim, fontFamily: T.mono }}>14:32</span>
                </div>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: T.font, lineHeight: 1.5 }}>
                  ATM at MG Road is back online. Cash dispenser has been repaired automatically.
                </div>
              </div>

              {/* Hindi text */}
              <div style={{ opacity: hindiOpacity }}>
                <div style={{
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 9, color: T.vdim, fontFamily: T.font, marginBottom: 4 }}>हिन्दी</div>
                  <div style={{ fontSize: 12, color: T.text, fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                    MG रोड ATM की सेवा बहाल हो गई है।
                  </div>
                  <div style={{ fontSize: 10, color: T.dim, fontFamily: 'sans-serif', marginTop: 2 }}>
                    आप अब अपना लेनदेन कर सकते हैं।
                  </div>
                </div>
              </div>

              {/* Failure type badge */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', opacity: statusIn }}>
                <Pill label="Cash Jam" color={T.amber} size="xs" />
                <Pill label="Auto-Resolved" color={T.green} size="xs" />
                <Pill label="4.2s" color={T.blue} size="xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
