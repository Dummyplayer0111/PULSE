import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { store } from './src/store';
import { setAuth } from './src/store/authSlice';
import Layout              from './src/components/Layout';
import Dashboard           from './src/pages/Dashboard';
import ATMMapPage          from './src/pages/ATMMap';
import ATMDetail           from './src/pages/ATMDetail';
import Incidents           from './src/pages/Incidents';
import AIAnalysis          from './src/pages/AIAnalysis';
import Anomaly             from './src/pages/Anomaly';
import Communications      from './src/pages/Communications';
import Settings            from './src/pages/Settings';
import Logs                from './src/pages/Logs';
import EngineerDashboard   from './src/pages/EngineerDashboard';
import { Brain, Zap, ShieldAlert, Globe, Activity, TrendingUp, ArrowRight, ChevronRight, Home, LogIn } from 'lucide-react';

// ─── GLOW CARD (Stripe-style hover) ──────────────────────────────────────────
function GlowCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [on, setOn]   = useState(false);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`} style={style}
      onMouseMove={e => { if (!ref.current) return; const r = ref.current.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}>
      {/* Stripe spotlight glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ transition: 'opacity .45s', opacity: on ? 1 : 0, zIndex: 1,
        background: on ? `radial-gradient(650px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.10) 0%, transparent 65%)` : 'none' }} />
      {/* Liquid glass specular top edge */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height:'1px', background:'linear-gradient(90deg,transparent 5%,rgba(255,255,255,0.11) 50%,transparent 95%)', zIndex:2 }} />
      {children}
    </div>
  );
}

// ─── FINTECH BG ICON ─────────────────────────────────────────────────────────
function FintechBgSVG({ type, size, rotate, opacity }: { type: string; size: number; rotate: number; opacity: number }) {
  const p = (d: string) => <path d={d} />;
  const icons: Record<string, React.ReactNode> = {
    card: <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/><line x1="14" y1="15" x2="18" y2="15"/></>,
    wifi: <>{p('M5 12.55a11 11 0 0 1 14.08 0')}{p('M1.42 9a16 16 0 0 1 21.16 0')}{p('M8.53 16.11a6 6 0 0 1 6.95 0')}<circle cx="12" cy="20" r="1" fill={`rgba(255,255,255,${opacity})`}/></>,
    trend: <>{p('M23 6l-9.5 9.5-5-5L1 18')}{p('M17 6h6v6')}</>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/>{p('M7 11V7a5 5 0 0 1 10 0v4')}</>,
    shield: p('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
    db: <><ellipse cx="12" cy="5" rx="9" ry="3"/>{p('M21 12c0 1.66-4 3-9 3s-9-1.34-9-3')}{p('M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5')}</>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    ekg: p('M22 12h-4l-3 9L9 3l-3 9H2'),
    cpu: <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="14" x2="22" y2="14"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="14" x2="4" y2="14"/></>,
    globe: <><circle cx="12" cy="12" r="10"/>{p('M2 12h20')}{p('M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z')}</>,
    zap: p('M13 2L3 14h9l-1 8 10-12h-9l1-8z'),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={`rgba(255,255,255,${opacity})`} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)`, display: 'block' }}>
      {icons[type] ?? icons.card}
    </svg>
  );
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CARDS = [
  { id: 1, balance: '₹2,000.00', last4: '2048' },
  { id: 2, balance: '₹6,300.50', last4: '7731' },
  { id: 3, balance: '₹1,000.00', last4: '4412' },
  { id: 4, balance: '₹3,000.00', last4: '9923' },
  { id: 5, balance: '₹6,205.30', last4: '6614' },
  { id: 6, balance: '₹5,200.50', last4: '1187' },
  { id: 7, balance: '₹4,500.00', last4: '3356' },
];

const FEATURES = [
  { Icon: Brain,       title: 'AI Root Cause Analysis',    desc: 'scikit-learn classifier identifies failure root cause from raw log text — 94% accuracy across 8 categories in milliseconds.' },
  { Icon: Zap,         title: 'Self-Healing Engine',        desc: 'Automated remediation restarts services, switches networks, reroutes traffic, and freezes compromised ATMs with full audit trails.' },
  { Icon: ShieldAlert, title: 'Anomaly Detection',          desc: 'Z-score statistical analysis flags card skimming, malware patterns, and rapid failure bursts before they escalate to incidents.' },
  { Icon: Globe,       title: 'Multilingual Alerts',        desc: '8 Indian languages × 5 incident types = 40 templates. Auto-selects customer language. SMS and WhatsApp delivery via Twilio.' },
  { Icon: Activity,    title: 'Real-Time WebSocket',        desc: 'Live incident feed and per-ATM log streaming via Django Channels. Sub-second latency updates pushed to every connected dashboard.' },
  { Icon: TrendingUp,  title: 'Predictive Failure Scoring', desc: 'Health trend analysis flags ATMs predicted to fail in the next 24 hours with confidence probability and rate-of-decline metrics.' },
];

const STATS = [
  { value: '20+',   label: 'ATMs Monitored',   sub: 'Across 6 Indian cities' },
  { value: '97.3%', label: 'UPI Uptime',        sub: 'Real-time health scoring' },
  { value: '94%',   label: 'AI Accuracy',       sub: 'Root cause classification' },
  { value: '8',     label: 'Indian Languages',  sub: 'Multilingual customer alerts' },
];

const LANGUAGES = [
  { code: 'en', native: 'English',  name: 'English'  },
  { code: 'hi', native: 'हिन्दी',   name: 'Hindi'    },
  { code: 'ta', native: 'தமிழ்',    name: 'Tamil'    },
  { code: 'te', native: 'తెలుగు',   name: 'Telugu'   },
  { code: 'kn', native: 'ಕನ್ನಡ',    name: 'Kannada'  },
  { code: 'mr', native: 'मराठी',    name: 'Marathi'  },
  { code: 'bn', native: 'বাংলা',    name: 'Bengali'  },
  { code: 'gu', native: 'ગુજરાતી',  name: 'Gujarati' },
];

const LIVE_LOGS = [
  { time: '05:18:46', atm: 'ATM-MUM-001', level: 'INFO',     msg: 'CASH_DISPENSE_OK'       },
  { time: '05:18:47', atm: 'ATM-DEL-003', level: 'ERROR',    msg: 'NETWORK_TIMEOUT'        },
  { time: '05:18:48', atm: 'ATM-BLR-003', level: 'CRITICAL', msg: 'MALWARE_SIGNATURE'      },
  { time: '05:18:49', atm: 'ATM-MUM-002', level: 'WARN',     msg: 'NETWORK_LATENCY_HIGH'   },
  { time: '05:18:50', atm: 'ATM-CHN-001', level: 'INFO',     msg: 'CARD_READ_SUCCESS'      },
  { time: '05:18:51', atm: 'ATM-MUM-004', level: 'ERROR',    msg: 'CASH_DISPENSE_FAIL'     },
  { time: '05:18:52', atm: 'ATM-HYD-002', level: 'CRITICAL', msg: 'HARDWARE_JAM'           },
  { time: '05:18:53', atm: 'ATM-DEL-001', level: 'INFO',     msg: 'CARD_READ_SUCCESS'      },
  { time: '05:18:54', atm: 'ATM-BLR-001', level: 'WARN',     msg: 'NETWORK_LATENCY_HIGH'   },
  { time: '05:18:55', atm: 'ATM-PUN-002', level: 'INFO',     msg: 'CASH_DISPENSE_OK'       },
];

const TICKER = [
  'PULSE OPERATIONS CENTER','20 ATMs Online','AI Root Cause Analysis',
  'Self-Healing Automation','Real-Time WebSocket','8 Indian Languages',
  '97.3% UPI Uptime','Predictive Failure Scoring','Anomaly Detection',
  'Django + React','scikit-learn Classifier','Zero Downtime',
];

const TERMINAL = [
  { t: 'cmd', v: '> Ingesting: [05:18:48] ATM-BLR-003 MALWARE_SIGNATURE' },
  { t: 'out', v: '  Classifier  : FRAUD  (97% confidence)' },
  { t: 'out', v: '  Action      : Freeze ATM + Alert Security' },
  { t: 'div', v: '' },
  { t: 'cmd', v: '> Incident INC-2026-003 created' },
  { t: 'out', v: '  Severity    : CRITICAL' },
  { t: 'out', v: '  Status      : ESCALATED → Security Team' },
  { t: 'div', v: '' },
  { t: 'cmd', v: '> Self-heal: FREEZE_ATM triggered' },
  { t: 'ok',  v: '  ✓ ATM frozen in 0.4s' },
  { t: 'ok',  v: '  ✓ Security team notified via SMS' },
  { t: 'div', v: '' },
  { t: 'cmd', v: '> Customer notification dispatch' },
  { t: 'ok',  v: '  ✓ Delivered in Kannada (WhatsApp) +91 98xxx xxxx' },
];

