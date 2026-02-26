import React, { useState } from 'react';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { useGetChannelsQuery } from '../services/pulseApi';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';

function TokenRow({ label, storageKey }: { label: string; storageKey: string }) {
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem(storageKey) ?? '';
  const display = token ? `${token.slice(0, 24)}…` : 'Not set';

  const copy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{display}</p>
      </div>
      <button
        onClick={copy}
        disabled={!token}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors"
      >
        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function Settings() {
  const { data: channels = [], isLoading, error } = useGetChannelsQuery();

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">System configuration and credentials</p>
      </div>

      {/* API Config */}
      <Card title="API Configuration" subtitle="Backend connection settings">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Base URL</p>
            <p className="text-sm font-mono text-gray-900 mt-0.5">http://localhost:8000/api/</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">WebSocket (Dashboard)</p>
            <p className="text-sm font-mono text-gray-900 mt-0.5">ws://localhost:8000/ws/dashboard/</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">WebSocket (Logs)</p>
            <p className="text-sm font-mono text-gray-900 mt-0.5">ws://localhost:8000/ws/logs/{'<atm_id>'}/ </p>
          </div>
        </div>
      </Card>

      {/* JWT Tokens */}
      <Card title="JWT Tokens" subtitle="Currently stored authentication tokens">
        <div>
          <TokenRow label="Access Token"  storageKey="access_token"  />
          <TokenRow label="Refresh Token" storageKey="refresh_token" />
        </div>
      </Card>

      {/* Payment Channels */}
      <Card title="Payment Channels" subtitle="Registered payment channel endpoints" padding={false}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle size={28} className="text-amber-400 mx-auto" />
            <p className="text-gray-500 text-sm">PaymentChannel model not yet implemented.</p>
          </div>
        ) : (channels as any[]).length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payment channels configured.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['ID', 'Name', 'Type', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(channels as any[]).map((ch: any) => (
                <tr key={ch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{ch.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{ch.name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ch.type || '—'}</td>
                  <td className="px-4 py-3">{ch.status && <Badge label={ch.status} variant="status" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Backend status */}
      <Card title="Backend Status" subtitle="Known implementation gaps to complete">
        <ul className="space-y-2">
          {[
            { label: 'ATM model',                  done: false },
            { label: 'PaymentChannel model',        done: false },
            { label: 'CustomerNotification model',  done: false },
            { label: 'MessageTemplate model',       done: false },
            { label: 'JWT auth endpoints',          done: true  },
            { label: 'Incident CRUD',               done: true  },
            { label: 'Log ingestion + filtering',   done: true  },
            { label: 'Anomaly flags',               done: true  },
            { label: 'Self-heal actions',           done: true  },
          ].map(({ label, done }) => (
            <li key={label} className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${done ? 'bg-green-500' : 'bg-amber-400'}`} />
              <span className="text-sm text-gray-700">{label}</span>
              <span className={`ml-auto text-xs font-medium ${done ? 'text-green-600' : 'text-amber-600'}`}>
                {done ? 'Done' : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
