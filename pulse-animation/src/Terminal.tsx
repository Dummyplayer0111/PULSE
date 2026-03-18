import React from "react";
import { TerminalContent } from "./TerminalContent";

const TRAFFIC = [
  { color: "#FF5F57", title: "Close" },
  { color: "#FFBD2E", title: "Minimise" },
  { color: "#28C840", title: "Maximise" },
];

export const Terminal: React.FC = () => {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow:
          "0 22px 60px rgba(0,0,0,0.18), 0 4px 14px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)",
        background: "#FFFFFF",
      }}
    >
      {/* ── Title bar ───────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(180deg, #EEEEEE 0%, #E2E2E2 100%)",
          borderBottom: "1px solid #C8C8C8",
          height: 38,
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          position: "relative",
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 7, zIndex: 1 }}>
          {TRAFFIC.map((t) => (
            <div
              key={t.color}
              title={t.title}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: t.color,
                boxShadow: `inset 0 0.5px 0 rgba(255,255,255,0.4), 0 0.5px 1px rgba(0,0,0,0.2)`,
              }}
            />
          ))}
        </div>

        {/* Centered title */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
            fontSize: 13,
            fontWeight: 400,
            color: "#4A4A4A",
            letterSpacing: "-0.01em",
            pointerEvents: "none",
          }}
        >
          payguard — backend — python manage.py runserver
        </div>
      </div>

      {/* ── Terminal body ────────────────────────────────────────── */}
      <div
        style={{
          background: "#FAFAFA",
          padding: "18px 22px 22px",
          minHeight: 420,
        }}
      >
        <TerminalContent />
      </div>
    </div>
  );
};
