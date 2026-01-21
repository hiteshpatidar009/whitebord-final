export type ToolType = 'select' | 'hand' | 'pen' | 'eraser' | 'shape' | 'text' | 'image' | 'handwriting' | 'highlighter' | 'fill' | 'highlighter-eraser' | 'line';

export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  id: string;
  tool: ToolType;
  points: number[];
  color: string;
  size: number;
  isEraser?: boolean;
  isHighlighter?: boolean;
};

export type TextObject = {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontStyle?: string;
  textDecoration?: string;
  width?: number;
  height?: number;
  lineHeight?: number;
};

export type ShapeObject = {
  id: string;
  shapeType: 'rect' | 'circle' | 'line' | 'triangle' | 'polygon';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  stroke: string;
  strokeWidth: number;
  fill?: string;
  opacity?: number;
};

export type ImageObject = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
};

export type GroupObject = {
  id: string;
  items: WhiteboardItem[];  // Store actual items, not just IDs
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export type WhiteboardItem = 
  | ({ type: 'stroke' } & Stroke)
  | ({ type: 'text' } & TextObject)
  | ({ type: 'shape' } & ShapeObject)
  | ({ type: 'image' } & ImageObject)
  | ({ type: 'group' } & GroupObject);

export const COLORS = {
  red: '#FF0000',
  blue: '#0000FF',
  green: '#008000',
  white: '#FFFFFF',
  yellow: '#FFFF00',
  black: '#000000',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FF69B4',
  gray: '#808080',
  brown: '#A52A2A',
  cyan: '#00FFFF',
};
