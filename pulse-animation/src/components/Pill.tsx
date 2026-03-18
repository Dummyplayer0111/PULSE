import React from 'react';
import { T } from '../tokens';

export const Pill: React.FC<{ label: string; color?: string; size?: 'sm' | 'xs' }> = ({
  label, color = T.gold, size = 'sm',
}) => (
  <span style={{
    fontSize: size === 'xs' ? 9 : 11,
    padding: size === 'xs' ? '1px 6px' : '2px 8px',
    borderRadius: 99,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color,
    background: `${color}20`,
    border: `1px solid ${color}35`,
    fontFamily: T.font,
    textTransform: 'uppercase',
  }}>
    {label}
  </span>
);
