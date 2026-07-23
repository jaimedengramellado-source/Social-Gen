import { interpolate } from "remotion";

export const progress = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const fadeUp = (frame: number, start: number, duration = 14) => {
  const p = progress(frame, start, duration);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * 14}px)`,
  };
};

export const typedText = (
  frame: number,
  start: number,
  text: string,
  duration: number
) => {
  const p = progress(frame, start, duration);
  const count = Math.round(p * text.length);
  return {
    text: text.slice(0, count),
    done: count >= text.length,
    typing: count > 0 && count < text.length,
  };
};
