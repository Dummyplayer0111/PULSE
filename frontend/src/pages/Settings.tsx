import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Copy, Check, AlertCircle, CheckCircle,
  Activity, Shield, Zap, Brain, Sliders, ToggleLeft, ToggleRight, Save,
  Play, Square, Radio, Sun, Moon,
} from 'lucide-react';
import {
  useGetChannelsQuery,
  useGetSimulatorStatusQuery,
  useStartSimulatorMutation,
  useStopSimulatorMutation,
} from '../services/payguardApi';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = { critical: 30, high: 50, medium: 70 };
const DEFAULT_HEAL_RULES: Record<string, boolean> = {
  SWITCH_NETWORK:  true,
  RESTART_SERVICE: true,
  FLUSH_CACHE:     true,
  REROUTE_TRAFFIC: true,
  ALERT_ENGINEER:  true,
  FREEZE_ATM:      true,
};
const DEFAULT_AI_CONF = 0.65;

const HEAL_DESCRIPTIONS: Record<string, string> = {
  SWITCH_NETWORK:  'Switch to backup network path on NETWORK failures',
  RESTART_SERVICE: 'Restart ATM service process on SWITCH / SERVER failures',
  FLUSH_CACHE:     'Flush cache + retry queue on TIMEOUT failures',
  REROUTE_TRAFFIC: 'Reroute payment traffic to alternate gateway',
  ALERT_ENGINEER:  'Dispatch field engineer for CASH_JAM / HARDWARE failures',
  FREEZE_ATM:      'Freeze ATM immediately on FRAUD / MALWARE detection',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useLocalStorage<T>(key: string, def: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return def; }
  });
  const set = (v: T) => { localStorage.setItem(key, JSON.stringify(v)); setVal(v); };
  return [val, set];
}

function TokenRow({ label, storageKey }: { label: string; storageKey: string }) {
  const [copied, setCopied] = useState(false);
  const token   = localStorage.getItem(storageKey) ?? '';
  const display = token ? `${token.slice(0, 28)}…` : 'Not set';
  const copy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between py-4" style={{ borderBottom: '1px solid var(--p-card-border)' }}>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{display}</p>
      </div>
      <button
        onClick={copy}
        disabled={!token}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
        style={{ background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: copied ? '#4ade80' : 'rgba(255,255,255,0.55)' }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, iconColor, children }: {
  title: string; subtitle?: string; icon: any; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}>
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--p-card-border)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Simulator Panel ───────────────────────────────────────────────────────────

