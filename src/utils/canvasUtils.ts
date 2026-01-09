import type { Stroke } from '../types/index';
import Konva from 'konva';

// Helper function - not exported, only used internally
const getBoundingBox = (points: number[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

// This is the exported version
export const strokesToImage = (strokes: Stroke[], padding = 10): Promise<string> => {
  return new Promise((resolve) => {
    // Create a temporary stage
    const container = document.createElement('div');
    
    // Calculate bounds of all strokes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    strokes.forEach(stroke => {
      const box = getBoundingBox(stroke.points);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const stage = new Konva.Stage({
      container,
      width,
      height,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Draw strokes shifted by minX, minY
    strokes.forEach(stroke => {
      const line = new Konva.Line({
        points: stroke.points.map((p, i) => i % 2 === 0 ? p - minX + padding : p - minY + padding),
        stroke: stroke.color,
        strokeWidth: stroke.size,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
      });
      layer.add(line);
    });

    layer.draw();
    const dataURL = stage.toDataURL();
    stage.destroy();
    container.remove();
    resolve(dataURL);
  });
};

export const measureText = (text: string, fontSize: number, fontFamily: string) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    context.font = `${fontSize}px ${fontFamily}`;
    return context.measureText(text).width;
  }
  return 0;
};

// Export the getBoundingBox function if you need it elsewhere
export { getBoundingBox };