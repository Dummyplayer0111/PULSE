import React, { useState } from 'react';
import { CheckCircle, UserPlus, Filter } from 'lucide-react';
import {
  useGetIncidentsQuery,
  useResolveIncidentMutation,
  useAssignIncidentMutation,
} from '../services/pulseApi';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { formatDate, formatConfidence } from '../utils';

const SEVERITIES = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES   = ['ALL', 'OPEN', 'RESOLVED'];

export default function Incidents() {
  const { data: incidents = [], isLoading } = useGetIncidentsQuery();
  const [resolveIncident, { isLoading: resolving }] = useResolveIncidentMutation();
  const [assignIncident,  { isLoading: assigning }] = useAssignIncidentMutation();

  const [severity, setSeverity] = useState('ALL');
  const [status,   setStatus]   = useState('ALL');
  const [assignId, setAssignId] = useState<any>(null);
  const [assignee, setAssignee] = useState('');
  const [actionId, setActionId] = useState<any>(null);

  const filtered = (incidents as any[]).filter((inc: any) => {
    if (severity !== 'ALL' && inc.severity !== severity) return false;
    if (status   !== 'ALL' && inc.status   !== status)   return false;
    return true;
  });

  const handleResolve = async (id: any) => {
    setActionId(id);
    await resolveIncident(id);
    setActionId(null);
  };

  const handleAssign = async () => {
    if (!assignId || !assignee.trim()) return;
    await assignIncident({ id: assignId, body: { assignedTo: assignee } });
    setAssignId(null);
    setAssignee('');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500 mt-1">Track, assign, and resolve all incidents</p>
        </div>
        <span className="text-sm text-gray-400">{filtered.length} results</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-gray-400" />
        <div className="flex gap-1">
          {SEVERITIES.map(s => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                severity === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No incidents match the current filters.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['ID', 'Title', 'Severity', 'Status', 'Root Cause', 'Confidence', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inc: any) => (
                <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{inc.incidentId || inc.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[180px] truncate">{inc.title || '—'}</td>
                  <td className="px-4 py-3"><Badge label={inc.severity} variant="severity" /></td>
                  <td className="px-4 py-3"><Badge label={inc.status}   variant="status"   /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inc.rootCauseCategory || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{formatConfidence(inc.aiConfidence)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(inc.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {inc.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => handleResolve(inc.id)}
                            disabled={actionId === inc.id}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                          >
                            <CheckCircle size={13} />
                            {actionId === inc.id ? '…' : 'Resolve'}
                          </button>
                          <button
                            onClick={() => setAssignId(inc.id)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <UserPlus size={13} />
                            Assign
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign modal */}
      <Modal isOpen={!!assignId} onClose={() => setAssignId(null)} title="Assign Incident" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee (User ID or name)</label>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="e.g. user-uuid or engineer@pulse.com"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setAssignId(null)}>Cancel</Button>
            <Button loading={assigning} onClick={handleAssign} disabled={!assignee.trim()}>Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
