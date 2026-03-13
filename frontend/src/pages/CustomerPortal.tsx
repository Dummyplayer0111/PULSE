import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/* ─── Constants ────────────────────────────────────────────────────────────── */
const API = 'http://localhost:8000/api';
const WS_BASE = 'ws://localhost:8000/ws/customer/';
const SESSION_KEY = 'pg_customer_token';
const HASH_KEY = 'pg_customer_hash';

const STATUS_ORDER = ['DETECTED', 'INVESTIGATING', 'ENGINEER_DISPATCHED', 'RESOLVING', 'REFUND_INITIATED', 'RESOLVED'];
const STATUS_LABELS: Record<string, { en: string; hi: string; color: string; icon: string }> = {
  DETECTED:            { en: 'Detected',          hi: 'पता चला',             color: '#ef4444', icon: '\ud83d\udd34' },
  INVESTIGATING:       { en: 'Investigating',      hi: 'जांच जारी',           color: '#f59e0b', icon: '\ud83d\udfe1' },
  ENGINEER_DISPATCHED: { en: 'Engineer En Route',  hi: 'इंजीनियर रास्ते में',     color: '#3b82f6', icon: '\ud83d\udfe2' },
  RESOLVING:           { en: 'Resolving',          hi: 'समाधान हो रहा है',     color: '#8b5cf6', icon: '\ud83d\udfe3' },
  REFUND_INITIATED:    { en: 'Refund Initiated',   hi: 'रिफंड शुरू',          color: '#06b6d4', icon: '\ud83d\udcb0' },
  RESOLVED:            { en: 'Resolved',           hi: 'हल हो गया',          color: '#22c55e', icon: '\u2705'       },
};

const REFUND_LABELS: Record<string, { en: string; hi: string }> = {
  PENDING:        { en: 'Pending',        hi: 'लंबित' },
  PROCESSING:     { en: 'Processing',     hi: 'प्रक्रिया में' },
  COMPLETED:      { en: 'Completed',      hi: 'पूर्ण' },
  NOT_APPLICABLE: { en: 'Not Applicable', hi: 'लागू नहीं' },
};

const FAILURE_LABELS: Record<string, { en: string; hi: string }> = {
  CASH_JAM:          { en: 'Cash Jam',          hi: 'कैश जाम' },
  PARTIAL_DISPENSE:  { en: 'Partial Dispense',  hi: 'आंशिक निकासी' },
  NETWORK_TIMEOUT:   { en: 'Network Timeout',   hi: 'नेटवर्क टाइमआउट' },
  CARD_CAPTURED:     { en: 'Card Retained',     hi: 'कार्ड रोका गया' },
};

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface TimelineEvent { time: string; message: string; message_hi: string; status: string; }
interface FailedTxn {
  transaction_ref: string; card_last_four: string; amount: number;
  amount_dispensed: number; refund_amount: number;
  atm_name: string; atm_location: string; transaction_type: string;
  failure_type: string; failure_reason: string; failure_reason_hi: string;
  status: string; refund_status: string; refund_eta: string | null;
  engineer_name: string; engineer_eta_minutes: number;
  phone_hash: string; timeline: TimelineEvent[];
  created_at: string; updated_at: string; helpdesk_number?: string;
}

