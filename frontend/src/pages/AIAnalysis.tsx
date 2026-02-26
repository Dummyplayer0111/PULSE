import React, { useState } from 'react';
import { Brain, Send } from 'lucide-react';
import {
  useAnalyzeLogMutation,
  useGetAIPredictionsQuery,
  useGetRootCauseStatsQuery,
} from '../services/pulseApi';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import DonutChart from '../components/charts/DonutChart';

const ROOT_CAUSE_COLORS: Record<string, string> = {
  NETWORK:  '#2563eb',
  CASH_JAM: '#f59e0b',
  SWITCH:   '#8b5cf6',
  SERVER:   '#ef4444',
  FRAUD:    '#dc2626',
  TIMEOUT:  '#6b7280',
  HARDWARE: '#f97316',
  UNKNOWN:  '#d1d5db',
};

export default function AIAnalysis() {
  const [logText, setLogText]   = useState('');
  const [result, setResult]     = useState<any>(null);

  const [analyzeLog, { isLoading: analyzing }] = useAnalyzeLogMutation();
  const { data: predictions, isLoading: predLoading } = useGetAIPredictionsQuery();
  const { data: stats,       isLoading: statsLoading } = useGetRootCauseStatsQuery();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logText.trim()) return;
    const res = await analyzeLog({ message: logText }) as any;
    setResult(res.data ?? res.error?.data ?? null);
  };

  // Build donut chart data from root cause stats
  const donutData = Array.isArray(stats?.stats)
    ? stats.stats.map((s: any) => ({
        label: s.category ?? s.label ?? 'UNKNOWN',
        value: s.count ?? 0,
        color: ROOT_CAUSE_COLORS[s.category ?? s.label] ?? '#d1d5db',
      })).filter((d: any) => d.value > 0)
    : [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Root cause classification, failure predictions, and statistics</p>
      </div>

      {/* Analyze log */}
      <Card title="Analyze Log" subtitle="Paste a raw log message to classify root cause">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <textarea
            value={logText}
            onChange={e => setLogText(e.target.value)}
            rows={5}
            placeholder={`Paste a raw log message…\ne.g. 2024-01-15 14:23:11 ERROR ATM-007 NETWORK_TIMEOUT: Failed to connect to switch after 3 retries`}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <Button type="submit" loading={analyzing} disabled={!logText.trim()} icon={<Send size={14} />}>
            Analyze
          </Button>
        </form>

        {result && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">AI Result</p>
            </div>
            <pre className="text-sm text-gray-900 font-mono whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Predictions */}
        <Card title="Predicted Failures" subtitle="Upcoming incidents predicted by the AI model">
          {predLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !predictions?.predictions?.length ? (
            <p className="text-sm text-gray-400">
              No predictions yet. The AI will generate predictions as it processes more log data.
            </p>
          ) : (
            <ul className="space-y-2">
              {predictions.predictions.map((p: any, i: number) => (
                <li key={i} className="border border-gray-100 rounded-lg p-3 text-sm text-gray-700">
                  {JSON.stringify(p)}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Root cause stats */}
        <Card title="Root Cause Distribution" subtitle="Breakdown of resolved incident root causes">
          {statsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : donutData.length === 0 ? (
            <p className="text-sm text-gray-400">
              No statistics yet. Stats are computed from resolved incidents.
            </p>
          ) : (
            <div className="flex justify-center py-4">
              <DonutChart data={donutData} size={200} title="Root Causes" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
