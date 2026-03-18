import React from 'react';
import { T } from '../tokens';

type CardProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  noPad?: boolean;
};

export const Card: React.FC<CardProps> = ({ children, style, noPad }) => (
  <div style={{
    background: T.card,
    border: `1px solid ${T.cardBorder}`,
    borderRadius: 12,
    padding: noPad ? 0 : '16px 20px',
    boxShadow: `inset 0 1px 0 ${T.specular}, 0 1px 3px rgba(0,0,0,0.4)`,
    overflow: 'hidden',
    ...style,
  }}>
    {children}
  </div>
);

export const CardHeader: React.FC<{ label: string; right?: React.ReactNode }> = ({ label, right }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', borderBottom: `1px solid ${T.cardBorder}`,
  }}>
    <span style={{ fontSize: 11, fontWeight: 600, color: T.vdim, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: T.font }}>
      {label}
    </span>
    {right}
  </div>
);
