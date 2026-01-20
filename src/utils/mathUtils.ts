export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export const angleBetween = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.atan2(y2 - y1, x2 - x1);
};

export const polarToCartesian = (centerX: number, centerY: number, radius: number, angle: number) => {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
};