import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing, Img } from "remotion";

const FONT = "'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

// Sub-seq A: 0–60 frames (2s) → headline text
// Sub-seq B: 60–130 frames → logo row
const TEXT_END = 60;

export const LogoCombo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Sub-sequence A: headline ────────────────────────────────────────────
  if (frame < TEXT_END) {
    const scaleIn = interpolate(frame, [0, 15], [0.86, 1], {
      easing: Easing.out(Easing.quad),
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    });
    const opacity = interpolate(frame, [0, 10], [0, 1], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    });
    const fadeOut = interpolate(frame, [48, 60], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: opacity * fadeOut,
            transform: `scale(${scaleIn})`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 62,
              fontWeight: 700,
              color: "#1a1a2e",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            ATM Intelligence
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 62,
              fontWeight: 700,
              color: "#c49746",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Platform
          </div>
        </div>
      </div>
    );
  }

  // ── Sub-sequence B: logo row ────────────────────────────────────────────
  const logoFrame = frame - TEXT_END;
  const opacity = interpolate(logoFrame, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const translateY = interpolate(logoFrame, [0, 16], [18, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* PayGuard wordmark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontFamily: "'SF Mono', 'Menlo', monospace",
              fontSize: 11,
              fontWeight: 700,
              color: "#c49746",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            ◈ v2.1.0
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 32,
              fontWeight: 800,
              color: "#1a1a2e",
              letterSpacing: "-0.04em",
            }}
          >
            PayGuard
          </span>
        </div>

        {/* + */}
        <span style={{ fontSize: 28, color: "#aaaaaa", fontWeight: 300 }}>+</span>

        {/* Django */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Img
            src="https://static.djangoproject.com/img/logos/django-logo-negative.svg"
            style={{ height: 38, filter: "invert(1) brightness(0.4)" }}
          />
          <span style={{ fontFamily: FONT, fontSize: 10, color: "#9ca3af", letterSpacing: "0.08em" }}>
            BACKEND
          </span>
        </div>

        {/* + */}
        <span style={{ fontSize: 28, color: "#aaaaaa", fontWeight: 300 }}>+</span>

        {/* React */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Img
            src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
            style={{ height: 40 }}
          />
          <span style={{ fontFamily: FONT, fontSize: 10, color: "#9ca3af", letterSpacing: "0.08em" }}>
            FRONTEND
          </span>
        </div>

        {/* + */}
        <span style={{ fontSize: 28, color: "#aaaaaa", fontWeight: 300 }}>+</span>

        {/* AI service */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "white", fontSize: 20 }}>⚡</span>
          </div>
          <span style={{ fontFamily: FONT, fontSize: 10, color: "#9ca3af", letterSpacing: "0.08em" }}>
            AI ENGINE
          </span>
        </div>
      </div>
    </div>
  );
};