// 18 fintech bg icons scattered across hero: [type, left%, top%, size, rotation, opacity]
const BG_ICONS: [string, number, number, number, number, number][] = [
  ['card',   4,   6,  100, -22, 0.09 ],
  ['card',  72,  10,   82,  18, 0.075],
  ['card',  45,  78,   70, -12, 0.065],
  ['wifi',   2,  42,   58,   0, 0.085],
  ['wifi',  82,  55,   45,  15, 0.065],
  ['trend', 18,  65,   70,   8, 0.075],
  ['trend', 88,  72,   65, -10, 0.065],
  ['lock',  26,  15,   52, -12, 0.085],
  ['lock',  68,  82,   42,  20, 0.065],
  ['shield',90,  28,   58,  15, 0.075],
  ['shield',10,  85,   45, -18, 0.055],
  ['db',    50,   4,   65,  -5, 0.09 ],
  ['db',    35,  58,   48,  10, 0.065],
  ['chart', 95,  10,   58, -18, 0.085],
  ['chart', 60,  90,   52,   5, 0.055],
  ['ekg',   92,  50,   58,   3, 0.065],
  ['cpu',   75,  42,   55, -25, 0.075],
  ['globe',  0,  22,   65,  10, 0.065],
  ['zap',   55,  22,   45, -15, 0.085],
  ['cpu',   20,  38,   42,  30, 0.055],
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function useInViewOnce(ref: React.RefObject<Element>) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return v;
}

// ─── FLOATING NAV ─────────────────────────────────────────────────────────────
const FLOAT_NAV = [
  { id: 'hero',         label: 'Home',      Icon: Home       },
  { id: 'features',    label: 'Features',  Icon: Zap        },
  { id: 'ai-engine',   label: 'AI Engine', Icon: Brain      },
  { id: 'live-feed',   label: 'Live Feed', Icon: Activity   },
  { id: 'multilingual',label: 'Languages', Icon: Globe      },
  { id: 'workflow',    label: 'Workflow',  Icon: TrendingUp },
];

// Vibrant gold conic ring — richer bright peaks
// Premium warm amber gold — no yellow, rich cognac like 18k gold
// Exact spec colors: 70% gold (#533517→#c49746→#feeaa5), 2 white hotspots ~3%, thin pink+blue iridescence ~1.5% each
const GOLD_CONIC = `conic-gradient(from 0deg,#533517 0%,#7b5422 5%,#c49746 17%,#edcb6a 25%,#feeaa5 33%,#f5d060 35.5%,#ffffff 37%,#fff5e0 38%,#ffc0cb 39% ,#b8d8e8 40.5%,#feeaa5 42%,#edcb6a 48%,#c49746 57%,#7b5422 66%,#533517 70%,#7b5422 75%,#c49746 82%,#feeaa5 87%,#f5d060 88.5%,#ffffff 90%,#fff5e0 91%,#ffc0cb 92%,#b8d8e8 93.5%,#feeaa5 95%,#c49746 98%,#533517 100%)`;
// Uniform ring variant — minimum stop is bright gold so no dark gaps appear on any button shape
const RING_CONIC = `conic-gradient(from 0deg,#e0a030 0%,#edcb6a 14%,#feeaa5 26%,#f5d060 31%,#ffffff 33%,#feeaa5 35%,#edcb6a 44%,#e0a030 50%,#edcb6a 64%,#feeaa5 76%,#f5d060 81%,#ffffff 83%,#feeaa5 85%,#edcb6a 94%,#e0a030 100%)`;

function FloatingNav() {
  const [activeId, setActiveId] = useState('hero');
  const [tooltip,  setTooltip]  = useState<string | null>(null);

  // Track which section is in the center viewport
  useEffect(() => {
    const observers = FLOAT_NAV.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id); },
        { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  // Scroll to section with nav-height offset (76px pill height + 14px gap = ~90px)
  const scrollTo = (id: string) => {
    if (id === 'hero') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 82;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div style={{
      position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
      zIndex: 60, pointerEvents: 'auto',
    }}>
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '9px 14px',
          borderRadius: 70,
          background: 'rgba(10,10,12,0.88)',
          backdropFilter: 'blur(56px) saturate(220%)',
          WebkitBackdropFilter: 'blur(56px) saturate(220%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}
      >
        {/* film grain */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 20,
          opacity: .025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '128px',
        }} />

        {/* PULSE wordmark — clicking returns to top */}
        <button onClick={() => scrollTo('hero')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 14px 0 8px',
          fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.03em',
          color: '#feeaa5', position: 'relative', zIndex: 5, fontFamily: 'inherit',
          lineHeight: 1, transition: 'opacity 0.2s',
          textShadow: '0 0 18px rgba(196,151,70,0.45)',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.78'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          PULSE
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 6px', flexShrink: 0 }} />

        {/* Section icon buttons */}
        {FLOAT_NAV.map(({ id, label, Icon }) => {
          const isActive = activeId === id;
          return (
            <div key={id} style={{ position: 'relative' }}
              onMouseEnter={() => setTooltip(label)}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Tooltip — BELOW since nav is at top */}
              {tooltip === label && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14 }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(12,12,14,0.96)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '4px 10px',
                    fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.62)',
                    letterSpacing: '0.04em', whiteSpace: 'nowrap', pointerEvents: 'none',
                    backdropFilter: 'blur(12px)', zIndex: 99,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
                  }}
                >
                  {label}
                </motion.div>
              )}
              {/* Button wrapper — ring renders inside here */}
              <div style={{ position: 'relative', width: 46, height: 46 }}>
                {/* 4-layer gold ring active indicator — slides via layoutId */}
                {isActive && (
                  <motion.div
                    layoutId="gold-ring"
                    transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: 20, zIndex: 1 }}
                  >
                    {/* L1 glow — exact spec: #e8af48, opacity 0.15, blurred */}
                    <div aria-hidden style={{ position:'absolute', inset:'-4px', borderRadius:24, background:'#e8af48', opacity:.15, filter:'blur(8px)', pointerEvents:'none' }} />
                    {/* L2 clip container — overflow hidden clips the spinning gradient */}
                    <div aria-hidden style={{ position:'absolute', inset:0, borderRadius:20, overflow:'hidden', pointerEvents:'none' }}>
                      {/* L3 spinning conic — 200% sized, -50% offset, 4.5s linear */}
                      <div style={{ position:'absolute', width:'200%', height:'200%', top:'-50%', left:'-50%', animation:'spin-gold 4.5s linear infinite', background: RING_CONIC }} />
                    </div>
                    {/* L4 inner plate — inset 2px, only 2px gold ring visible */}
                    <div aria-hidden style={{ position:'absolute', inset:'2px', borderRadius:18, background:'rgba(10,10,12,0.95)', pointerEvents:'none' }} />
                  </motion.div>
                )}
                <motion.button
                  onClick={() => scrollTo(id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 440, damping: 18 }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 20,
                    border: 'none', background: 'transparent',
                    color: isActive ? '#feeaa5' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'color 0.2s', zIndex: 2,
                  }}
                >
                  <Icon size={17} />
                </motion.button>
              </div>
            </div>
          );
        })}

        {/* Right divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 6px', flexShrink: 0 }} />

        {/* Login — liquid gold ring */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          {/* outer glow */}
          <div aria-hidden style={{
            position: 'absolute', inset: '-4px', borderRadius: 32,
            background: '#e8af48', opacity: .18, filter: 'blur(10px)',
            animation: 'ring-breathe 2.8s ease-in-out infinite', pointerEvents: 'none',
          }} />
          {/* clip */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%',
              animation: 'spin-gold 4.5s linear infinite',
              background: GOLD_CONIC,
            }} />
          </div>
          {/* inner plate */}
          <div aria-hidden style={{ position: 'absolute', inset: '2px', borderRadius: 22, background: 'rgba(10,10,12,0.95)', pointerEvents: 'none' }} />
          <Link to="/login" style={{
            position: 'relative', zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.88rem', fontWeight: 700,
            padding: '11px 22px', borderRadius: 24,
            color: '#feeaa5', textDecoration: 'none', letterSpacing: '0.02em',
          }}>
            <LogIn size={15} />
            Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