/* ─── Utility ──────────────────────────────────────────────────────────────── */
function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function relativeTimeHi(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'अभी';
  if (diff < 3600) return `${Math.floor(diff / 60)} मिनट पहले`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} घंटे पहले`;
  return new Date(iso).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' });
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */
const S = {
  page: { minHeight: '100vh', background: '#0a0a0f', color: '#e5e5e5', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14 } as React.CSSProperties,
  container: { maxWidth: 480, margin: '0 auto', padding: '0 16px 32px' } as React.CSSProperties,
  header: { padding: '20px 0 12px', textAlign: 'center' as const, borderBottom: '1px solid #1e1e2e' },
  logo: { fontSize: 20, fontWeight: 700, color: '#feeaa5', letterSpacing: 1 },
  subtitle: { fontSize: 11, color: '#888', marginTop: 4, letterSpacing: '0.05em' },
  card: { background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, marginTop: 16, overflow: 'hidden' as const },
  cardHeader: { padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: `${color}15`, color, border: `1px solid ${color}30`, whiteSpace: 'nowrap' } as React.CSSProperties),
  input: { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a3a', background: '#0d0d14', color: '#e5e5e5', fontSize: 16, outline: 'none', boxSizing: 'border-box' as const, letterSpacing: 2 } as React.CSSProperties,
  btn: (disabled?: boolean) => ({ width: '100%', padding: '13px', borderRadius: 8, border: 'none', background: '#feeaa5', color: '#0a0a0f', fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '0.02em', opacity: disabled ? 0.5 : 1, transition: 'opacity .2s' } as React.CSSProperties),
  btnOutline: { width: '100%', padding: '11px', borderRadius: 8, background: 'transparent', color: '#888', border: '1px solid #2a2a3a', fontSize: 13, cursor: 'pointer' } as React.CSSProperties,
  trust: { textAlign: 'center' as const, padding: '20px 0 8px', fontSize: 10, color: '#555', lineHeight: 1.7 },
  progressBar: { width: '100%', height: 6, background: '#1e1e2e', borderRadius: 3, overflow: 'hidden' as const },
  progressFill: (pct: number, color: string) => ({ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.8s ease' } as React.CSSProperties),
  langToggle: { display: 'flex', gap: 4, justifyContent: 'center', margin: '12px 0' },
  langBtn: (on: boolean) => ({ padding: '4px 12px', borderRadius: 16, border: on ? '1px solid #feeaa5' : '1px solid #2a2a3a', background: on ? '#feeaa520' : 'transparent', color: on ? '#feeaa5' : '#666', fontSize: 11, fontWeight: 500, cursor: 'pointer' } as React.CSSProperties),
  tlDot: (c: string) => ({ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 4 } as React.CSSProperties),
  tlLine: { width: 2, background: '#1e1e2e', marginLeft: 4, flexShrink: 0 } as React.CSSProperties,
  summaryPill: (c: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: 11, background: `${c}12`, color: c, border: `1px solid ${c}25` } as React.CSSProperties),
};

/* ─── Sub Components ───────────────────────────────────────────────────────── */

function StatusBadge({ status, lang }: { status: string; lang: 'en' | 'hi' }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.DETECTED;
  return <span style={S.badge(s.color)}>{s.icon} {lang === 'hi' ? s.hi : s.en}</span>;
}

function StatusProgress({ status, failureType }: { status: string; failureType: string }) {
  const isTimeout = failureType === 'NETWORK_TIMEOUT';
  const isCard = failureType === 'CARD_CAPTURED';
  const total = isTimeout ? 3 : isCard ? 5 : 6;
  const idx = STATUS_ORDER.indexOf(status);
  const effective = status === 'RESOLVED' ? total - 1 : Math.min(idx, total - 1);
  const pct = Math.round(((effective + 1) / total) * 100);
  const color = STATUS_LABELS[status]?.color || '#666';
  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#888' }}>Progress / प्रगति</span>
        <span style={{ fontSize: 10, color }}>{pct}%</span>
      </div>
      <div style={S.progressBar}><div style={S.progressFill(pct, color)} /></div>
    </div>
  );
}

function RefundBar({ status, amount, eta, lang }: { status: string; amount: number; eta: string | null; lang: 'en' | 'hi' }) {
  if (status === 'NOT_APPLICABLE' || amount <= 0) return null;
  const l = REFUND_LABELS[status] || REFUND_LABELS.PENDING;
  const pct = status === 'COMPLETED' ? 100 : status === 'PROCESSING' ? 70 : 25;
  const color = status === 'COMPLETED' ? '#22c55e' : '#f59e0b';
  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>
          {lang === 'hi' ? 'रिफंड' : 'Refund'} \u20b9{amount.toLocaleString('en-IN')} — {lang === 'hi' ? l.hi : l.en}
        </span>
      </div>
      <div style={S.progressBar}><div style={S.progressFill(pct, color)} /></div>
      {eta && status !== 'COMPLETED' && (
        <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
          ETA: {new Date(eta).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}
    </div>
  );
}

function Timeline({ events, lang }: { events: TimelineEvent[]; lang: 'en' | 'hi' }) {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      {events.map((e, i) => {
        const color = STATUS_LABELS[e.status]?.color || '#666';
        const isLast = i === events.length - 1;
        const t = new Date(e.time);
        return (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={S.tlDot(color)} />
              {!isLast && <div style={{ ...S.tlLine, height: 34 }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 6, flex: 1 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>
                {t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                {' \u00b7 '}
                {lang === 'hi' ? relativeTimeHi(e.time) : relativeTime(e.time)}
              </div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>
                {lang === 'hi' ? e.message_hi : e.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Transaction Card ─────────────────────────────────────────────────────── */

function TransactionCard({ txn, lang, defaultOpen }: { txn: FailedTxn; lang: 'en' | 'hi'; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const [flash, setFlash] = useState(false);
  const prevStatus = useRef(txn.status);

  // Flash animation when status changes
  useEffect(() => {
    if (prevStatus.current !== txn.status) {
      setFlash(true);
      prevStatus.current = txn.status;
      const timer = setTimeout(() => setFlash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [txn.status]);

  const created = new Date(txn.created_at);
  const fl = FAILURE_LABELS[txn.failure_type] || { en: txn.failure_type, hi: txn.failure_type };
  const isActive = txn.status !== 'RESOLVED';

  return (
    <div style={{
      ...S.card,
      borderColor: flash ? STATUS_LABELS[txn.status]?.color + '60' : '#1e1e2e',
      transition: 'border-color 0.5s ease',
    }}>
      <div style={S.cardHeader} onClick={() => setOpen(!open)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5', display: 'flex', alignItems: 'center', gap: 8 }}>
            \u20b9{txn.amount.toLocaleString('en-IN')}
            <span style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>
              {lang === 'hi' ? fl.hi : fl.en}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            {txn.atm_name} \u00b7 {txn.atm_location}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
            Card ****{txn.card_last_four} \u00b7 {created.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            {' \u00b7 '}<span style={{ color: isActive ? '#f59e0b' : '#22c55e' }}>{lang === 'hi' ? relativeTimeHi(txn.created_at) : relativeTime(txn.created_at)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginLeft: 8, flexShrink: 0 }}>
          <StatusBadge status={txn.status} lang={lang} />
          <span style={{ fontSize: 16, color: '#444', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>\u203a</span>
        </div>
      </div>

      <StatusProgress status={txn.status} failureType={txn.failure_type} />

      <RefundBar status={txn.refund_status} amount={txn.refund_amount} eta={txn.refund_eta} lang={lang} />

      {/* Failure reason box */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, background: '#0d0d14', padding: '10px 12px', borderRadius: 8, borderLeft: `3px solid ${STATUS_LABELS[txn.status]?.color || '#333'}` }}>
          {lang === 'hi' ? txn.failure_reason_hi : txn.failure_reason}
        </div>
      </div>

      {/* Engineer info (only while active) */}
      {txn.engineer_name && isActive && (
        <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#888' }}>\ud83d\udc77 {lang === 'hi' ? 'इंजीनियर' : 'Engineer'}: <b style={{ color: '#bbb' }}>{txn.engineer_name}</b></span>
          {txn.status === 'ENGINEER_DISPATCHED' && (
            <span style={{ color: '#3b82f6' }}>ETA: {txn.engineer_eta_minutes} min</span>
          )}
        </div>
      )}

      {/* Collapsible timeline */}
      {open && txn.timeline?.length > 0 && (
        <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 12 }}>
          <div style={{ padding: '0 16px 8px', fontSize: 10, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lang === 'hi' ? 'समयरेखा' : 'Timeline'} ({txn.timeline.length} {lang === 'hi' ? 'घटनाएं' : 'events'})
          </div>
          <Timeline events={txn.timeline} lang={lang} />
        </div>
      )}
    </div>
  );
}

/* ─── OTP Login ────────────────────────────────────────────────────────────── */

function OTPLogin({ onAuth, lang }: { onAuth: (token: string, phoneHash: string) => void; lang: 'en' | 'hi' }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const requestOtp = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/customer/request-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('otp');
        setResendTimer(30); // 30s cooldown
      } else {
        setError(lang === 'hi' ? (data.error_hi || data.error) : data.error);
      }
    } catch { setError(lang === 'hi' ? 'नेटवर्क त्रुटि। पुनः प्रयास करें।' : 'Network error. Please try again.'); }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/customer/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem(SESSION_KEY, data.token);
        sessionStorage.setItem(HASH_KEY, data.phone_hash);
        onAuth(data.token, data.phone_hash);
      } else {
        setError(lang === 'hi' ? (data.error_hi || data.error) : data.error);
      }
    } catch { setError(lang === 'hi' ? 'नेटवर्क त्रुटि।' : 'Network error.'); }
    setLoading(false);
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && step === 'otp' && !loading) {
      verifyOtp();
    }
  }, [otp]);

  return (
    <div style={S.card}>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#feeaa5' }}>
          {step === 'phone'
            ? (lang === 'hi' ? 'अपना फ़ोन नंबर दर्ज करें' : 'Enter your phone number')
            : (lang === 'hi' ? 'OTP दर्ज करें' : 'Enter OTP')}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
          {step === 'phone'
            ? (lang === 'hi' ? 'हम एक बार का PIN भेजेंगे। कोई पासवर्ड नहीं।' : "We'll send a one-time PIN. No password needed.")
            : (lang === 'hi' ? `OTP ***${phone.slice(-4)} पर भेजा गया` : `OTP sent to ***${phone.slice(-4)}`)}
        </div>

        {step === 'phone' ? (
          <>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 15 }}>+91</span>
              <input
                type="tel" placeholder="10-digit number" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                style={{ ...S.input, paddingLeft: 50 }} maxLength={10}
                onKeyDown={e => e.key === 'Enter' && phone.length === 10 && requestOtp()}
              />
            </div>
            <button
              style={S.btn(loading || phone.length < 10)}
              disabled={loading || phone.length < 10}
              onClick={requestOtp}
            >
              {loading ? (lang === 'hi' ? 'भेज रहे हैं...' : 'Sending...') : (lang === 'hi' ? 'OTP भेजें' : 'Send OTP')}
            </button>
          </>
        ) : (
          <>
            <input
              type="tel" placeholder="• • • • • •" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...S.input, textAlign: 'center', letterSpacing: 12, fontSize: 22 }}
              maxLength={6} autoFocus
            />
            <button
              style={S.btn(loading || otp.length < 6)}
              disabled={loading || otp.length < 6}
              onClick={verifyOtp}
            >
              {loading ? (lang === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying...') : (lang === 'hi' ? 'सत्यापित करें' : 'Verify OTP')}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{ ...S.btnOutline, flex: 1 }} onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
                \u2190 {lang === 'hi' ? 'नंबर बदलें' : 'Change number'}
              </button>
              <button
                style={{ ...S.btnOutline, flex: 1, opacity: resendTimer > 0 ? 0.4 : 1 }}
                disabled={resendTimer > 0}
                onClick={() => { setOtp(''); requestOtp(); }}
              >
                {resendTimer > 0 ? `${lang === 'hi' ? 'पुनः भेजें' : 'Resend'} (${resendTimer}s)` : (lang === 'hi' ? 'OTP पुनः भेजें' : 'Resend OTP')}
              </button>
            </div>
          </>
        )}

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{error}</div>}
      </div>
    </div>
  );
}

/* ─── Main Customer Portal ─────────────────────────────────────────────────── */

export default function CustomerPortal() {
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [phoneHash, setPhoneHash] = useState(() => sessionStorage.getItem(HASH_KEY) || '');
  const [transactions, setTransactions] = useState<FailedTxn[]>([]);
  const [singleTxn, setSingleTxn] = useState<FailedTxn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ total: 0, active: 0, resolved: 0 });
  const [helpdeskNumber, setHelpdeskNumber] = useState('1800-123-4567');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  // ─── Session restoration on mount ──────────────────────────────────
  useEffect(() => {
    if (urlToken) return; // skip for token views
    if (!sessionToken) { setLoading(false); return; }
    // Validate session
    fetch(`${API}/customer/session-check/`, {
      headers: { 'X-Customer-Token': sessionToken },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setPhoneHash(data.phone_hash);
        } else {
          // Session expired — clear
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(HASH_KEY);
          setSessionToken('');
          setPhoneHash('');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ─── Token-based single transaction view (SMS link) ────────────────
  useEffect(() => {
    if (!urlToken) return;
    setLoading(true);
    fetch(`${API}/customer/status/${urlToken}/`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSingleTxn(data.transaction);
          // Connect WS for live updates using phone_hash from transaction
          if (data.transaction.phone_hash) {
            setPhoneHash(data.transaction.phone_hash);
          }
        } else {
          setError(lang === 'hi' ? (data.error_hi || data.error) : data.error);
        }
      })
      .catch(() => setError(lang === 'hi' ? 'नेटवर्क त्रुटि।' : 'Network error.'))
      .finally(() => setLoading(false));
  }, [urlToken]);

  // ─── Fetch transactions (authenticated) ────────────────────────────
  const fetchTransactions = useCallback(() => {
    if (!sessionToken) return;
    fetch(`${API}/customer/transactions/`, {
      headers: { 'X-Customer-Token': sessionToken },
    })
      .then(r => {
        if (r.status === 401) {
          // Session expired
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(HASH_KEY);
          setSessionToken('');
          setPhoneHash('');
          setTransactions([]);
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.success) {
          setTransactions(data.transactions);
          setSummary(data.summary);
          if (data.helpdesk_number) setHelpdeskNumber(data.helpdesk_number);
        }
      })
      .catch(() => {});
  }, [sessionToken]);

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 8000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  // ─── WebSocket with robust reconnection ────────────────────────────
  const connectWs = useCallback(() => {
    if (!phoneHash) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('connecting');
    const ws = new WebSocket(`${WS_BASE}${phoneHash}/`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'transaction_update' && msg.transaction) {
          const updated = msg.transaction as FailedTxn;
          // Update in transaction list
          setTransactions(prev => {
            const idx = prev.findIndex(t => t.transaction_ref === updated.transaction_ref);
            if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
            return [updated, ...prev];
          });
          // Update single txn view
          setSingleTxn(prev => prev?.transaction_ref === updated.transaction_ref ? updated : prev);
          // Update summary
          setSummary(prev => {
            const active = updated.status !== 'RESOLVED' ? prev.active : Math.max(0, prev.active - 1);
            const resolved = updated.status === 'RESOLVED' ? prev.resolved + 1 : prev.resolved;
            return { ...prev, active, resolved };
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
      // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 15s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 15000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connectWs, delay);
    };

    ws.onerror = () => { ws.close(); };
  }, [phoneHash]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  // ─── Auth handler ──────────────────────────────────────────────────
  const handleAuth = (token: string, hash: string) => {
    setSessionToken(token);
    setPhoneHash(hash);
    setLoading(false);
  };

  const handleLogout = () => {
    fetch(`${API}/customer/logout/`, {
      method: 'POST',
      headers: { 'X-Customer-Token': sessionToken },
    }).catch(() => {});
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(HASH_KEY);
    setSessionToken('');
    setPhoneHash('');
    setTransactions([]);
    if (wsRef.current) wsRef.current.close();
  };

  /* ─── Render: Token-based single view (SMS link) ────────────────── */
  if (urlToken) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <Header lang={lang} subtitle={lang === 'hi' ? 'लेनदेन की स्थिति' : 'TRANSACTION STATUS'} />
          <LangToggle lang={lang} setLang={setLang} />

          {loading && <LoadingSkeleton />}
          {error && (
            <div style={{ ...S.card, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 8 }}>{error}</div>
              <button style={S.btnOutline} onClick={() => navigate('/customer')}>
                {lang === 'hi' ? 'फ़ोन से लॉगिन करें' : 'Login with phone number'}
              </button>
            </div>
          )}
          {singleTxn && <TransactionCard txn={singleTxn} lang={lang} defaultOpen />}

          {singleTxn && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button style={S.btnOutline} onClick={() => navigate('/customer')}>
                {lang === 'hi' ? 'सभी लेनदेन देखें' : 'View all transactions'}
              </button>
            </div>
          )}

          <WsIndicator status={wsStatus} lang={lang} />
          <TrustFooter lang={lang} helpdesk={helpdeskNumber} />
        </div>
      </div>
    );
  }

  /* ─── Render: Full portal ───────────────────────────────────────── */
  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header lang={lang} subtitle={lang === 'hi' ? 'ग्राहक पोर्टल' : 'CUSTOMER PORTAL'} />
        <LangToggle lang={lang} setLang={setLang} />

        {loading ? <LoadingSkeleton /> : !sessionToken ? (
          <>
            {/* Reassurance banner */}
            <div style={{ ...S.card, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>\ud83d\udee1\ufe0f</div>
              <div style={{ fontSize: 14, color: '#feeaa5', fontWeight: 600, marginBottom: 6 }}>
                {lang === 'hi' ? 'आपका पैसा सुरक्षित है' : 'Your money is safe'}
              </div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                {lang === 'hi'
                  ? 'यदि आपका ATM लेनदेन विफल हो गया है, तो यहां स्थिति देखें। कोई पासवर्ड नहीं — सिर्फ OTP।'
                  : 'If your ATM transaction failed, check its real-time status here. No password needed — just OTP.'}
              </div>
            </div>
            <OTPLogin onAuth={handleAuth} lang={lang} />
          </>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <span style={S.summaryPill('#888')}>
                {lang === 'hi' ? `कुल: ${summary.total}` : `Total: ${summary.total}`}
              </span>
              {summary.active > 0 && (
                <span style={S.summaryPill('#f59e0b')}>
                  {lang === 'hi' ? `सक्रिय: ${summary.active}` : `Active: ${summary.active}`}
                </span>
              )}
              {summary.resolved > 0 && (
                <span style={S.summaryPill('#22c55e')}>
                  {lang === 'hi' ? `हल: ${summary.resolved}` : `Resolved: ${summary.resolved}`}
                </span>
              )}
            </div>

            {transactions.length === 0 && (
              <div style={{ ...S.card, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>\u2705</div>
                <div style={{ fontSize: 14, color: '#22c55e', fontWeight: 600 }}>
                  {lang === 'hi' ? 'कोई विफल लेनदेन नहीं' : 'No failed transactions'}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {lang === 'hi' ? 'सब कुछ ठीक है! आपके सभी लेनदेन सफल रहे।' : 'All good! All your transactions completed successfully.'}
                </div>
              </div>
            )}

            {transactions.map((txn, i) => (
              <TransactionCard
                key={txn.transaction_ref}
                txn={txn}
                lang={lang}
                defaultOpen={i === 0 && txn.status !== 'RESOLVED'}
              />
            ))}

            {/* Helpdesk + Logout */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <a href={`tel:${helpdeskNumber}`} style={{ ...S.btnOutline, flex: 1, textAlign: 'center', textDecoration: 'none', color: '#888' }}>
                \ud83d\udcde {lang === 'hi' ? 'हेल्पडेस्क' : 'Helpdesk'}
              </a>
              <button style={{ ...S.btnOutline, flex: 1 }} onClick={handleLogout}>
                {lang === 'hi' ? 'लॉगआउट' : 'Logout'}
              </button>
            </div>

            <WsIndicator status={wsStatus} lang={lang} />
          </>
        )}

        <TrustFooter lang={lang} helpdesk={helpdeskNumber} />
      </div>
    </div>
  );
}

/* ─── Shared Tiny Components ───────────────────────────────────────────────── */

function Header({ lang, subtitle }: { lang: 'en' | 'hi'; subtitle: string }) {
  return (
    <div style={{ padding: '20px 0 12px', textAlign: 'center', borderBottom: '1px solid #1e1e2e' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#feeaa5', letterSpacing: 1 }}>PayGuard</div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{subtitle}</div>
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: 'en' | 'hi'; setLang: (l: 'en' | 'hi') => void }) {
  return (
    <div style={S.langToggle}>
      <button style={S.langBtn(lang === 'en')} onClick={() => setLang('en')}>English</button>
      <button style={S.langBtn(lang === 'hi')} onClick={() => setLang('hi')}>हिन्दी</button>
    </div>
  );
}

function LoadingSkeleton() {
  const shimmer = { background: 'linear-gradient(90deg, #111118 25%, #1a1a24 50%, #111118 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8 };
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {[1, 2].map(i => (
        <div key={i} style={{ ...S.card, padding: 16 }}>
          <div style={{ ...shimmer, height: 16, width: '60%', marginBottom: 10 }} />
          <div style={{ ...shimmer, height: 12, width: '80%', marginBottom: 8 }} />
          <div style={{ ...shimmer, height: 6, width: '100%' }} />
        </div>
      ))}
    </>
  );
}

function WsIndicator({ status, lang }: { status: string; lang: 'en' | 'hi' }) {
  if (status === 'connected') return null; // hide when working
  const color = status === 'connecting' ? '#f59e0b' : '#ef4444';
  const text = status === 'connecting'
    ? (lang === 'hi' ? 'कनेक्ट हो रहा है...' : 'Connecting...')
    : (lang === 'hi' ? 'ऑफ़लाइन — स्वतः पुनः कनेक्ट' : 'Offline — auto-reconnecting');
  return (
    <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color }}>
      \u25cf {text}
    </div>
  );
}

function TrustFooter({ lang, helpdesk }: { lang: 'en' | 'hi'; helpdesk: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0 8px', fontSize: 10, color: '#444', lineHeight: 1.8 }}>
      <div style={{ width: 60, height: 1, background: '#1e1e2e', margin: '0 auto 12px' }} />
      <div>\ud83c\udfe6 {lang === 'hi' ? 'भारतीय रिज़र्व बैंक विनियमित' : 'Reserve Bank of India Regulated'}</div>
      <div>
        {lang === 'hi' ? 'शिकायत?' : 'Complaint?'} {lang === 'hi' ? 'RBI लोकपाल:' : 'RBI Ombudsman:'} crpc@rbi.org.in
      </div>
      <div>
        {lang === 'hi' ? 'हेल्पलाइन:' : 'Helpline:'} {helpdesk} ({lang === 'hi' ? 'टोल-फ्री' : 'Toll-free'})
      </div>
      <div style={{ marginTop: 6, color: '#2a2a3a' }}>PayGuard ATM Monitoring System</div>
    </div>
  );
}
