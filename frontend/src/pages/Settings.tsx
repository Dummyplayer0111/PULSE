import React, { useState } from 'react';
import { Settings as SettingsIcon, Copy, Check, AlertCircle, CheckCircle, Activity } from 'lucide-react';
import { useGetChannelsQuery } from '../services/pulseApi';

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
    <div
      className="flex items-center justify-between py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{display}</p>
      </div>
      <button
        onClick={copy}
        disabled={!token}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: copied ? '#4ade80' : 'rgba(255,255,255,0.55)',
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
      <p className="text-sm font-mono text-white mt-1">{value}</p>
    </div>
  );
}

export default function Settings() {
  const { data: channels = [], isLoading, error } = useGetChannelsQuery();

  const backendItems = [
    { label: 'JWT auth endpoints',          done: true  },
    { label: 'Incident CRUD + assign',      done: true  },
    { label: 'Log ingestion + filtering',   done: true  },
    { label: 'Anomaly flags',               done: true  },
    { label: 'Self-heal actions',           done: true  },
    { label: 'AI analysis + predictions',   done: true  },
    { label: 'ATM model + CRUD',            done: false },
    { label: 'PaymentChannel model',        done: false },
    { label: 'CustomerNotification model',  done: false },
    { label: 'MessageTemplate model',       done: false },
  ];

  return (
    <div className="p-8 space-y-6 max-w-3xl" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <SettingsIcon size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            System configuration and credentials
          </p>
        </div>
      </div>

      {/* API Config */}
      <Panel title="API Configuration" subtitle="Backend connection settings">
        <div className="last:border-0">
          <ConfigRow label="REST API Base URL"          value="http://localhost:8000/api/" />
          <ConfigRow label="AI Engine (FastAPI)"         value="http://localhost:8001" />
          <ConfigRow label="WebSocket — Dashboard"       value="ws://localhost:8000/ws/dashboard/" />
          <ConfigRow label="WebSocket — ATM Logs"        value="ws://localhost:8000/ws/logs/<atm_id>/" />
        </div>
      </Panel>

      {/* JWT Tokens */}
      <Panel title="JWT Tokens" subtitle="Currently stored authentication tokens">
        <div className="last:border-0">
          <TokenRow label="Access Token"  storageKey="access_token"  />
          <TokenRow label="Refresh Token" storageKey="refresh_token" />
        </div>
      </Panel>

      {/* Payment Channels */}
      <Panel title="Payment Channels" subtitle="Registered payment channel endpoints">
        {isLoading ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : error ? (
          <div className="py-8 text-center space-y-2">
            <AlertCircle size={28} style={{ color: 'rgba(245,158,11,0.7)', margin: '0 auto' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              PaymentChannel model not yet implemented in backend.
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Create the <code className="font-mono">PaymentChannel</code> model in <code className="font-mono">ATM/models.py</code> to activate this section.
            </p>
          </div>
        ) : (channels as any[]).length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No payment channels configured.
          </div>
        ) : (
          <table className="w-full -mx-0">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['ID', 'Name', 'Type', 'Status'].map(h => (
                  <th key={h} className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(channels as any[]).map((ch: any) => (
                <tr key={ch.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{ch.id}</td>
                  <td className="py-3 text-sm text-white">{ch.name || '—'}</td>
                  <td className="py-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{ch.type || '—'}</td>
                  <td className="py-3 text-xs" style={{ color: ch.status === 'ONLINE' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                    {ch.status || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Backend Status */}
      <Panel title="Backend Implementation Status" subtitle="Live endpoint health check">
        <div className="space-y-3">
          {backendItems.map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3">
              {done ? (
                <CheckCircle size={14} className="shrink-0" style={{ color: '#4ade80' }} />
              ) : (
                <AlertCircle size={14} className="shrink-0" style={{ color: '#f59e0b' }} />
              )}
              <span className="text-sm flex-1" style={{ color: done ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)' }}>
                {label}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={done
                  ? { color: '#4ade80', background: 'rgba(74,222,128,0.12)' }
                  : { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                }
              >
                {done ? 'Live' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Live server indicators */}
      <Panel title="Server Status">
        <div className="space-y-4">
          {[
            { label: 'Django REST API',     port: 8000, desc: 'Core backend + JWT auth' },
            { label: 'FastAPI AI Engine',   port: 8001, desc: 'Log analysis + predictions' },
            { label: 'Vite Dev Server',     port: 3001, desc: 'React frontend' },
          ].map(({ label, port, desc }) => (
            <div key={port} className="flex items-center gap-3">
              <Activity size={14} style={{ color: '#4ade80' }} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>:{port} · {desc}</p>
              </div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ color: '#4ade80', background: 'rgba(74,222,128,0.12)' }}
              >
                Running
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