function SimulatorPanel() {
  const { data: status } = useGetSimulatorStatusQuery(undefined, { pollingInterval: 5000 });
  const [startSimulator, { isLoading: starting }] = useStartSimulatorMutation();
  const [stopSimulator,  { isLoading: stopping  }] = useStopSimulatorMutation();

  const running = status?.running ?? false;
  const eventCount = status?.events_sent ?? status?.eventCount ?? null;

  return (
    <Panel title="ATM Simulator" subtitle="Generate synthetic log events for demo" icon={Radio} iconColor="#34d399">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: running ? 'rgba(52,211,153,0.12)' : 'var(--p-card)',
              border: running ? '1px solid rgba(52,211,153,0.3)' : '1px solid var(--p-card-border)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: running ? '#34d399' : '#6b7280',
                boxShadow: running ? '0 0 6px #34d399' : 'none',
                animation: running ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span className="text-xs font-semibold" style={{ color: running ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
              {running ? 'Running' : 'Stopped'}
            </span>
          </div>
          {eventCount != null && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {eventCount} events sent
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startSimulator()}
            disabled={running || starting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
          >
            <Play size={13} />
            {starting ? 'Starting…' : 'Start'}
          </button>
          <button
            onClick={() => stopSimulator()}
            disabled={!running || stopping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
          >
            <Square size={13} />
            {stopping ? 'Stopping…' : 'Stop'}
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ─── Alert Threshold Panel ─────────────────────────────────────────────────────

function AlertThresholdsPanel() {
  const [thresholds, setThresholds] = useLocalStorage('payguard_thresholds', DEFAULT_THRESHOLDS);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [local, setLocal] = useState(thresholds);

  useEffect(() => { setLocal(thresholds); }, []);

  const update = (k: keyof typeof DEFAULT_THRESHOLDS, v: number) => {
    setLocal(prev => ({ ...prev, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  const save = () => {
    setThresholds(local);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tiers: { key: keyof typeof DEFAULT_THRESHOLDS; label: string; color: string; desc: string }[] = [
    { key: 'critical', label: 'CRITICAL threshold', color: '#ef4444', desc: 'health score below this → CRITICAL severity' },
    { key: 'high',     label: 'HIGH threshold',     color: '#f97316', desc: 'health score below this → HIGH severity' },
    { key: 'medium',   label: 'MEDIUM threshold',   color: '#f59e0b', desc: 'health score below this → MEDIUM severity' },
  ];

  return (
    <Panel title="Alert Thresholds" subtitle="Health score cutoffs per severity level" icon={Sliders} iconColor="#f97316">
      <div className="space-y-5">
        {tiers.map(({ key, label, color, desc }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={local[key]}
                  onChange={e => update(key, Number(e.target.value))}
                  className="w-28"
                  style={{ accentColor: color }}
                />
                <span
                  className="text-sm font-bold w-8 text-right"
                  style={{ color }}
                >
                  {local[key]}
                </span>
              </div>
            </div>
            <div className="relative rounded-full overflow-hidden" style={{ height: 6, background: 'var(--p-card-strong)' }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{ width: `${local[key]}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 rounded-full"
                style={{ left: `${local[key]}%`, background: color, boxShadow: `0 0 4px ${color}` }}
              />
            </div>
          </div>
        ))}

        <button
          onClick={save}
          disabled={!dirty}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 mt-2"
          style={{
            background: saved ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
            border: saved ? '1px solid rgba(74,222,128,0.3)' : '1px solid var(--p-card-border)',
            color: saved ? '#4ade80' : 'white',
          }}
        >
          {saved ? <><Check size={13} /> Saved!</> : <><Save size={13} /> Save Thresholds</>}
        </button>
      </div>
    </Panel>
  );
}

// ─── Self-Heal Rules Panel ─────────────────────────────────────────────────────

function SelfHealRulesPanel() {
  const [rules, setRules] = useLocalStorage('payguard_heal_rules', DEFAULT_HEAL_RULES);
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => {
    const updated = { ...rules, [key]: !rules[key] };
    setRules(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const actionColors: Record<string, string> = {
    SWITCH_NETWORK:  '#4ade80',
    RESTART_SERVICE: '#60a5fa',
    FLUSH_CACHE:     '#f59e0b',
    REROUTE_TRAFFIC: '#a78bfa',
    ALERT_ENGINEER:  '#f97316',
    FREEZE_ATM:      '#ef4444',
  };

  return (
    <Panel title="Self-Heal Rules" subtitle="Toggle automated remediation actions on or off" icon={Zap} iconColor="#4ade80">
      <div className="space-y-3">
        {Object.entries(DEFAULT_HEAL_DESCRIPTIONS ?? HEAL_DESCRIPTIONS).map(([key, desc]) => {
          const enabled = rules[key] ?? true;
          const color = actionColors[key] ?? '#6b7280';
          return (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-xl transition-all"
              style={{
                background: enabled ? `${color}08` : 'var(--p-card)',
                border: `1px solid ${enabled ? color + '22' : 'var(--p-card-strong)'}`,
              }}
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-semibold" style={{ color: enabled ? color : 'rgba(255,255,255,0.35)' }}>
                  {key.replace('_', ' ')}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
              </div>
              <button
                onClick={() => toggle(key)}
                className="shrink-0 transition-all"
                title={enabled ? 'Click to disable' : 'Click to enable'}
              >
                {enabled
                  ? <ToggleRight size={28} style={{ color }} />
                  : <ToggleLeft  size={28} style={{ color: 'rgba(255,255,255,0.2)' }} />
                }
              </button>
            </div>
          );
        })}
        {saved && (
          <p className="text-[11px] flex items-center gap-1" style={{ color: '#4ade80' }}>
            <Check size={11} /> Rule saved
          </p>
        )}
      </div>
    </Panel>
  );
}

// ─── AI Config Panel ───────────────────────────────────────────────────────────

function AIConfigPanel() {
  const [conf, setConf] = useLocalStorage('payguard_ai_conf', DEFAULT_AI_CONF);
  const [localConf, setLocalConf] = useState(conf);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setConf(localConf);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const pct = Math.round(localConf * 100);
  const color = pct >= 80 ? '#4ade80' : pct >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <Panel title="AI Engine Configuration" subtitle="Classifier confidence and trigger settings" icon={Brain} iconColor="#a855f7">
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Minimum Confidence Threshold</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Only create incidents when AI confidence ≥ this value
              </p>
            </div>
            <span className="text-xl font-bold" style={{ color }}>{pct}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={99}
            step={1}
            value={Math.round(localConf * 100)}
            onChange={e => { setLocalConf(Number(e.target.value) / 100); setSaved(false); }}
            className="w-full"
            style={{ accentColor: '#a855f7' }}
          />
          <div className="flex justify-between text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span>50% (permissive)</span>
            <span>99% (strict)</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Conservative', value: 0.85, desc: 'Fewer alerts, high precision' },
            { label: 'Balanced',     value: 0.65, desc: 'Recommended for demo' },
            { label: 'Aggressive',   value: 0.50, desc: 'More alerts, lower precision' },
          ].map(({ label, value, desc }) => (
            <button
              key={label}
              onClick={() => { setLocalConf(value); setSaved(false); }}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                background: Math.abs(localConf - value) < 0.01 ? 'rgba(168,85,247,0.15)' : 'var(--p-card)',
                border: Math.abs(localConf - value) < 0.01 ? '1px solid rgba(168,85,247,0.4)' : '1px solid var(--p-card-border)',
              }}
            >
              <p className="text-xs font-semibold text-white">{label}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
              <p className="text-sm font-bold mt-1" style={{ color: '#a855f7' }}>{Math.round(value * 100)}%</p>
            </button>
          ))}
        </div>

        <button
          onClick={save}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: saved ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
            border: saved ? '1px solid rgba(74,222,128,0.3)' : '1px solid var(--p-card-border)',
            color: saved ? '#4ade80' : 'white',
          }}
        >
          {saved ? <><Check size={13} /> Applied!</> : <><Save size={13} /> Apply Config</>}
        </button>
      </div>
    </Panel>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

export default function Settings() {
  const { data: channels = [], isLoading, error } = useGetChannelsQuery();

  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(
    () => (document.documentElement.getAttribute('data-theme') as any) ?? 'dark'
  );

  useEffect(() => {
    const handler = (e: Event) =>
      setCurrentTheme((e as CustomEvent).detail as 'dark' | 'light');
    window.addEventListener('payguard-theme-change', handler);
    return () => window.removeEventListener('payguard-theme-change', handler);
  }, []);

  const toggleTheme = () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('payguard-theme', next);
    window.dispatchEvent(new CustomEvent('payguard-theme-change', { detail: next }));
  };

  return (
    <div className="p-6 space-y-4" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--p-card-border)' }}>
          <SettingsIcon size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>System configuration and engine controls</p>
        </div>
      </div>

      {/* Appearance */}
      <Panel title="Appearance" subtitle="Interface theme preference" icon={currentTheme === 'dark' ? Moon : Sun} iconColor="#60a5fa">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {currentTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
              {currentTheme === 'dark'
                ? 'Black glass interface — recommended'
                : 'Soft blue-white with dark glass cards'}
            </p>
          </div>
          <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-text)', padding: 0 }}>
            {currentTheme === 'dark'
              ? <ToggleRight size={36} style={{ color: '#4ade80' }} />
              : <ToggleLeft  size={36} style={{ color: 'rgba(255,255,255,0.3)' }} />}
          </button>
        </div>
      </Panel>

      {/* Simulator */}
      <SimulatorPanel />

      {/* Alert Thresholds */}
      <AlertThresholdsPanel />

      {/* Self-Heal Rules */}
      <SelfHealRulesPanel />

      {/* AI Config */}
      <AIConfigPanel />

      {/* API Config */}
      <Panel title="API Configuration" subtitle="Service endpoint addresses" icon={Activity} iconColor="#60a5fa">
        <div className="space-y-0">
          {[
            { label: 'REST API Base URL',          value: 'http://localhost:8000/api/' },
            { label: 'AI Engine (FastAPI)',          value: 'http://localhost:8001' },
            { label: 'WebSocket — Dashboard',       value: 'ws://localhost:8000/ws/dashboard/' },
            { label: 'WebSocket — ATM Logs',        value: 'ws://localhost:8000/ws/logs/<atm_id>/' },
          ].map(({ label, value }) => (
            <div key={label} className="py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
              <p className="text-sm font-mono text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* JWT Tokens */}
      <Panel title="JWT Tokens" subtitle="Currently stored authentication tokens" icon={Shield} iconColor="#a855f7">
        <div>
          <TokenRow label="Access Token"  storageKey="access_token" />
          <TokenRow label="Refresh Token" storageKey="refresh_token" />
        </div>
      </Panel>

      {/* Payment Channels */}
      <Panel title="Payment Channels" subtitle="Registered payment channel endpoints" icon={Activity} iconColor="#34d399">
        {isLoading ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : error ? (
          <div className="py-6 text-center">
            <AlertCircle size={24} style={{ color: '#f59e0b', margin: '0 auto 8px' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>PaymentChannel data unavailable</p>
          </div>
        ) : (channels as any[]).length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No payment channels configured.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                {['ID', 'Name', 'Type', 'Status'].map(h => (
                  <th key={h} className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(channels as any[]).map((ch: any) => (
                <tr key={ch.id} style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                  <td className="py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{ch.id}</td>
                  <td className="py-3 text-sm text-white">{ch.name || '—'}</td>
                  <td className="py-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{ch.type || '—'}</td>
                  <td className="py-3">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        color: ch.status === 'ONLINE' || ch.status === 'ACTIVE' ? '#4ade80' : '#ef4444',
                        background: ch.status === 'ONLINE' || ch.status === 'ACTIVE' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                      }}
                    >
                      {ch.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Server Status */}
      <Panel title="Server Status" subtitle="Running services" icon={Activity} iconColor="#4ade80">
        <div className="space-y-3">
          {[
            { label: 'Django REST API',   port: 8000, desc: 'Core backend + JWT auth + WebSocket' },
            { label: 'FastAPI AI Engine', port: 8001, desc: 'Log analysis + predictions + anomaly detection' },
            { label: 'Vite Dev Server',   port: 3001, desc: 'React 19 frontend' },
          ].map(({ label, port, desc }) => (
            <div key={port} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>:{port} · {desc}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: '#4ade80', background: 'rgba(74,222,128,0.12)' }}>
                Running
              </span>
            </div>
          ))}
        </div>
      </Panel>

    </div>
  );
}

// suppress unused warning for variable used in JSX only
const DEFAULT_HEAL_DESCRIPTIONS = HEAL_DESCRIPTIONS;
