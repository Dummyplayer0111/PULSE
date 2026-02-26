import React from 'react';
import { AlertTriangle, Activity, ShieldAlert, FileText } from 'lucide-react';
import { useGetIncidentsQuery, useGetAnomalyFlagsQuery, useGetLogsQuery } from '../services/pulseApi';
import Badge from '../components/common/Badge';
import Card from '../components/common/Card';
import { formatDate, formatConfidence } from '../utils';

function StatCard({ label, value, Icon, accent }: { label: string; value: string | number; Icon: any; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: incidents = [], isLoading: incLoading } = useGetIncidentsQuery();
  const { data: anomalies = [], isLoading: anoLoading } = useGetAnomalyFlagsQuery();
  const { data: logs      = [], isLoading: logLoading } = useGetLogsQuery();

  const loading         = incLoading || anoLoading || logLoading;
  const openIncidents   = incidents.filter((i: any) => i.status === 'OPEN').length;
  const criticalCount   = incidents.filter((i: any) => i.severity === 'CRITICAL').length;
  const activeAnomalies = anomalies.filter((a: any) => a.status === 'ACTIVE').length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">PULSE Operations Center Overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Open Incidents"    value={loading ? '—' : openIncidents}   Icon={AlertTriangle} accent="bg-blue-50 text-blue-600"   />
        <StatCard label="Critical"          value={loading ? '—' : criticalCount}   Icon={Activity}      accent="bg-red-50 text-red-600"    />
        <StatCard label="Active Anomalies"  value={loading ? '—' : activeAnomalies} Icon={ShieldAlert}   accent="bg-amber-50 text-amber-600" />
        <StatCard label="Total Logs"        value={loading ? '—' : logs.length}      Icon={FileText}      accent="bg-green-50 text-green-600" />
      </div>

      {/* Recent incidents */}
      <Card title="Recent Incidents" padding={false}>
        {incLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : incidents.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No incidents yet.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Incident ID', 'Title', 'Severity', 'Status', 'Root Cause', 'Created'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(incidents as any[]).slice(0, 6).map((inc: any) => (
                <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{inc.incidentId || inc.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">{inc.title || '—'}</td>
                  <td className="px-4 py-3"><Badge label={inc.severity} variant="severity" /></td>
                  <td className="px-4 py-3"><Badge label={inc.status} variant="status" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inc.rootCauseCategory || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(inc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Recent anomalies */}
      <Card title="Recent Anomaly Flags" padding={false}>
        {anoLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : anomalies.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No anomalies detected.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Type', 'Confidence', 'Status', 'Notes', 'Detected'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(anomalies as any[]).slice(0, 5).map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900">{a.anomalyType}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatConfidence(a.confidenceScore)}</td>
                  <td className="px-4 py-3"><Badge label={a.status} variant="status" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{a.notes || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
