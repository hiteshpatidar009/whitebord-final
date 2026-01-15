// dividerMath.ts

export const degToRad = (deg: number) => (deg * Math.PI) / 180

export const rotatePoint = (
  cx: number,
  cy: number,
  x: number,
  y: number,
  angle: number
) => {
  const rad = degToRad(angle)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    x: cx + (x - cx) * cos - (y - cy) * sin,
    y: cy + (x - cx) * sin + (y - cy) * cos
  }
}

export const getDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

export const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max)
