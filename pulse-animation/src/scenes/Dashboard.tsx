import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { T, SEV } from '../tokens';
import { Card, CardHeader } from '../components/Card';
import { Pill } from '../components/Pill';
import { FadeSlide } from '../components/FadeSlide';
import { SceneLabel } from '../components/SceneLabel';

const ATMS = [
  { id: 'ATM-001', name: 'Koramangala Branch', health: 97, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-002', name: 'Indiranagar Hub', health: 91, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-003', name: 'Whitefield Node', health: 78, status: 'DEGRADED', sev: 'MEDIUM' },
  { id: 'ATM-004', name: 'HSR Layout', health: 95, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-005', name: 'Electronic City', health: 88, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-006', name: 'Jayanagar Branch', health: 62, status: 'DEGRADED', sev: 'HIGH' },
  { id: 'ATM-007', name: 'Bannerghatta Rd', health: 93, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-008', name: 'Marathahalli', health: 99, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-009', name: 'MG Road Branch', health: 0, status: 'OFFLINE', sev: 'CRITICAL', alert: true },
  { id: 'ATM-010', name: 'Cunningham Rd', health: 84, status: 'ONLINE', sev: 'LOW' },
  { id: 'ATM-011', name: 'Yelahanka', health: 72, status: 'DEGRADED', sev: 'MEDIUM' },
  { id: 'ATM-012', name: 'Bellandur', health: 96, status: 'ONLINE', sev: 'LOW' },
];

const HEALTH_COLOR = (h: number) => h >= 80 ? T.green : h >= 60 ? T.amber : T.red;
const STATUS_COLOR = (s: string) => s === 'ONLINE' ? T.green : s === 'DEGRADED' ? T.amber : T.red;

