// Easing utilities (extend as needed)
export const easeInOutCubic = (t) =>
  (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
