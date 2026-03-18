import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Cursor } from "./Cursor";

const FONT = "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace";
const FONT_SIZE = 15;

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
  green:   "#16a34a",
  blue:    "#2563eb",
  gray:    "#374151",
  dim:     "#9ca3af",
  alert:   "#dc2626",
  ai:      "#7c3aed",
  auto:    "#d97706",
  ok:      "#16a34a",
  white:   "#111827",
};

// ── Typewriter command ───────────────────────────────────────────────────────
const COMMAND = "python manage.py runserver";
const CHARS_PER_FRAME = 1.8;

// ── Output lines (the PayGuard story) ───────────────────────────────────────
const OUTPUT_LINES: { text: string; color: string }[] = [
  { text: "Watching for file changes with StatReloader", color: C.dim },
  { text: "Performing system checks...", color: C.dim },
  { text: "System check identified no issues (0 silenced).", color: C.dim },
  { text: "", color: C.dim },
  { text: "PayGuard ATM Monitor v2.1.0  —  Django 5.2", color: C.white },
  { text: "Starting ASGI/Channels server → http://127.0.0.1:8000/", color: C.white },
  { text: "WebSocket consumers ready  →  DashboardConsumer, LogConsumer", color: C.white },
  { text: "AI microservice connected   →  http://127.0.0.1:8001", color: C.white },
  { text: "Monitoring 24 ATMs across 8 zones...", color: C.green },
  { text: "", color: C.dim },
  { text: "[ALERT]  ATM-009 · MG Road Branch — Cash jam detected", color: C.alert },
  { text: "[AI]     Root cause: CASH_JAM  ·  confidence 94%", color: C.ai },
  { text: "[AUTO]   Self-heal triggered → RESTART_SERVICE · ATM-009", color: C.auto },
  { text: "[✓]      ATM-009 restored · downtime 4.2s · incident resolved", color: C.ok },
];

// Stagger: one line per 45ms at 30fps = 1.35 frames/line
const STAGGER_FRAMES = 1.4;

// When does typing start (after a short delay)
const TYPING_START = 10;
// When does output start (after typing + pause)
const OUTPUT_START = TYPING_START + Math.ceil(COMMAND.length / CHARS_PER_FRAME) + 20;

export const TerminalContent: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Typewriter ──────────────────────────────────────────────────────────
  const typingFrame = Math.max(0, frame - TYPING_START);
  const charsToShow = Math.floor(typingFrame * CHARS_PER_FRAME);
  const typedText = COMMAND.slice(0, Math.min(charsToShow, COMMAND.length));
  const isTyping = charsToShow < COMMAND.length;

  // ── Output lines ────────────────────────────────────────────────────────
  const outputFrame = Math.max(0, frame - OUTPUT_START);

  return (
    <div style={{ fontFamily: FONT, fontSize: FONT_SIZE, lineHeight: 1.65 }}>
      {/* Prompt + typed command */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: C.green, userSelect: "none" }}>praanesh@MacBook-Pro</span>
        <span style={{ color: C.dim, marginLeft: 1, marginRight: 1 }}>:</span>
        <span style={{ color: C.blue }}>~/PULSE/backend</span>
        <span style={{ color: C.gray, marginLeft: 6 }}>%</span>
        <span style={{ marginLeft: 8, color: C.white }}>{typedText}</span>
        {!isTyping ? (
          // Show cursor blinking after typing only if output hasn't started
          frame < OUTPUT_START && <Cursor isTyping={false} color={C.gray} />
        ) : (
          <Cursor isTyping={true} color={C.gray} />
        )}
      </div>

      {/* Output lines, staggered */}
      {frame >= OUTPUT_START &&
        OUTPUT_LINES.map((line, i) => {
          const lineFrame = i * STAGGER_FRAMES;
          const opacity = interpolate(
            outputFrame,
            [lineFrame, lineFrame + 4],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const translateY = interpolate(
            outputFrame,
            [lineFrame, lineFrame + 6],
            [6, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                color: line.color,
                minHeight: line.text === "" ? "0.8em" : undefined,
                fontWeight: line.text.startsWith("[✓]") ? 600 : 400,
              }}
            >
              {line.text}
            </div>
          );
        })}

      {/* Final blinking cursor after all output */}
      {frame >= OUTPUT_START + OUTPUT_LINES.length * STAGGER_FRAMES + 8 && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: C.green }}>praanesh@MacBook-Pro</span>
          <span style={{ color: C.dim, marginLeft: 1, marginRight: 1 }}>:</span>
          <span style={{ color: C.blue }}>~/PULSE/backend</span>
          <span style={{ color: C.gray, marginLeft: 6 }}>%</span>
          <span style={{ marginLeft: 8 }}>
            <Cursor isTyping={false} color={C.gray} />
          </span>
        </div>
      )}
    </div>
  );
};

// Export so Master can compute flip timing
export const TERMINAL_OUTPUT_DONE_FRAME =
  OUTPUT_START + OUTPUT_LINES.length * STAGGER_FRAMES + 30;
