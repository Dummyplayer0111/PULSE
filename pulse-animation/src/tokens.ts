export const T = {
  bg:          '#060606',
  card:        'rgba(196,151,70,0.045)',
  cardStrong:  'rgba(196,151,70,0.08)',
  cardBorder:  'rgba(196,151,70,0.13)',
  cardHover:   'rgba(196,151,70,0.07)',
  specular:    'rgba(196,151,70,0.18)',
  gold:        '#e8af48',
  goldDim:     '#c49746',
  text:        '#f8f8f8',
  dim:         'rgba(220,190,145,0.55)',
  vdim:        'rgba(220,190,145,0.28)',
  red:         '#ef4444',
  orange:      '#f97316',
  amber:       '#f59e0b',
  green:       '#22c55e',
  greenLight:  '#4ade80',
  blue:        '#60a5fa',
  purple:      '#a78bfa',
  cyan:        '#34d399',
  gray:        '#6b7280',
  font:        "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  mono:        "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
};

export const SEV: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#f59e0b',
  LOW:      '#22c55e',
};

export const CAT: Record<string, string> = {
  NETWORK:  '#60a5fa',
  HARDWARE: '#f97316',
  CASH_JAM: '#f59e0b',
  FRAUD:    '#ef4444',
  SERVER:   '#a78bfa',
  TIMEOUT:  '#fb923c',
  SWITCH:   '#34d399',
  UNKNOWN:  '#6b7280',
};
