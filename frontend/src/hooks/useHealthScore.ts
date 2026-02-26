import { useMemo } from 'react';

export type HealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';

export interface HealthBreakdown {
  network:     number;
  hardware:    number;
  software:    number;
  transaction: number;
}

/**
 * useHealthScore — derives composite status and color from health sub-scores.
 * Mirrors the logic used in HealthSnapshot model.
 */
export function useHealthScore(snapshot: HealthBreakdown | null) {
  return useMemo(() => {
    if (!snapshot) return { score: 0, status: 'OFFLINE' as HealthStatus, color: '#ef4444', label: 'OFFLINE' };

    const score = Math.round(
      (snapshot.network + snapshot.hardware + snapshot.software + snapshot.transaction) / 4
    );

    let status: HealthStatus;
    let color: string;

    if (score >= 80)      { status = 'ONLINE';      color = '#22c55e'; }
    else if (score >= 50) { status = 'DEGRADED';    color = '#f59e0b'; }
    else if (score >= 20) { status = 'OFFLINE';     color = '#ef4444'; }
    else                  { status = 'MAINTENANCE'; color = '#6b7280'; }

    return { score, status, color, label: `${score}%` };
  }, [snapshot]);
}
