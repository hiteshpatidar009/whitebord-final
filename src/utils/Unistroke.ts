// src/utils/Unistroke.ts

export type Point = { x: number; y: number };

const NUM_POINTS = 64;

// --- Templates ---
const getCirclePoints = (): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i < NUM_POINTS; i++) {
    const angle = (i / NUM_POINTS) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 });
  }
  return points;
};

const getTrianglePoints = (): Point[] => {
  const p1 = { x: 50, y: 0 };
  const p2 = { x: 100, y: 100 };
  const p3 = { x: 0, y: 100 };
  return [
    ...interpolate(p1, p2, 21),
    ...interpolate(p2, p3, 21),
    ...interpolate(p3, p1, 22),
  ];
};

const getRectPoints = (): Point[] => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 100, y: 0 };
  const p3 = { x: 100, y: 50 };
  const p4 = { x: 0, y: 50 };
  return [
    ...interpolate(p1, p2, 16),
    ...interpolate(p2, p3, 16),
    ...interpolate(p3, p4, 16),
    ...interpolate(p4, p1, 16),
  ];
};

const getLinePoints = (): Point[] => {
    return interpolate({x: 0, y:0}, {x: 100, y: 100}, NUM_POINTS);
}

function interpolate(p1: Point, p2: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    pts.push({
      x: p1.x + ((p2.x - p1.x) * i) / steps,
      y: p1.y + ((p2.y - p1.y) * i) / steps,
    });
  }
  return pts;
}

// --- The Recognizer Class ---

class Unistroke {
  templates: { name: string; points: Point[] }[] = [];

  constructor() {
    this.addTemplate('circle', getCirclePoints());
    this.addTemplate('triangle', getTrianglePoints());
    this.addTemplate('rect', getRectPoints());
    this.addTemplate('line', getLinePoints());
  }

  addTemplate(name: string, points: Point[]) {
    this.templates.push({ name, points: this.normalize(points) });
  }

  normalize(points: Point[]): Point[] {
    let pts = this.resample(points, NUM_POINTS);
    pts = this.rotateToZero(pts);
    pts = this.scaleToSquare(pts, 250);
    pts = this.translateToOrigin(pts);
    return pts;
  }

  recognize(points: number[]): { name: string; score: number } {
    if (points.length < 10) return { name: '', score: 0 };

    const rawPoints: Point[] = [];
    for (let i = 0; i < points.length; i += 2) {
      rawPoints.push({ x: points[i], y: points[i + 1] });
    }

    const candidate = this.normalize(rawPoints);
    let bestDist = Infinity;
    let bestTemplate = '';

    for (const template of this.templates) {
      const dist = this.distanceAtBestAngle(candidate, template.points);
      if (dist < bestDist) {
        bestDist = dist;
        bestTemplate = template.name;
      }
    }

    const score = 1 - bestDist / (0.5 * Math.sqrt(250 * 250 + 250 * 250));
    return { name: bestTemplate, score: Math.max(0, score) };
  }

  // --- Math Helpers ---
  resample(points: Point[], n: number) {
    const I = this.pathLength(points) / (n - 1);
    let D = 0;
    const newPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const d = this.distance(points[i - 1], points[i]);
      if (D + d >= I) {
        const qx = points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x);
        const qy = points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y);
        const q = { x: qx, y: qy };
        newPoints.push(q);
        points.splice(i, 0, q);
        D = 0;
      } else { D += d; }
    }
    if (newPoints.length === n - 1) newPoints.push(points[points.length - 1]);
    return newPoints;
  }

  rotateToZero(points: Point[]) {
    const c = this.centroid(points);
    const angle = Math.atan2(c.y - points[0].y, c.x - points[0].x);
    return this.rotateBy(points, -angle);
  }

  rotateBy(points: Point[], radians: number) {
    const c = this.centroid(points);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return points.map((p) => ({
      x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
      y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
    }));
  }

  scaleToSquare(points: Point[], size: number) {
    const box = this.boundingBox(points);
    const newPoints = points.map((p) => ({
      x: p.x * (size / box.width),
      y: p.y * (size / box.height),
    }));
    return newPoints;
  }

  translateToOrigin(points: Point[]) {
    const c = this.centroid(points);
    return points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
  }

  distanceAtBestAngle(points: Point[], T: Point[]) {
    let a = -0.785398; 
    let b = 0.785398; 
    const phi = 0.693576; 
    let x1 = phi * a + (1 - phi) * b;
    let f1 = this.distanceAtAngle(points, T, x1);
    let x2 = (1 - phi) * a + phi * b;
    let f2 = this.distanceAtAngle(points, T, x2);

    while (Math.abs(b - a) > 0.0349066) { 
      if (f1 < f2) {
        b = x2; x2 = x1; f2 = f1;
        x1 = phi * a + (1 - phi) * b;
        f1 = this.distanceAtAngle(points, T, x1);
      } else {
        a = x1; x1 = x2; f1 = f2;
        x2 = (1 - phi) * a + phi * b;
        f2 = this.distanceAtAngle(points, T, x2);
      }
    }
    return Math.min(f1, f2);
  }

  distanceAtAngle(points: Point[], T: Point[], radians: number) {
    const newPoints = this.rotateBy(points, radians);
    return this.pathDistance(newPoints, T);
  }

  pathDistance(pts1: Point[], pts2: Point[]) {
    let d = 0;
    for (let i = 0; i < pts1.length && i < pts2.length; i++) {
      d += this.distance(pts1[i], pts2[i]);
    }
    return d / pts1.length;
  }

  pathLength(points: Point[]) {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += this.distance(points[i - 1], points[i]);
    }
    return d;
  }

  distance(p1: Point, p2: Point) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  centroid(points: Point[]) {
    let x = 0, y = 0;
    for (const p of points) { x += p.x; y += p.y; }
    return { x: x / points.length, y: y / points.length };
  }

  boundingBox(points: Point[]) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return { width: maxX - minX, height: maxY - minY };
  }
}

export const unistroke = new Unistroke();