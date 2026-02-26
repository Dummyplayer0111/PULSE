import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../common/Badge';
import HealthGauge from '../charts/HealthGauge';

interface SidePanelProps {
  atm: any;
  onClose: () => void;
}

export default function SidePanel({ atm, onClose }: SidePanelProps) {
  if (!atm) return null;

  const score = atm.healthScore ?? 0;

  return (
    <div className="w-80 bg-white border-l border-gray-100 h-full flex flex-col shadow-xl z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">{atm.name || `ATM #${atm.id}`}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{atm.location || 'Location not set'}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Health */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-5">
        <HealthGauge score={score} label="Health" size={90} />
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-400">Status</p>
            {atm.status ? <Badge label={atm.status} /> : <span className="text-xs text-gray-500">—</span>}
          </div>
          <div>
            <p className="text-xs text-gray-400">Model</p>
            <p className="text-sm text-gray-900">{atm.model || '—'}</p>
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-gray-100">
        {[
          { label: 'Network',     key: 'networkScore'     },
          { label: 'Hardware',    key: 'hardwareScore'    },
          { label: 'Software',    key: 'softwareScore'    },
          { label: 'Transaction', key: 'transactionScore' },
        ].map(({ label, key }) => (
          <div key={key} className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">
              {atm[key] != null ? `${atm[key]}%` : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-2.5 flex-1 overflow-y-auto">
        {[
          { label: 'ATM ID',    value: atm.id   },
          { label: 'Address',   value: atm.address   },
          { label: 'Region',    value: atm.region    },
          { label: 'Last Seen', value: atm.lastSeen   },
        ].filter(r => r.value).map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm text-gray-900">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100">
        <Link
          to={`/atm-detail/${atm.id}`}
          className="flex items-center justify-center gap-2 w-full bg-[#2563EB] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ExternalLink size={14} />
          View Full Detail
        </Link>
      </div>
    </div>
  );
}
