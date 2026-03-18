import React from "react";
import { useCurrentFrame } from "remotion";

type CursorProps = {
  isTyping: boolean;
  color?: string;
};

export const Cursor: React.FC<CursorProps> = ({
  isTyping,
  color = "#1a1a2e",
}) => {
  const frame = useCurrentFrame();

  // Blink at 1 Hz (30fps: visible 0–14, hidden 15–29)
  const blinkCycle = frame % 30;
  const visible = isTyping ? true : blinkCycle < 15;

  return (
    <span
      style={{
        display: "inline-block",
        width: "0.55em",
        height: "1.15em",
        background: visible ? color : "transparent",
        verticalAlign: "text-bottom",
        marginLeft: 2,
      }}
    />
  );
};