const PIPELINE_ROWS = [
  { level: 'CRITICAL', code: 'CASH_JAM_003', atm: 'ATM-009', time: '14:32:11' },
  { level: 'ERROR',    code: 'NETWORK_TIMEOUT', atm: 'ATM-006', time: '14:31:58' },
  { level: 'WARN',     code: 'CARD_READ_ERR', atm: 'ATM-003', time: '14:31:44' },
  { level: 'INFO',     code: 'DISPENSE_OK', atm: 'ATM-008', time: '14:31:33' },
  { level: 'INFO',     code: 'DISPENSE_OK', atm: 'ATM-001', time: '14:31:20' },
  { level: 'WARN',     code: 'LOW_CASH_WARN', atm: 'ATM-011', time: '14:31:09' },
];
const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: T.red, ERROR: T.orange, WARN: T.amber, INFO: T.blue,
};

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [165, 185], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // KPI counters
  const incCount = Math.floor(interpolate(frame, [5, 40], [0, 3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const healthVal = interpolate(frame, [10, 45], [0, 94.8], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const upiVal = interpolate(frame, [15, 50], [0, 97.3], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ATM-009 alert pulse at frame 110
  const alertPulse = frame >= 110 ? interpolate(
    (frame - 110) % 28, [0, 14, 28], [0.5, 1, 0.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ) : 0;

  // Alert banner
  const alertBannerOpacity = interpolate(frame, [112, 125], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const alertBannerY = interpolate(frame, [112, 125], [-16, 0], { easing: Easing.out(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      padding: '20px 32px', boxSizing: 'border-box', overflow: 'hidden',
      opacity: fadeOut,
    }}>
      <SceneLabel tag="Live Dashboard" title="Operations Center" />

      {/* Alert banner */}
      {frame >= 112 && (
        <div style={{
          position: 'absolute', top: 20, right: 32, zIndex: 20,
          opacity: alertBannerOpacity, transform: `translateY(${alertBannerY}px)`,
          background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          maxWidth: 360,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.red, boxShadow: `0 0 8px ${T.red}` }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.red, fontFamily: T.font }}>CRITICAL ALERT</div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.font }}>ATM-009 MG Road — Cash Jam Detected</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 90 }}>
        {/* KPI Strip */}
        <FadeSlide frame={frame} start={0} duration={20}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Open Incidents', value: String(incCount), color: incCount > 0 ? T.red : T.green, note: incCount > 0 ? 'Needs attention' : 'All clear' },
              { label: 'Platform Health', value: `${healthVal.toFixed(1)}%`, color: healthVal >= 90 ? T.green : T.amber, note: '24 ATMs monitored' },
              { label: 'UPI Success Rate', value: `${upiVal.toFixed(1)}%`, color: upiVal >= 95 ? T.green : T.amber, note: 'Last 24 hours' },
              { label: 'Active Anomalies', value: frame >= 110 ? '2' : '1', color: T.amber, note: 'AI monitoring' },
            ].map(({ label, value, color, note }) => (
              <Card key={label} style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: T.font, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>{note}</div>
                <div style={{ width: '100%', height: 2, background: T.cardStrong, borderRadius: 1, marginTop: 10 }}>
                  <div style={{ height: 2, width: `${Math.min(100, parseFloat(value) || 100)}%`, background: color, borderRadius: 1 }} />
                </div>
              </Card>
            ))}
          </div>
        </FadeSlide>

        {/* Main grid: ATMs + Pipeline */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
          {/* ATM Grid */}
          <Card noPad>
            <CardHeader label="Fleet Status" right={
              <div style={{ display: 'flex', gap: 8 }}>
                {[['21', T.green, 'Online'], ['2', T.amber, 'Degraded'], ['1', T.red, 'Offline']].map(([n, c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                    <span style={{ fontSize: 10, color: T.dim, fontFamily: T.font }}>{n} {l}</span>
                  </div>
                ))}
              </div>
            } />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
              {ATMS.map((atm, i) => {
                const cardOpacity = interpolate(frame, [20 + i * 3, 32 + i * 3], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                const hColor = HEALTH_COLOR(atm.health);
                const isAlert = atm.alert && frame >= 110;
                return (
                  <div key={atm.id} style={{
                    opacity: cardOpacity,
                    padding: '14px 16px',
                    borderRight: i % 4 !== 3 ? `1px solid ${T.cardBorder}` : undefined,
                    borderBottom: i < 8 ? `1px solid ${T.cardBorder}` : undefined,
                    background: isAlert ? `rgba(239,68,68,${0.06 + alertPulse * 0.04})` : undefined,
                    transition: 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isAlert ? T.red : T.text, fontFamily: T.mono }}>{atm.id}</span>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR(atm.status), boxShadow: isAlert ? `0 0 8px ${T.red}` : undefined }} />
                    </div>
                    <div style={{ fontSize: 10, color: T.dim, fontFamily: T.font, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{atm.name}</div>
                    {/* Health bar */}
                    <div style={{ width: '100%', height: 3, background: T.cardStrong, borderRadius: 2 }}>
                      <div style={{ height: 3, width: `${atm.health}%`, background: hColor, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isAlert ? T.red : hColor, fontFamily: T.font, marginTop: 4 }}>
                      {isAlert ? 'OFFLINE' : `${atm.health}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Live Pipeline */}
          <Card noPad>
            <CardHeader label="Live Pipeline" />
            <div>
              {PIPELINE_ROWS.map((row, i) => {
                const rowOpacity = interpolate(frame, [28 + i * 4, 40 + i * 4], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                return (
                  <div key={i} style={{
                    opacity: rowOpacity,
                    display: 'grid', gridTemplateColumns: '56px 1fr auto',
                    gap: '0 10px', padding: '10px 16px',
                    borderBottom: `1px solid rgba(255,255,255,0.04)`,
                    alignItems: 'center',
                    background: row.level === 'CRITICAL' && frame >= 110 ? 'rgba(239,68,68,0.05)' : undefined,
                  }}>
                    <Pill label={row.level} color={LEVEL_COLOR[row.level]} size="xs" />
                    <div>
                      <div style={{ fontSize: 11, fontFamily: T.mono, color: row.level === 'CRITICAL' ? T.red : T.text, fontWeight: row.level === 'CRITICAL' ? 700 : 400 }}>{row.code}</div>
                      <div style={{ fontSize: 10, color: T.vdim, fontFamily: T.font }}>{row.atm}</div>
                    </div>
                    <div style={{ fontSize: 9, color: T.vdim, fontFamily: T.mono }}>{row.time}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
