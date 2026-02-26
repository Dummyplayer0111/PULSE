import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey?: (row: T) => string | number;
}

export default function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found.',
  rowKey = (row) => row.id,
}: TableProps<T>) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {loading ? (
        <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <AlertCircle size={28} className="text-gray-200 mx-auto" />
          <p className="text-gray-400 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(row => (
              <tr key={rowKey(row)} className="hover:bg-gray-50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
