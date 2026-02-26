import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useGetAnomalyFlagsQuery, useUpdateAnomalyFlagMutation } from '../services/pulseApi';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { formatDate, formatConfidence, shortId } from '../utils';

const STATUSES = ['ACTIVE', 'REVIEWED', 'DISMISSED', 'FALSE_POSITIVE'];

export default function Anomaly() {
  const { data: flags = [], isLoading } = useGetAnomalyFlagsQuery();
  const [updateFlag, { isLoading: updating }] = useUpdateAnomalyFlagMutation();

  const [editId,     setEditId]     = useState<any>(null);
  const [newStatus,  setNewStatus]  = useState('REVIEWED');
  const [notes,      setNotes]      = useState('');

  const handleUpdate = async () => {
    if (!editId) return;
    await updateFlag({ id: editId, body: { status: newStatus, notes } });
    setEditId(null);
    setNotes('');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert size={24} className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anomaly Detection</h1>
          <p className="text-sm text-gray-500 mt-1">Review and triage detected anomaly flags</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : (flags as any[]).length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No anomaly flags detected.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Source', 'Type', 'Confidence', 'Status', 'Notes', 'Detected', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(flags as any[]).map((flag: any) => (
                <tr key={flag.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs font-mono text-gray-500">{shortId(flag.sourceId)}</p>
                      <p className="text-xs text-gray-400">{flag.sourceType}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {flag.anomalyType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatConfidence(flag.confidenceScore)}
                  </td>
                  <td className="px-4 py-3"><Badge label={flag.status || 'ACTIVE'} variant="status" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                    {flag.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(flag.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setEditId(flag.id); setNotes(flag.notes || ''); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Update modal */}
      <Modal isOpen={!!editId} onClose={() => setEditId(null)} title="Update Anomaly Flag" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">New Status</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setEditId(null)}>Cancel</Button>
            <Button loading={updating} onClick={handleUpdate}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
