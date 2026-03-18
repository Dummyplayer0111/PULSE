import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { Terminal } from "./Terminal";
import { LogoCombo } from "./LogoCombo";

// Total: 240 frames (8s at 30fps)
// Terminal sequence: frames 0–200
// LogoCombo sequence: frames 110–240 (behind terminal)
// Terminal flip-away: local frames ~155–190 (X rotation, bottom origin)
const TERMINAL_SEQ_START = 0;
const TERMINAL_SEQ_DURATION = 200;

const LOGO_SEQ_START = 110;
const LOGO_SEQ_DURATION = 130;

// Within terminal local frame: when flip starts
const FLIP_START_LOCAL = 155;
const FLIP_END_LOCAL = 188;

export const Master: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Y rotation over full comp: 10° → -10° ─────────────────────────────
  const rotateY = interpolate(frame, [0, 240], [10, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Scale: 0.9 → 1.0 over full comp ───────────────────────────────────
  const scale = interpolate(frame, [0, 240], [0.9, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Spring jump-in: translateY 120 → 0 ────────────────────────────────
  const jumpY = spring({
    frame,
    fps,
    config: { stiffness: 180, damping: 28, mass: 1 },
    from: 120,
    to: 0,
  });

  return (
    <AbsoluteFill style={{ background: "#f8fafc" }}>
      {/* ── LogoCombo — behind terminal ─────────────────────────────────── */}
      <Sequence from={LOGO_SEQ_START} durationInFrames={LOGO_SEQ_DURATION}>
        <AbsoluteFill>
          <LogoCombo />
        </AbsoluteFill>
      </Sequence>

      {/* ── Terminal — 3D wrapper with perspective ───────────────────────── */}
      <Sequence from={TERMINAL_SEQ_START} durationInFrames={TERMINAL_SEQ_DURATION}>
        <TerminalWithTransforms
          frame={frame - TERMINAL_SEQ_START}
          fps={fps}
          rotateY={rotateY}
          scale={scale}
          jumpY={jumpY}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// Separate component so it can use useCurrentFrame for the flip
const TerminalWithTransforms: React.FC<{
  frame: number;
  fps: number;
  rotateY: number;
  scale: number;
  jumpY: number;
}> = ({ frame, fps, rotateY, scale, jumpY }) => {
  // ── X-axis flip away (from bottom, perspective) ────────────────────────
  const flipX = interpolate(
    frame,
    [FLIP_START_LOCAL, FLIP_END_LOCAL],
    [0, -90],
    {
      easing: Easing.in(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    // Outer wrapper: perspective + overall 3D transforms
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 1200,
      }}
    >
      {/* Translate + Y-rotation + scale wrapper */}
      <div
        style={{
          width: "80%",
          transform: `translateY(${jumpY + 100}px) rotateY(${rotateY}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Flip-away wrapper: rotates on X from bottom */}
        <div
          style={{
            transformOrigin: "bottom center",
            transform: `rotateX(${flipX}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <Terminal />
        </div>
      </div>
    </AbsoluteFill>
  );
};
