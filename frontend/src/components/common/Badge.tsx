import React from 'react';
import { severityColors, statusColors, logLevelColors } from '../../utils';

type BadgeVariant = 'severity' | 'status' | 'logLevel' | 'auto';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const SEVERITY_KEYS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_KEYS   = ['OPEN', 'RESOLVED', 'ACTIVE', 'ACKNOWLEDGED', 'ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE', 'PENDING', 'SUCCESS', 'FAILED'];
const LOG_KEYS      = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];

function autoDetect(label: string): BadgeVariant {
  if (SEVERITY_KEYS.includes(label)) return 'severity';
  if (STATUS_KEYS.includes(label))   return 'status';
  if (LOG_KEYS.includes(label))      return 'logLevel';
  return 'status';
}

export default function Badge({ label, variant = 'auto', className = '' }: BadgeProps) {
  const resolved = variant === 'auto' ? autoDetect(label) : variant;
  const colors =
    resolved === 'severity' ? severityColors(label) :
    resolved === 'logLevel' ? logLevelColors(label) :
    statusColors(label);

  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${colors} ${className}`}>
      {label}
    </span>
  );
}
