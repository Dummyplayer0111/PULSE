import React, { useRef, useEffect } from 'react';

/* ── inject once ──────────────────────────────────────────────────────────── */
let INJECTED = false;
function injectStyles() {
  if (INJECTED || typeof document === 'undefined') return;
  INJECTED = true;
  const s = document.createElement('style');
  s.id = 'bento-global';
  s.textContent = `
    @keyframes bentoEnter {
      from { opacity: 0; transform: translateY(26px) scale(0.985); }
      to   { opacity: 1; transform: translateY(0)   scale(1);      }
    }
    .bento-card {
      animation: bentoEnter 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
      transition:
        transform          0.3s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow         0.3s ease,
        border-color       0.3s ease;
      will-change: transform;
    }
    .bento-card:hover {
      transform: translateY(-4px) !important;
      border-color: rgba(232,175,72,0.30) !important;
      box-shadow:
        inset 0 1px 0 rgba(232,175,72,0.18),
        0 20px 48px -12px rgba(0,0,0,0.45),
        0 0 0 0.5px rgba(232,175,72,0.10) !important;
    }
    .bento-glow {
      position: absolute;
      width: 420px; height: 420px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(232,175,72,0.09) 0%, transparent 70%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.35s ease;
      will-change: transform, opacity;
      z-index: 0;
    }
    .bento-static-glow {
      position: absolute; inset: 0;
      pointer-events: none; z-index: 0;
      background: radial-gradient(circle at 50% 0%, rgba(196,151,70,0.05) 0%, transparent 55%);
    }
    .bento-content {
      position: relative;
      z-index: 1;
    }
  `;
  document.head.appendChild(s);
}

/* ── types ────────────────────────────────────────────────────────────────── */
type BentoCardProps = {
  children: React.ReactNode;
  style?:   React.CSSProperties;
  className?: string;
  noPad?:   boolean;
  delay?:   number;   /* ms stagger for entry animation */
  noHover?: boolean;
};

/* ── component ────────────────────────────────────────────────────────────── */
export const BentoCard: React.FC<BentoCardProps> = ({
  children, style, className = '', noPad, delay = 0, noHover,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectStyles();
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;

    const onMove = (e: MouseEvent) => {
      const r = card.getBoundingClientRect();
      glow.style.transform = `translate(${e.clientX - r.left - 210}px, ${e.clientY - r.top - 210}px)`;
      glow.style.opacity = '1';
    };
    const onLeave = () => { glow.style.opacity = '0'; };

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
    return () => {
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`bento-card ${noHover ? '' : ''} ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--p-card)',
        border: '1px solid var(--p-card-border)',
        borderRadius: 14,
        padding: noPad ? 0 : undefined,
        boxShadow: 'inset 0 1px 0 var(--p-specular), 0 1px 3px rgba(0,0,0,0.4)',
        animationDelay: `${delay}ms`,
        ...style,
      }}
    >
      {/* Static top glow */}
      <div className="bento-static-glow" />
      {/* Mouse-tracking glow */}
      <div ref={glowRef} className="bento-glow" />
      {/* Content */}
      <div className="bento-content" style={{ padding: noPad ? 0 : undefined }}>
        {children}
      </div>
    </div>
  );
};

export default BentoCard;