function LandingPage() {
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isLoaded,     setIsLoaded]     = useState(false);
  const [termLine,     setTermLine]     = useState(0);

  const statsRef  = useRef<HTMLDivElement>(null);
  const statsIn   = useInViewOnce(statsRef as React.RefObject<Element>);

  useEffect(() => { const t = setTimeout(() => setIsLoaded(true), 100); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (!isLoaded || hoveredIndex !== null) return;
    const to = setTimeout(() => {
      const iv = setInterval(() => setActiveIndex(c => (c + 1) % CARDS.length), 5500);
      return () => clearInterval(iv);
    }, 800);
    return () => clearTimeout(to);
  }, [isLoaded, hoveredIndex]);

  useEffect(() => {
    if (termLine >= TERMINAL.length) return;
    const t = setTimeout(() => setTermLine(l => l + 1), 360);
    return () => clearTimeout(t);
  }, [termLine]);

  return (
    <div className="font-sans overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      <style>{`
        @keyframes marquee      { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes scrollUp     { from{transform:translateY(0)} to{transform:translateY(-50%)} }
        @keyframes blink        { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pdot         { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.85;transform:scale(1.2)} }
        @keyframes bgf1         { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-18px)} }
        @keyframes bgf2         { 0%,100%{transform:translateY(-10px)} 50%{transform:translateY(12px)} }
        @keyframes bgf3         { 0%,100%{transform:translateY(5px)} 50%{transform:translateY(-15px)} }
        @keyframes bgrot        { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sd1 { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(320px,260px) rotate(24deg)} }
        @keyframes sd2 { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(-280px,300px) rotate(-20deg)} }
        @keyframes sd3 { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(260px,-300px) rotate(30deg)} }
        @keyframes sd4 { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(-300px,-240px) rotate(-26deg)} }
        @keyframes sd5 { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(340px,200px) rotate(18deg)} }
        @keyframes sd6 { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(220px,-320px) rotate(-22deg)} }
        @keyframes cardshine    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes liquidFlow   { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
        @keyframes glassShimmer { 0%,100%{opacity:0} 50%{opacity:1} }
        @keyframes glowPulse    { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes borderGlow   { 0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 0 0 0px rgba(255,255,255,0)} 50%{box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),0 0 0 2px rgba(255,255,255,0.04)} }
        @keyframes goldOrb      { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
        @keyframes goldPdot     { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.35)} }
        @keyframes goldCardFlow { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
        @keyframes spin-gold    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ring-breathe { 0%,100%{opacity:.13} 50%{opacity:.24} }
        @keyframes bounce-login { 0%{transform:scale(1)} 38%{transform:scale(1.25)} 68%{transform:scale(.91)} 88%{transform:scale(1.05)} 100%{transform:scale(1)} }
        .mq           { animation: marquee      28s linear infinite; }
        .logsup       { animation: scrollUp     22s linear infinite; }
        .blinker      { animation: blink        1s step-end infinite; }
        .pdot         { animation: pdot         2s ease-in-out infinite; }
        .bgf1         { animation: bgf1         9s ease-in-out infinite; }
        .bgf2         { animation: bgf2         12s ease-in-out infinite 2s; }
        .bgf3         { animation: bgf3         15s ease-in-out infinite 4s; }
        .bgspin       { animation: bgrot        50s linear infinite; }
        .sd1 { animation: sd1 32s linear infinite; }
        .sd2 { animation: sd2 40s linear infinite 6s; }
        .sd3 { animation: sd3 27s linear infinite 12s; }
        .sd4 { animation: sd4 36s linear infinite 3s; }
        .sd5 { animation: sd5 44s linear infinite 18s; }
        .sd6 { animation: sd6 30s linear infinite 9s; }
        .shine        { background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.06) 50%, transparent 80%);
                        background-size: 200% 100%; animation: cardshine 2.8s cubic-bezier(0.4,0,0.2,1) infinite; }
        .liquid-shine { background: linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.09) 45%, rgba(255,255,255,0.04) 55%, transparent 85%);
                        background-size: 300% 100%; animation: liquidFlow 3.5s cubic-bezier(0.4,0,0.2,1) infinite; }
        .glass-shimmer { animation: glassShimmer 5s ease-in-out infinite; }
        .glow-pulse   { animation: goldOrb  3.5s ease-in-out infinite; }
        .gold-pdot    { animation: goldPdot 2.2s ease-in-out infinite; }
        .gold-flow    { background: linear-gradient(105deg,transparent 15%,rgba(200,134,42,0.16) 45%,rgba(232,168,64,0.09) 55%,transparent 85%); background-size:300% 100%; animation:goldCardFlow 3.8s cubic-bezier(0.4,0,0.2,1) infinite; }
        .border-glow  { animation: borderGlow 4s ease-in-out infinite; }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden" style={{ paddingTop: 'clamp(80px,7vw,100px)', background: '#000' }}>



        {/* Fintech space-drift background icons */}
        {BG_ICONS.map(([type, lft, top, size, rot, op], i) => (
          <div key={i} className="absolute pointer-events-none" style={{ left: `${lft}%`, top: `${top}%` }}>
            <div className={`sd${(i % 6) + 1}`}>
              <FintechBgSVG type={type} size={size} rotate={rot} opacity={op} />
            </div>
          </div>
        ))}

        <div className="relative max-w-screen-xl mx-auto w-full px-8 md:px-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-14 items-center py-10">
          {/* Left */}
          <div className="flex flex-col" style={{ gap: 'clamp(1.1rem,1.75vw,1.75rem)' }}>
            <motion.h1 initial={{ opacity:0,y:36 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.9, ease:[0.16,1,0.3,1], delay:0.15 }}
              className="font-black" style={{ fontSize:'clamp(2rem,5vw,6.5rem)', lineHeight:0.88, letterSpacing:'-0.03em' }}>
              <span style={{ display:'block', whiteSpace:'nowrap' }}>All Your</span>
              <span style={{ display:'block' }}>ATMs.</span>
              <span style={{ display:'block', color:'rgba(196,151,70,0.65)' }}>Total Control.</span>
            </motion.h1>

            <motion.p initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.7, delay:0.3 }}
              className="leading-relaxed" style={{ color:'rgba(255,255,255,0.48)', fontSize:'clamp(1.1rem,1.6vw,1.35rem)', maxWidth:'42ch' }}>
              Monitor, manage, and auto-resolve every terminal failure.
              AI-powered root cause analysis. Real-time incident response.
              Zero downtime tolerance.
            </motion.p>

            <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.6, delay:0.4 }}
              className="flex flex-wrap gap-2.5">
              {['AI Root Cause','Anomaly Detection','Self-Healing','Multilingual Alerts','Real-Time WebSocket'].map((t,i) => (
                <motion.span key={t}
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                  transition={{ duration:0.5, delay:0.42+i*0.06, ease:[0.16,1,0.3,1] }}
                  whileHover={{ scale:1.04, backgroundColor:'rgba(196,151,70,0.13)', borderColor:'rgba(232,175,72,0.45)' }}
                  className="font-medium rounded-full cursor-default"
                  style={{ border:'1px solid rgba(196,151,70,0.22)', color:'rgba(196,151,70,0.88)', background:'rgba(196,151,70,0.07)', fontSize:'clamp(0.82rem,1vw,0.95rem)', padding:'0.55rem 1.3rem', backdropFilter:'blur(8px)', transition:'color 0.25s ease,border-color 0.25s ease,background 0.25s ease' }}>
                  {t}
                </motion.span>
              ))}
            </motion.div>

            <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.5, delay:0.52 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Access Platform CTA — spinning liquid gold ring */}
              <motion.div
                whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
                transition={{ type:'spring', stiffness:300, damping:22 }}
                style={{ position:'relative', display:'inline-block' }}
              >
                {/* L1 — outer glow */}
                <div aria-hidden style={{ position:'absolute', inset:'-6px', borderRadius:48, background:'#e8af48', opacity:.16, filter:'blur(14px)', animation:'ring-breathe 2.8s ease-in-out infinite', pointerEvents:'none' }} />
                {/* L2 — clip container */}
                <div aria-hidden style={{ position:'absolute', inset:0, borderRadius:38, overflow:'hidden', pointerEvents:'none' }}>
                  {/* L3 — spinning conic */}
                  <div style={{ position:'absolute', width:'200%', height:'200%', top:'-50%', left:'-50%', animation:'spin-gold 4.5s linear infinite', background: RING_CONIC }} />
                </div>
                {/* L4 — inner plate */}
                <div aria-hidden style={{ position:'absolute', inset:'2px', borderRadius:36, background:'rgba(10,10,12,0.94)', pointerEvents:'none' }} />
                <Link to="/login"
                  className="relative flex items-center gap-3 font-bold group overflow-hidden"
                  style={{ position:'relative', zIndex:5, fontSize:'clamp(1rem,1.3vw,1.15rem)', padding:'clamp(1rem,1.4vw,1.25rem) clamp(2.2rem,3vw,3rem)', borderRadius:36, color:'#feeaa5', textDecoration:'none', letterSpacing:'0.01em', transition:'color 0.2s' }}>
                  <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)' }} />
                  Access Platform <ArrowRight size={18} style={{ transition:'transform 0.3s cubic-bezier(0.16,1,0.3,1)' }} className="group-hover:translate-x-2" />
                </Link>
              </motion.div>
              <span className="font-mono" style={{ color:'rgba(255,255,255,0.28)', fontSize:'clamp(0.88rem,1.05vw,1rem)' }}>
                20 ATMs · 6 Cities · Live Now
              </span>
            </motion.div>
          </div>

          {/* Right — Card Stack */}
          <div className="relative flex items-center justify-center" style={{ height:'clamp(340px,34vw,450px)' }}>
            {/* Central glow behind stack */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="glow-pulse" style={{ width:380, height:380, background:'radial-gradient(circle,rgba(196,151,70,0.13) 0%,rgba(83,53,23,0.06) 45%,transparent 68%)', filter:'blur(55px)' }} />
            </div>
            <div className="relative w-full h-full flex items-center justify-center" style={{ perspective:'1000px', paddingLeft:'clamp(40px,6vw,90px)' }}>
              {CARDS.map((card, index) => {
                const isActive  = index === activeIndex;
                const isHovered = index === hoveredIndex;
                const ox = (index - 3) * -16;
                const oy = (index - 3) *  17;
                const xPos  = isActive ? ox - 22 : isHovered ? ox - 10 : ox;
                const yPos  = isActive ? oy - 22 : isHovered ? oy - 10 : oy;
                const scale = isActive ? 1.08 : isHovered ? 1.04 : 1;
                const br    = isActive ? '24px' : isHovered ? '22px' : '16px';
                let shadow  = '0 6px 24px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)';
                if (isActive)  shadow = '0 28px 64px rgba(196,151,70,0.22), 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(196,151,70,0.55), inset 0 1px 0 rgba(196,151,70,0.28)';
                else if (isHovered) shadow = '0 18px 40px rgba(196,151,70,0.12), 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(196,151,70,0.12)';
                const W = 'clamp(260px,27vw,360px)';
                const H = 'clamp(164px,17vw,225px)';

                return (
                  <motion.div key={card.id}
                    className="absolute border flex flex-col justify-between cursor-pointer"
                    style={{ zIndex: index, willChange:'transform,opacity,box-shadow,border-radius', width: W, height: H, padding:'clamp(1.1rem,1.6vw,1.5rem)', backdropFilter:'blur(32px) saturate(200%) brightness(1.05)', WebkitBackdropFilter:'blur(32px) saturate(200%) brightness(1.05)' }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setActiveIndex(index)}
                    initial={{ opacity:0, x:ox-80, y:oy+80, skewY:13, scale:0.78, borderRadius:'16px' }}
                    animate={{
                      opacity:1, x:xPos, y:yPos, skewY:13, scale, borderRadius: br,
                      backgroundColor: isActive ? 'rgba(20,14,5,0.97)' : isHovered ? 'rgba(18,12,4,0.9)' : 'rgba(10,10,12,0.82)',
                      borderColor: isActive ? 'rgba(196,151,70,0.85)' : isHovered ? 'rgba(196,151,70,0.28)' : 'rgba(255,255,255,0.09)',
                      boxShadow: shadow,
                    }}
                    transition={{
                      type:'spring', stiffness:42, damping:28, mass:1.4,
                      delay:!isLoaded?index*0.09:0,
                      backgroundColor:{ duration:0.85, ease:[0.16,1,0.3,1] },
                      borderColor:{ duration:0.75, ease:[0.16,1,0.3,1] },
                      boxShadow:{ duration:0.85, ease:[0.16,1,0.3,1] },
                    }}>

                    {/* Liquid shine — fades in/out smoothly */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          key="gold-flow"
                          className="absolute inset-0 pointer-events-none gold-flow"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                          style={{ borderRadius:'24px' }}
                        />
                      )}
                    </AnimatePresence>
                    {/* Hover shimmer layer */}
                    {isHovered && !isActive && <div className="absolute inset-0 pointer-events-none" style={{ borderRadius:'22px', background:'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.02) 100%)' }} />}
                    {/* Glass specular top edge */}
                    <div className="absolute inset-x-4 top-0 pointer-events-none" style={{ height:'1px', background: isActive ? 'linear-gradient(90deg,transparent,rgba(196,151,70,0.38),transparent)' : isHovered ? 'linear-gradient(90deg,transparent,rgba(196,151,70,0.22),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)', zIndex:10, transition:'background 0.4s ease' }} />
                    {/* Glass specular left edge */}
                    <div className="absolute inset-y-4 left-0 pointer-events-none" style={{ width:'1px', background: isActive ? 'transparent' : 'linear-gradient(180deg,rgba(255,255,255,0.12),transparent,transparent)', zIndex:10 }} />

                    <motion.div className="flex flex-col justify-between h-full"
                      initial={{ opacity:0 }}
                      animate={{ opacity:1 }}
                      transition={{ duration:1.1, ease:[0.16,1,0.3,1], delay:!isLoaded?index*0.09+0.35:0.15 }}>

                      {/* Top row */}
                      <div className="flex items-start justify-between">
                        <motion.span className="font-black tracking-tight"
                          animate={{ color: isActive ? '#feeaa5' : 'rgba(255,255,255,0.38)' }}
                          transition={{ duration:1.1, ease:[0.16,1,0.3,1], delay: isActive ? 0.25 : 0 }}
                          style={{ fontSize:'clamp(0.78rem,1.1vw,1rem)' }}>
                          PULSE
                        </motion.span>
                        <div className="flex gap-1.5">
                          {[0,1].map(j => (
                            <motion.div key={j} className="rounded-sm border"
                              animate={{ borderColor: isActive ? 'rgba(196,151,70,0.4)' : 'rgba(255,255,255,0.16)' }}
                              transition={{ duration:1.1, ease:[0.16,1,0.3,1], delay: isActive ? 0.25 : 0 }}
                              style={{ width:'clamp(16px,1.8vw,22px)', height:'clamp(16px,1.8vw,22px)' }} />
                          ))}
                        </div>
                      </div>

                      {/* Balance — center, delayed so it glows after card settles */}
                      <motion.div className="font-black tracking-tight"
                        animate={{ color: isActive ? '#feeaa5' : '#ffffff' }}
                        transition={{ duration:1.3, ease:[0.16,1,0.3,1], delay: isActive ? 0.3 : 0 }}
                        style={{ fontSize:'clamp(1.45rem,2.7vw,2.7rem)', letterSpacing:'-0.03em' }}>
                        {card.balance}
                      </motion.div>

                      {/* Bottom row */}
                      <div className="flex items-end justify-between">
                        <motion.span className="font-mono tracking-[0.22em]"
                          animate={{ color: isActive ? 'rgba(196,151,70,0.75)' : 'rgba(255,255,255,0.2)' }}
                          transition={{ duration:1.1, ease:[0.16,1,0.3,1], delay: isActive ? 0.28 : 0 }}
                          style={{ fontSize:'clamp(0.62rem,0.9vw,0.82rem)' }}>
                          •••• •••• •••• {card.last4}
                        </motion.span>
                        <motion.span className="font-bold"
                          animate={{ color: isActive ? 'rgba(196,151,70,0.65)' : 'rgba(255,255,255,0.18)' }}
                          transition={{ duration:1.1, ease:[0.16,1,0.3,1], delay: isActive ? 0.28 : 0 }}
                          style={{ fontSize:'clamp(0.58rem,0.85vw,0.78rem)', letterSpacing:'0.1em' }}>
                          VISA
                        </motion.span>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="font-mono tracking-[0.25em] text-xs" style={{ color:'rgba(196,151,70,0.35)' }}>SCROLL</span>
          <div className="w-px h-10" style={{ background:'linear-gradient(to bottom,rgba(196,151,70,0.35),transparent)' }} />
        </div>
      </section>

      {/* ── TICKER ──────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden" style={{ background:'#090909', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'1rem 0' }}>
        <div className="flex gap-12 mq whitespace-nowrap" style={{ width:'max-content' }}>
          {[...TICKER,...TICKER].map((item, i) => (
            <span key={i} className="flex items-center gap-4 font-mono tracking-[0.2em] uppercase" style={{ color:'rgba(255,255,255,0.25)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)' }}>
              {item}<span style={{ color:'rgba(196,151,70,0.35)' }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ───────────────────────────────────────────────────────────── */}
      <section ref={statsRef} style={{ background:'#050505', padding:'clamp(3rem,5vw,5.5rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14">
          <div className="grid grid-cols-2 md:grid-cols-4 overflow-hidden rounded-2xl" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
            {STATS.map(({ value, label, sub }, i) => (
              <GlowCard key={label}
                className="flex flex-col transition-colors duration-300"
                style={{ background:'rgba(6,6,6,0.88)', backdropFilter:'blur(14px) saturate(160%)', WebkitBackdropFilter:'blur(14px) saturate(160%)', borderRight: i<3?'1px solid rgba(196,151,70,0.1)':'none', borderBottom: i<2?'1px solid rgba(196,151,70,0.1)':'none', padding:'clamp(1.25rem,2.2vw,2.5rem)' }}>
                <motion.div initial={{ opacity:0, y:28 }} animate={statsIn?{opacity:1,y:0}:{}} transition={{ duration:0.65, delay:i*0.12 }}>
                  <div className="font-black" style={{ fontSize:'clamp(1.25rem,2.4vw,2.6rem)', lineHeight:1, letterSpacing:'-0.04em', marginBottom:'0.6rem', color:'#feeaa5' }}>
                    {value}
                  </div>
                  <div className="font-semibold" style={{ color:'rgba(255,255,255,0.6)', fontSize:'clamp(0.85rem,1.2vw,1.1rem)', marginBottom:'0.35rem' }}>{label}</div>
                  <div className="font-mono" style={{ color:'rgba(255,255,255,0.25)', fontSize:'clamp(0.7rem,0.9vw,0.85rem)' }}>{sub}</div>
                </motion.div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ background:'#000', padding:'clamp(3rem,5vw,5.5rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14">
          <motion.div initial={{ opacity:0,y:32 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.8 }}
            style={{ marginBottom:'clamp(2.2rem,3.8vw,3.8rem)' }}>
            <span className="block font-mono tracking-[0.22em] uppercase" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)', marginBottom:'1rem' }}>
              Platform Capabilities
            </span>
            <h2 className="font-black" style={{ fontSize:'clamp(1.75rem,3.5vw,4.7rem)', lineHeight:0.92, letterSpacing:'-0.03em', maxWidth:'16ch' }}>
              Built for scale.<br />
              <span style={{ color:'rgba(196,151,70,0.48)' }}>Designed for speed.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px overflow-hidden rounded-2xl" style={{ background:'rgba(196,151,70,0.08)' }}>
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <GlowCard key={title}
                className="flex flex-col transition-colors duration-300"
                style={{ background:'rgba(6,6,6,0.88)', backdropFilter:'blur(14px) saturate(160%)', WebkitBackdropFilter:'blur(14px) saturate(160%)', padding:'clamp(1.25rem,2.2vw,2.2rem)' }}>
                <motion.div initial={{ opacity:0,y:22 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.55, delay:i*0.07 }}
                  className="flex flex-col gap-5 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center justify-center rounded-2xl"
                      style={{ width:'clamp(44px,4.5vw,58px)', height:'clamp(44px,4.5vw,58px)', background:'rgba(196,151,70,0.08)', border:'1px solid rgba(196,151,70,0.2)', boxShadow:'0 0 16px rgba(196,151,70,0.08)' }}>
                      <Icon style={{ width:'clamp(18px,2vw,24px)', height:'clamp(18px,2vw,24px)', color:'#feeaa5' }} />
                    </div>
                    <span className="font-mono text-xs" style={{ color:'rgba(196,151,70,0.4)' }}>0{i+1}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white" style={{ fontSize:'clamp(1rem,1.4vw,1.2rem)', marginBottom:'0.65rem' }}>{title}</h3>
                    <p className="leading-relaxed" style={{ color:'rgba(255,255,255,0.38)', fontSize:'clamp(0.82rem,1.05vw,1rem)' }}>{desc}</p>
                  </div>
                </motion.div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI ENGINE DEMO ──────────────────────────────────────────────────── */}
      <section id="ai-engine" style={{ background:'#050505', padding:'clamp(3rem,5vw,5.5rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div initial={{ opacity:0,x:-30 }} whileInView={{ opacity:1,x:0 }} viewport={{ once:true }} transition={{ duration:0.75 }}
            className="flex flex-col" style={{ gap:'clamp(1rem,1.6vw,1.6rem)' }}>
            <span className="font-mono tracking-[0.22em] uppercase" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)' }}>
              AI Engine
            </span>
            <h2 className="font-black" style={{ fontSize:'clamp(1.75rem,3.5vw,4.4rem)', lineHeight:0.92, letterSpacing:'-0.03em' }}>
              Knows the cause.<br />
              <span style={{ color:'rgba(196,151,70,0.48)' }}>Before you ask.</span>
            </h2>
            <p className="leading-relaxed max-w-lg" style={{ color:'rgba(255,255,255,0.42)', fontSize:'clamp(0.92rem,1.2vw,1.1rem)' }}>
              Our scikit-learn classifier analyzes raw log text and classifies failures
              into 8 root cause categories with 94% accuracy — then automatically triggers the right remediation action.
            </p>
            <div className="flex flex-col gap-4">
              {['Root cause classification from raw log text','Predictive failure scoring (24h horizon)','Z-score anomaly detection per ATM','Auto self-heal action selection & execution'].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:'rgba(255,255,255,0.4)' }} />
                  <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'clamp(0.85rem,1.1vw,1rem)' }}>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity:0,x:30 }} whileInView={{ opacity:1,x:0 }} viewport={{ once:true }} transition={{ duration:0.75 }}>
            <GlowCard className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.12)', background:'rgba(8,8,8,0.82)', backdropFilter:'blur(24px) saturate(180%)', WebkitBackdropFilter:'blur(24px) saturate(180%)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 0.5px rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2.5 px-5" style={{ height:52, background:'#111', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-3.5 h-3.5 rounded-full" style={{ background:'rgba(255,80,80,0.45)' }} />
                <div className="w-3.5 h-3.5 rounded-full" style={{ background:'rgba(255,180,0,0.45)' }} />
                <div className="w-3.5 h-3.5 rounded-full" style={{ background:'rgba(80,200,80,0.45)' }} />
                <span className="ml-3 font-mono" style={{ color:'rgba(255,255,255,0.28)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)' }}>pulse-ai-engine — bash</span>
              </div>
              <div className="font-mono leading-7 relative z-10" style={{ padding:'clamp(1.2rem,2vw,1.8rem)', minHeight:320, fontSize:'clamp(0.72rem,0.95vw,0.86rem)' }}>
                {TERMINAL.map((line, i) => i < termLine && (
                  <div key={i}>
                    {line.t === 'div'
                      ? <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'10px 0' }} />
                      : <div style={{ color: line.t==='cmd'?'rgba(255,255,255,0.82)': line.t==='ok'?'#feeaa5':'rgba(255,255,255,0.4)' }}>
                          {line.v}
                        </div>
                    }
                  </div>
                ))}
                {termLine <= TERMINAL.length && <span className="blinker" style={{ color:'rgba(255,255,255,0.35)' }}>█</span>}
              </div>
            </GlowCard>
          </motion.div>
        </div>
      </section>

      {/* ── LIVE FEED ───────────────────────────────────────────────────────── */}
      <section id="live-feed" style={{ background:'#000', padding:'clamp(3rem,5vw,5.5rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div initial={{ opacity:0,y:30 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.75 }}
            className="flex flex-col lg:order-2" style={{ gap:'clamp(1rem,1.6vw,1.6rem)' }}>
            <span className="font-mono tracking-[0.22em] uppercase" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)' }}>
              Real-Time Monitoring
            </span>
            <h2 className="font-black" style={{ fontSize:'clamp(1.75rem,3.5vw,4.4rem)', lineHeight:0.92, letterSpacing:'-0.03em' }}>
              Watch it work.<br />
              <span style={{ color:'rgba(196,151,70,0.48)' }}>Live.</span>
            </h2>
            <p className="leading-relaxed max-w-lg" style={{ color:'rgba(255,255,255,0.42)', fontSize:'clamp(0.92rem,1.2vw,1.1rem)' }}>
              Every log entry from every ATM streams in real-time via WebSocket.
              Incidents are created, classified, and resolved — often before your team even sees them.
            </p>
            <Link to="/login"
              className="inline-flex items-center gap-2 font-semibold group transition-all duration-200"
              style={{ color:'rgba(255,255,255,0.5)', fontSize:'clamp(0.85rem,1.1vw,1rem)' }}
              onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.9)')}
              onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.5)')}>
              Open Live Dashboard <ChevronRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </motion.div>

          <motion.div initial={{ opacity:0,y:30 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.75, delay:0.1 }}
            className="lg:order-1">
            <GlowCard className="rounded-2xl overflow-hidden relative" style={{ border:'1px solid rgba(255,255,255,0.12)', background:'rgba(6,6,6,0.82)', backdropFilter:'blur(24px) saturate(180%)', WebkitBackdropFilter:'blur(24px) saturate(180%)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08)', height:'clamp(215px,25vw,290px)' }}>
              <div className="flex items-center justify-between px-5" style={{ height:52, background:'#111', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full gold-pdot" style={{ background:'#e8af48' }} />
                  <span className="font-mono" style={{ color:'rgba(255,255,255,0.4)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)' }}>Live Log Stream</span>
                </div>
                <span className="font-mono" style={{ color:'rgba(255,255,255,0.18)', fontSize:'clamp(0.65rem,0.85vw,0.78rem)' }}>20 ATMs active</span>
              </div>
              {/* Fade top/bottom */}
              <div className="absolute inset-x-0 z-10" style={{ top:52, height:36, background:'linear-gradient(to bottom,#080808,transparent)' }} />
              <div className="absolute inset-x-0 bottom-0 z-10 h-20" style={{ background:'linear-gradient(to top,#080808,transparent)' }} />
              <div className="logsup absolute font-mono" style={{ top:52, left:0, right:0, padding:'clamp(0.8rem,1.5vw,1.4rem)', fontSize:'clamp(0.68rem,0.88vw,0.8rem)' }}>
                {[...LIVE_LOGS,...LIVE_LOGS].map((log, i) => (
                  <div key={i} className="flex items-center gap-4 whitespace-nowrap" style={{ marginBottom:'0.55rem' }}>
                    <span style={{ color:'rgba(255,255,255,0.2)', minWidth:48 }}>{log.time}</span>
                    <span style={{ color:'rgba(255,255,255,0.38)', minWidth:120 }}>{log.atm}</span>
                    <span style={{ minWidth:68, color:
                      log.level==='CRITICAL'?'#feeaa5':
                      log.level==='ERROR'   ?'rgba(254,150,100,0.85)':
                      log.level==='WARN'    ?'rgba(254,200,80,0.7)':'rgba(255,255,255,0.22)'
                    }}>{log.level}</span>
                    <span style={{ color:'rgba(255,255,255,0.4)' }}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </GlowCard>
          </motion.div>
        </div>
      </section>

      {/* ── MULTILINGUAL ────────────────────────────────────────────────────── */}
      <section id="multilingual" style={{ background:'#050505', padding:'clamp(3rem,5vw,5.5rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14">
          <motion.div initial={{ opacity:0,y:32 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.8 }}
            className="text-center" style={{ marginBottom:'clamp(2.2rem,3.8vw,3.8rem)' }}>
            <span className="block font-mono tracking-[0.22em] uppercase" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)', marginBottom:'1rem' }}>
              Problem #7 — Solved
            </span>
            <h2 className="font-black" style={{ fontSize:'clamp(1.75rem,3.5vw,4.7rem)', lineHeight:0.92, letterSpacing:'-0.03em', marginBottom:'1rem' }}>
              Every customer's language.<br />
              <span style={{ color:'rgba(196,151,70,0.48)' }}>Automatically.</span>
            </h2>
            <p className="mx-auto leading-relaxed" style={{ color:'rgba(255,255,255,0.4)', fontSize:'clamp(0.92rem,1.2vw,1.1rem)', maxWidth:'38rem' }}>
              40 pre-built templates across 8 Indian languages — auto-delivered via SMS or WhatsApp the moment an incident is detected.
            </p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {LANGUAGES.map(({ code, native, name }, i) => (
              <GlowCard key={code}
                className="rounded-2xl transition-all duration-200"
                style={{ border:'1px solid rgba(196,151,70,0.18)', background:'rgba(196,151,70,0.05)', backdropFilter:'blur(16px) saturate(180%)', WebkitBackdropFilter:'blur(16px) saturate(180%)', boxShadow:'inset 0 1px 0 rgba(254,234,165,0.1)', padding:'clamp(0.9rem,1.6vw,1.4rem)', transition:'border-color 0.3s ease,background 0.3s ease,box-shadow 0.3s ease' }}>
                <motion.div initial={{ opacity:0,scale:0.9,y:16 }} whileInView={{ opacity:1,scale:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.45, delay:i*0.06 }}
                  className="relative z-10">
                  <div className="font-bold" style={{ fontSize:'clamp(1rem,1.6vw,1.4rem)', marginBottom:'0.3rem', color:'#feeaa5' }}>{native}</div>
                  <div className="font-mono" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)' }}>{name}</div>
                </motion.div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="workflow" style={{ background:'#000', padding:'clamp(3rem,5vw,5.5rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14">
          <motion.div initial={{ opacity:0,y:32 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.8 }}
            className="text-center" style={{ marginBottom:'clamp(2.2rem,3.8vw,3.8rem)' }}>
            <span className="block font-mono tracking-[0.22em] uppercase" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(0.7rem,0.9vw,0.82rem)', marginBottom:'1rem' }}>
              Workflow
            </span>
            <h2 className="font-black" style={{ fontSize:'clamp(1.75rem,3.5vw,4.7rem)', lineHeight:0.92, letterSpacing:'-0.03em' }}>
              Log to resolved.<br />
              <span style={{ color:'rgba(196,151,70,0.48)' }}>In seconds.</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { step:'01', title:'Log Ingested',  desc:'ATM pushes raw log to POST /api/logs/ingest/. Deduplication, timestamping, and source tagging happen automatically at ingestion.' },
              { step:'02', title:'AI Analyzes',   desc:'Classifier identifies root cause category, confidence score, and recommended action within milliseconds. Incident record created automatically.' },
              { step:'03', title:'Auto-Resolved', desc:'Self-heal engine triggers remediation. Customer notified in their preferred language. Incident status set to AUTO_RESOLVED.' },
            ].map(({ step, title, desc }, i) => (
              <GlowCard key={step}
                className="rounded-2xl relative overflow-hidden"
                style={{ border:'1px solid rgba(255,255,255,0.11)', background:'rgba(6,6,6,0.85)', backdropFilter:'blur(14px) saturate(160%)', WebkitBackdropFilter:'blur(14px) saturate(160%)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08)', padding:'clamp(1.25rem,2.2vw,2.2rem)' }}>
                <motion.div initial={{ opacity:0,y:32 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.65, delay:i*0.15 }}
                  className="relative z-10">
                  <div className="font-black" style={{ fontSize:'clamp(2.5rem,5.5vw,6.2rem)', lineHeight:1, color:'rgba(196,151,70,0.15)', marginBottom:'0.6rem', letterSpacing:'-0.05em' }}>{step}</div>
                  <h3 className="font-bold text-white" style={{ fontSize:'clamp(1.1rem,1.6vw,1.4rem)', marginBottom:'0.8rem' }}>{title}</h3>
                  <p className="leading-relaxed" style={{ color:'rgba(255,255,255,0.38)', fontSize:'clamp(0.85rem,1.1vw,1rem)' }}>{desc}</p>
                </motion.div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section style={{ background:'#050505', padding:'clamp(4rem,7.5vw,8.8rem) 0', borderTop:'1px solid rgba(196,151,70,0.12)', position:'relative', overflow:'hidden' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14 text-center">
          <div aria-hidden style={{ position:'absolute', top:'20%', left:'15%', width:500, height:500, background:'radial-gradient(circle,rgba(196,151,70,0.06) 0%,transparent 65%)', filter:'blur(80px)', pointerEvents:'none' }} />
          <div aria-hidden style={{ position:'absolute', bottom:'10%', right:'10%', width:400, height:400, background:'radial-gradient(circle,rgba(196,151,70,0.05) 0%,transparent 65%)', filter:'blur(70px)', pointerEvents:'none' }} />
          <motion.div initial={{ opacity:0,y:48 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.9 }}>
            <h2 className="font-black text-white" style={{ fontSize:'clamp(1.85rem,5vw,6.9rem)', lineHeight:0.88, letterSpacing:'-0.04em', marginBottom:'1.25rem' }}>
              Your Network.<br />Under Control.
            </h2>
            <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'clamp(1rem,1.5vw,1.3rem)', marginBottom:'3rem', maxWidth:'38rem', margin:'0 auto 3rem' }}>
              Real-time monitoring, AI-powered diagnostics, and self-healing automation —
              all in one platform built for the Indian payments ecosystem.
            </p>
            <div style={{ position:'relative', display:'inline-block' }}>
              {/* glow */}
              <div aria-hidden style={{ position:'absolute', inset:'-6px', borderRadius:40, background:'#e8af48', opacity:.15, filter:'blur(10px)', animation:'ring-breathe 2.8s ease-in-out infinite', pointerEvents:'none' }} />
              {/* clip */}
              <div aria-hidden style={{ position:'absolute', inset:0, borderRadius:32, overflow:'hidden', pointerEvents:'none' }}>
                <div style={{ position:'absolute', width:'200%', height:'200%', top:'-50%', left:'-50%', animation:'spin-gold 4.5s linear infinite', background: RING_CONIC }} />
              </div>
              {/* plate */}
              <div aria-hidden style={{ position:'absolute', inset:'2px', borderRadius:30, background:'rgba(10,10,12,0.96)', pointerEvents:'none' }} />
              <Link to="/login"
                className="relative flex items-center gap-3 font-bold group"
                style={{ position:'relative', zIndex:5, fontSize:'clamp(0.9rem,1.2vw,1.1rem)', padding:'clamp(1rem,1.4vw,1.3rem) clamp(2.5rem,3.5vw,3.5rem)', borderRadius:30, color:'#feeaa5', textDecoration:'none', transition:'gap 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                Access Operations Center <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FLOATING NAV ────────────────────────────────────────────────────── */}
      <FloatingNav />

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ background:'#000', borderTop:'1px solid rgba(255,255,255,0.07)', padding:'clamp(1.5rem,2.5vw,2.2rem) 0' }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-14 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-black" style={{ color:'rgba(196,151,70,0.72)', fontSize:'clamp(1rem,1.4vw,1.2rem)', letterSpacing:'-0.02em' }}>PULSE</span>
          <span className="font-mono text-center" style={{ color:'rgba(255,255,255,0.18)', fontSize:'clamp(0.65rem,0.85vw,0.78rem)' }}>
            Payment Uptime &amp; Log-based Smart Engine · Problem #2 &amp; #7
          </span>
        </div>
      </footer>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginRibbons() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes rb1{0%,100%{transform:rotate(-14deg) translateY(0px)}50%{transform:rotate(-14deg) translateY(-50px)}}
        @keyframes rb2{0%,100%{transform:rotate(-18deg) translateY(-25px)}50%{transform:rotate(-18deg) translateY(40px)}}
        @keyframes rb3{0%,100%{transform:rotate(-11deg) translateY(15px)}50%{transform:rotate(-11deg) translateY(-35px)}}
        @keyframes rb4{0%,100%{transform:rotate(-20deg) translateY(0px)}50%{transform:rotate(-20deg) translateY(28px)}}
        @keyframes rb5{0%,100%{transform:rotate(-8deg) translateY(-10px)}50%{transform:rotate(-8deg) translateY(22px)}}
        .rb1{animation:rb1 11s ease-in-out infinite}
        .rb2{animation:rb2 14s ease-in-out infinite 1.5s}
        .rb3{animation:rb3 17s ease-in-out infinite 3s}
        .rb4{animation:rb4 12s ease-in-out infinite 0.8s}
        .rb5{animation:rb5 9s ease-in-out infinite 2.2s}
      `}</style>
      {/* Ribbon 1 — widest, most prominent */}
      <div className="rb1 absolute" style={{ width:'45vw', height:'145vh', right:'-11vw', top:'-41vh', background:'linear-gradient(145deg,rgba(196,151,70,0.13) 0%,rgba(196,151,70,0.06) 40%,rgba(196,151,70,0.10) 75%,rgba(196,151,70,0.03) 100%)', borderRadius:'0 0 60% 0', transformOrigin:'center', filter:'blur(0.5px)' }} />
      {/* Ribbon 2 — medium */}
      <div className="rb2 absolute" style={{ width:'33vw', height:'138vh', right:'-5vw', top:'-35vh', background:'linear-gradient(155deg,rgba(196,151,70,0.07) 0%,rgba(232,175,72,0.11) 45%,rgba(196,151,70,0.05) 100%)', borderRadius:'0 0 50% 0', transformOrigin:'center', filter:'blur(1px)' }} />
      {/* Ribbon 3 — thin accent */}
      <div className="rb3 absolute" style={{ width:'20vw', height:'132vh', right:'5vw', top:'-33vh', background:'linear-gradient(160deg,rgba(196,151,70,0.04) 0%,rgba(196,151,70,0.08) 50%,rgba(196,151,70,0.03) 100%)', borderRadius:'0 0 40% 0', transformOrigin:'center' }} />
      {/* Ribbon 4 — background depth */}
      <div className="rb4 absolute" style={{ width:'56vw', height:'163vh', right:'-22vw', top:'-50vh', background:'linear-gradient(140deg,rgba(196,151,70,0.05) 0%,rgba(196,151,70,0.02) 100%)', borderRadius:'0 0 70% 0', transformOrigin:'center', filter:'blur(2px)' }} />
      {/* Ribbon 5 — far edge highlight */}
      <div className="rb5 absolute" style={{ width:'11vw', height:'126vh', right:'14vw', top:'-31vh', background:'linear-gradient(170deg,rgba(196,151,70,0.03) 0%,rgba(232,175,72,0.07) 50%,rgba(196,151,70,0.02) 100%)', borderRadius:'0 0 30% 0', transformOrigin:'center', filter:'blur(0.5px)' }} />
      {/* Subtle gold glow orb behind ribbons */}
      <div className="absolute" style={{ right:'-5%', top:'20%', width:'60vw', height:'60vw', background:'radial-gradient(circle,rgba(196,151,70,0.07) 0%,transparent 65%)', filter:'blur(60px)' }} />
    </div>
  );
}

function LoginPage() {
  const [form, setForm]         = useState({ username:'', password:'' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked]     = useState(false);
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch('http://localhost:8000/api/auth/login/', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username:form.username, password:form.password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        // Fetch role from /api/auth/me/
        try {
          const meRes = await fetch('http://localhost:8000/api/auth/me/', {
            headers: { 'Authorization': `Bearer ${data.access}` },
          });
          if (meRes.ok) {
            const me = await meRes.json();
            dispatch(setAuth({ username: me.username, role: me.role, email: me.email }));
            navigate(me.role === 'ENGINEER' ? '/engineer' : '/dashboard');
          } else {
            navigate('/dashboard');
          }
        } catch {
          navigate('/dashboard');
        }
      } else {
        const n = attempts + 1; setAttempts(n);
        const msg = data?.detail || data?.non_field_errors?.[0] || 'Invalid credentials. Please try again.';
        if (n >= 5) { setLocked(true); setError('Account locked. Contact your administrator.'); }
        else { setError(msg); setShake(true); setTimeout(()=>setShake(false),500); }
      }
    } catch (err: any) {
      const n = attempts + 1; setAttempts(n);
      if (n >= 5) { setLocked(true); setError('Account locked. Contact your administrator.'); }
      else { setError('Cannot reach backend at localhost:8000 — is Django running?'); setShake(true); setTimeout(()=>setShake(false),500); }
    } finally { setLoading(false); }
  };

  const iBase: React.CSSProperties = {
    width:'100%', background:'rgba(196,151,70,0.04)', border:'1px solid rgba(196,151,70,0.18)',
    borderRadius:12, color:'#feeaa5', padding:'0.9rem 1rem 0.9rem 2.8rem',
    outline:'none', fontSize:'0.95rem', fontFamily:'inherit',
    backdropFilter:'blur(12px) saturate(180%)', WebkitBackdropFilter:'blur(12px) saturate(180%)',
    transition:'border 0.25s cubic-bezier(0.16,1,0.3,1), background 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1)',
  };

  return (
    <div className="min-h-screen font-sans relative overflow-hidden flex flex-col" style={{ background:'#000', color:'#fff' }}>
      <style>{`
        @keyframes lpshake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .lp-shake{animation:lpshake .45s cubic-bezier(.36,.07,.19,.97) both}
        @keyframes lpf1{0%,100%{transform:translateY(0px)}50%{transform:translateY(-22px)}}
        @keyframes lpf2{0%,100%{transform:translateY(-12px)}50%{transform:translateY(16px)}}
        @keyframes lpf3{0%,100%{transform:translateY(8px)}50%{transform:translateY(-18px)}}
        @keyframes lpspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes lpButtonGlow{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 4px 16px rgba(0,0,0,0.5)} 50%{box-shadow:inset 0 1px 0 rgba(255,255,255,0.2),0 6px 24px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05)}}
        @keyframes lp-spin-gold   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lp-ring-breath { 0%,100%{opacity:.13} 50%{opacity:.24} }
        .lpf1{animation:lpf1 10s ease-in-out infinite}
        .lpf2{animation:lpf2 13s ease-in-out infinite 2s}
        .lpf3{animation:lpf3 16s ease-in-out infinite 4s}
        .lpspin{animation:lpspin 50s linear infinite}
        .lp-input::placeholder{color:rgba(196,151,70,0.3);transition:color 0.2s ease}
        .lp-input:disabled{opacity:.35;cursor:not-allowed}
        .lp-input:focus{border-color:rgba(196,151,70,0.5)!important;background:rgba(196,151,70,0.06)!important;box-shadow:0 0 0 3px rgba(196,151,70,0.08)!important}
        .lp-input:hover:not(:disabled){background:rgba(196,151,70,0.05)!important;border-color:rgba(196,151,70,0.28)!important}
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* ── ANIMATED RIBBONS ── */}
      <LoginRibbons />

      {/* ── AMBIENT GLOWS ── */}
      <div className="absolute pointer-events-none" style={{ top:'-10%', left:'-5%', width:'55vw', height:'55vw', background:'radial-gradient(circle,rgba(196,151,70,0.06) 0%,transparent 65%)', filter:'blur(80px)' }} />
      <div className="absolute pointer-events-none" style={{ bottom:'-5%', left:'10%', width:'40vw', height:'40vw', background:'radial-gradient(circle,rgba(196,151,70,0.04) 0%,transparent 65%)', filter:'blur(70px)' }} />

      {/* ── FINTECH ICONS (left side only, away from ribbons) ── */}
      {([
        ['card',   3,  7,   82, -18, 0.08,  'lpf1'],
        ['shield', 5, 68,   54, -14, 0.07,  'lpf3'],
        ['lock',  10, 38,   48,  10, 0.075, 'lpf2'],
        ['chart',  2, 82,   44, -10, 0.065, 'lpf1'],
        ['cpu',   18, 18,   41,  22, 0.06,  'lpf3'],
        ['zap',    8, 52,   35, -20, 0.07,  'lpf2'],
        ['db',    22, 88,   50,   6, 0.065, 'lpspin'],
        ['trend', 15, 58,   57,   8, 0.06,  'lpf1'],
      ] as [string,number,number,number,number,number,string][]).map(([type, l, t, sz, rot, op, cls], i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left:`${l}%`, top:`${t}%` }}>
          <div className={cls}><FintechBgSVG type={type as string} size={sz as number} rotate={rot as number} opacity={op as number} /></div>
        </div>
      ))}

      {/* ── FLOATING PILL NAV (matches landing page) ── */}
      <div style={{ position:'fixed', top:14, left:'50%', transform:'translateX(-50%)', zIndex:60 }}>
        <motion.div
          initial={{ opacity:0, y:-18 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.6, ease:[0.16,1,0.3,1], delay:0.08 }}
          style={{
            position:'relative', display:'flex', alignItems:'center', gap:8,
            padding:'9px 14px', borderRadius:70,
            background:'rgba(10,10,12,0.88)',
            backdropFilter:'blur(56px) saturate(220%)', WebkitBackdropFilter:'blur(56px) saturate(220%)',
            border:'1px solid rgba(255,255,255,0.1)',
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.85)',
            whiteSpace:'nowrap',
          }}
        >
          {/* film grain */}
          <div aria-hidden style={{ position:'absolute', inset:0, borderRadius:'inherit', pointerEvents:'none', zIndex:20, opacity:.025,
            backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat:'repeat', backgroundSize:'128px' }} />

          {/* PULSE wordmark */}
          <span className="font-black select-none" style={{ padding:'0 14px 0 8px', fontSize:'1.15rem', letterSpacing:'-0.03em', color:'#feeaa5', position:'relative', zIndex:5, lineHeight:1, textShadow:'0 0 18px rgba(196,151,70,0.45)' }}>
            PULSE
          </span>

          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.1)', margin:'0 4px', flexShrink:0 }} />

          {/* ← Back with liquid gold ring */}
          <div style={{ position:'relative', display:'inline-flex' }}>
            <div aria-hidden style={{ position:'absolute', inset:'-4px', borderRadius:32, background:'#e8af48', opacity:.14, filter:'blur(9px)', animation:'lp-ring-breath 2.8s ease-in-out infinite', pointerEvents:'none' }} />
            <div aria-hidden style={{ position:'absolute', inset:0, borderRadius:24, overflow:'hidden', pointerEvents:'none' }}>
              <div style={{ position:'absolute', width:'200%', height:'200%', top:'-50%', left:'-50%', animation:'lp-spin-gold 4.5s linear infinite', background: GOLD_CONIC }} />
            </div>
            <div aria-hidden style={{ position:'absolute', inset:'2px', borderRadius:22, background:'rgba(10,10,12,0.95)', pointerEvents:'none' }} />
            <Link to="/" style={{ position:'relative', zIndex:5, display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', fontWeight:700, padding:'9px 16px', borderRadius:22, color:'#feeaa5', textDecoration:'none', letterSpacing:'0.02em' }}>
              ← Home
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex items-center justify-start px-6 md:px-10 lg:px-16" style={{ paddingTop:'clamp(1.25rem,3vh,2.5rem)', paddingBottom:'clamp(1.25rem,3vh,2.5rem)' }}>
        <div className="w-full max-w-xl">

          {/* Big heading above card */}
          <motion.div initial={{ opacity:0,y:30 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.8, ease:[0.16,1,0.3,1] }}
            style={{ marginBottom:'clamp(1rem,2vw,1.6rem)' }}>
            <h1 className="font-black text-white" style={{ fontSize:'clamp(1.85rem,3.75vw,4.4rem)', lineHeight:0.9, letterSpacing:'-0.04em', marginBottom:'0.65rem' }}>
              Welcome<br /><span style={{ color:'rgba(196,151,70,0.65)' }}>back.</span>
            </h1>
            <p className="font-mono tracking-[0.18em] uppercase" style={{ color:'rgba(196,151,70,0.45)', fontSize:'0.78rem' }}>
              Sign in to access your operations dashboard
            </p>
          </motion.div>

          {/* Glass login card */}
          <motion.div
            initial={{ opacity:0, y:32, scale:0.96 }}
            animate={{ opacity:1, y:0,  scale:1   }}
            transition={{ duration:0.85, ease:[0.16,1,0.3,1], delay:0.1 }}
            className={`relative rounded-3xl ${shake?'lp-shake':''}`}
            style={{ background:'rgba(9,9,9,0.82)', backdropFilter:'blur(60px) saturate(240%) brightness(1.04)', WebkitBackdropFilter:'blur(60px) saturate(240%) brightness(1.04)', border:'1px solid rgba(196,151,70,0.18)', boxShadow:'inset 0 1px 0 rgba(196,151,70,0.14), inset 0 -1px 0 rgba(0,0,0,0.18), inset 1px 0 0 rgba(196,151,70,0.06), 0 40px 80px rgba(0,0,0,0.92), 0 0 0 0.5px rgba(196,151,70,0.08)' }}>

            {/* Specular top line */}
            <div className="absolute inset-x-0 top-0 pointer-events-none rounded-t-3xl" style={{ height:'1px', background:'linear-gradient(90deg,transparent 5%,rgba(196,151,70,0.22) 50%,transparent 95%)', zIndex:2 }} />
            {/* Specular left edge */}
            <div className="absolute inset-y-0 left-0 pointer-events-none rounded-l-3xl" style={{ width:'1px', background:'linear-gradient(180deg,rgba(196,151,70,0.12),rgba(196,151,70,0.04),transparent)', zIndex:2 }} />

            <div style={{ padding:'clamp(1.5rem,2.5vw,2rem)' }}>

              {/* Form header */}
              <div style={{ marginBottom:'2rem' }}>
                <h2 className="font-bold" style={{ fontSize:'clamp(1.4rem,2.2vw,1.8rem)', marginBottom:'0.4rem', letterSpacing:'-0.02em', color:'#feeaa5' }}>Sign in to your account</h2>
                <p style={{ color:'rgba(196,151,70,0.5)', fontSize:'0.92rem' }}>Enter your credentials to continue</p>
              </div>

              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>

                {/* Username */}
                <div>
                  <label style={{ display:'block', color:'rgba(196,151,70,0.6)', fontSize:'0.82rem', fontWeight:600, marginBottom:'0.5rem', letterSpacing:'0.04em', textTransform:'uppercase' }}>Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none" style={{ paddingLeft:'1rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(196,151,70,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input type="text" disabled={locked} placeholder="Enter your username"
                      className="lp-input" style={iBase} value={form.username}
                      onChange={e=>setForm({...form,username:e.target.value})} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom:'0.5rem' }}>
                    <label style={{ color:'rgba(196,151,70,0.6)', fontSize:'0.82rem', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>Password</label>
                    <a href="#" style={{ color:'rgba(196,151,70,0.38)', fontSize:'0.82rem', textDecoration:'none' }}
                      onMouseEnter={e=>e.currentTarget.style.color='rgba(254,234,165,0.8)'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(196,151,70,0.38)'}>Forgot password?</a>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none" style={{ paddingLeft:'1rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(196,151,70,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <input type={showPass?'text':'password'} disabled={locked} placeholder="Enter your password"
                      className="lp-input" style={{ ...iBase, paddingRight:'3rem' }} value={form.password}
                      onChange={e=>setForm({...form,password:e.target.value})} />
                    <button type="button" disabled={locked} onClick={()=>setShowPass(!showPass)}
                      className="absolute inset-y-0 right-0 flex items-center transition-opacity hover:opacity-70" style={{ paddingRight:'1rem' }}>
                      {showPass
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(196,151,70,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(196,151,70,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height:'1px', background:'rgba(196,151,70,0.12)', margin:'0.4rem 0' }} />

                {/* Submit — glowing gold border ring */}
                <motion.div
                  whileHover={!loading && !locked ? { scale:1.025 } : {}}
                  whileTap={!loading && !locked ? { scale:0.975 } : {}}
                  transition={{ type:'spring', stiffness:280, damping:22 }}
                  style={{ position:'relative', borderRadius:16 }}
                >
                  {/* outer breathing glow */}
                  <div aria-hidden style={{ position:'absolute', inset:'-5px', borderRadius:20, background:'#e8af48', opacity:.17, filter:'blur(10px)', animation:'lp-ring-breath 2.8s ease-in-out infinite', pointerEvents:'none' }} />
                  <button type="submit" disabled={loading||locked}
                    className="relative w-full font-bold flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{ zIndex:5, background:'rgba(5,5,5,0.97)', color:'#feeaa5', fontSize:'1rem', padding:'1rem 1.5rem', borderRadius:14, letterSpacing:'-0.01em', border:'1.5px solid rgba(196,151,70,0.65)', boxShadow:'0 0 12px rgba(196,151,70,0.22), inset 0 1px 0 rgba(196,151,70,0.1)', cursor: loading||locked ? 'not-allowed' : 'pointer', transition:'color 0.2s ease, box-shadow 0.3s ease', textShadow:'0 0 14px rgba(196,151,70,0.4)' }}
                    onMouseEnter={e => { if(!loading && !locked){ e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='0 0 20px rgba(196,151,70,0.38), inset 0 1px 0 rgba(196,151,70,0.14)'; e.currentTarget.style.textShadow='0 0 20px rgba(232,175,72,0.7)'; }}}
                    onMouseLeave={e => { e.currentTarget.style.color='#feeaa5'; e.currentTarget.style.boxShadow='0 0 12px rgba(196,151,70,0.22), inset 0 1px 0 rgba(196,151,70,0.1)'; e.currentTarget.style.textShadow='0 0 14px rgba(196,151,70,0.4)'; }}>
                    {loading
                      ? <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                      : <><span>Sign In</span> <ArrowRight size={16} /></>
                    }
                  </button>
                </motion.div>

                {error && <p className="text-center" style={{ color:'rgba(255,110,110,0.95)', fontSize:'0.88rem' }}>{error}</p>}
              </form>
            </div>
          </motion.div>

          {/* Footer note */}
          <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5, duration:0.6 }}
            className="font-mono text-center" style={{ color:'rgba(196,151,70,0.38)', fontSize:'0.72rem', marginTop:'1.5rem', letterSpacing:'0.1em' }}>
            PULSE · PAYMENT UPTIME &amp; LOG-BASED SMART ENGINE
          </motion.p>
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/"      element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/engineer"       element={<EngineerDashboard />} />
            <Route path="/atm-map"        element={<ATMMapPage />} />
            <Route path="/atm-detail/:id" element={<ATMDetail />} />
            <Route path="/logs"           element={<Logs />} />
            <Route path="/incidents"      element={<Incidents />} />
            <Route path="/ai-analysis"    element={<AIAnalysis />} />
            <Route path="/anomaly"        element={<Anomaly />} />
            <Route path="/communications" element={<Communications />} />
            <Route path="/settings"       element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<App />);
