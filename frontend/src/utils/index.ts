/** Format ISO date string to readable local date */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format ISO date string to readable local datetime */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Format a float confidence score (0–1) as a percentage string */
export function formatConfidence(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${(score * 100).toFixed(1)}%`;
}

/** Truncate a UUID to first 8 chars for display */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return String(id).slice(0, 8) + '…';
}

/** Map severity → Tailwind color classes */
export function severityColors(severity: string): string {
  const map: Record<string, string> = {
    LOW:      'bg-green-50 text-green-700',
    MEDIUM:   'bg-amber-50 text-amber-700',
    HIGH:     'bg-orange-50 text-orange-700',
    CRITICAL: 'bg-red-50 text-red-700',
  };
  return map[severity] ?? 'bg-gray-50 text-gray-700';
}

/** Map status → Tailwind color classes */
export function statusColors(status: string): string {
  const map: Record<string, string> = {
    OPEN:        'bg-blue-50 text-blue-700',
    RESOLVED:    'bg-green-50 text-green-700',
    ACTIVE:      'bg-blue-50 text-blue-700',
    ACKNOWLEDGED:'bg-purple-50 text-purple-700',
    ONLINE:      'bg-green-50 text-green-700',
    OFFLINE:     'bg-red-50 text-red-700',
    DEGRADED:    'bg-amber-50 text-amber-700',
    MAINTENANCE: 'bg-gray-50 text-gray-600',
    PENDING:     'bg-gray-50 text-gray-600',
    SUCCESS:     'bg-green-50 text-green-700',
    FAILED:      'bg-red-50 text-red-700',
  };
  return map[status] ?? 'bg-gray-50 text-gray-700';
}

/** Map log level → Tailwind color classes */
export function logLevelColors(level: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-50 text-red-700',
    ERROR:    'bg-orange-50 text-orange-700',
    WARN:     'bg-amber-50 text-amber-700',
    INFO:     'bg-gray-50 text-gray-600',
  };
  return map[level] ?? 'bg-gray-50 text-gray-700';
}
