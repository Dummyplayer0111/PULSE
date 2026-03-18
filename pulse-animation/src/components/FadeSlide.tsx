import React from 'react';
import { interpolate, Easing } from 'remotion';

type FadeSlideProps = {
  frame: number;
  start?: number;
  duration?: number;
  fromY?: number;
  fromScale?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export const FadeSlide: React.FC<FadeSlideProps> = ({
  frame, start = 0, duration = 18, fromY = 16, fromScale, children, style,
}) => {
  const local = frame - start;
  const opacity = interpolate(local, [0, duration], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const translateY = interpolate(local, [0, duration], [fromY, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const scale = fromScale !== undefined
    ? interpolate(local, [0, duration], [fromScale, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <div style={{
      opacity,
      transform: `translateY(${translateY}px) scale(${scale})`,
      ...style,
    }}>
      {children}
    </div>
  );
};
