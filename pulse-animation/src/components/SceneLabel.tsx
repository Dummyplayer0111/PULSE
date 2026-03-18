import React from 'react';
import { T } from '../tokens';

export const SceneLabel: React.FC<{ tag: string; title: string }> = ({ tag, title }) => (
  <div style={{ position: 'absolute', top: 32, left: 48, zIndex: 10 }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: `${T.gold}12`, border: `1px solid ${T.gold}30`,
      borderRadius: 6, padding: '4px 10px', marginBottom: 8,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.gold, boxShadow: `0 0 6px ${T.gold}` }} />
      <span style={{ fontSize: 9, fontWeight: 700, color: T.gold, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: T.font }}>
        {tag}
      </span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.font, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
      {title}
    </div>
  </div>
);
