
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Stage, Layer, Line, Image as KonvaImage, Rect, Circle, RegularPolygon, Transformer, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import type { Stroke, WhiteboardItem } from '../types';
import { strokesToImage, getBoundingBox } from '../utils/canvasUtils';
import { FONT_STACKS, FONTS } from './TextToolbar';

import { transcribeHandwriting } from '../services/geminiService';



// --- MATH & SIMPLIFICATION HELPERS (Douglas-Peucker) ---

const getSqDist = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  const dx = p1.x - p2.x, dy = p1.y - p2.y;
  return dx * dx + dy * dy;
};

const getSqSegDist = (p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) => {
  let x = v.x, y = v.y, dx = w.x - x, dy = w.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = w.x; y = w.y; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p.x - x; dy = p.y - y;
  return dx * dx + dy * dy;
};

const simplifyDP = (points: { x: number; y: number }[], sqTolerance: number) => {
  const len = points.length;
  const MarkerArray = new Uint8Array(len);
  const stack = [0, len - 1];
  const newPoints: { x: number; y: number }[] = [];

  MarkerArray[0] = MarkerArray[len - 1] = 1;

  while (stack.length > 0) {
    const last = stack.pop()!;
    const first = stack.pop()!;
    let maxSqDist = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      MarkerArray[index] = 1;
      stack.push(first, index, index, last);
    }
  }

  for (let i = 0; i < len; i++) {
    if (MarkerArray[i]) newPoints.push(points[i]);
  }
  return newPoints;
};

const isClosedShape = (pts: { x: number; y: number }[]) => {
  if (pts.length < 3) return false;
  const start = pts[0];
  const end = pts[pts.length - 1];
  const dist = Math.sqrt(getSqDist(start, end));
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const maxDim = Math.max(maxX - minX, maxY - minY);
  
  return dist < Math.max(50, maxDim * 0.2);
};

// --- COMPONENTS ---

// Helper: Extract plain text from HTML
const stripHtmlTags = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || div.textContent || '';
};

// URLImage component for loading images
const URLImage = ({ image, onClick, onTap, draggable, onTransformEnd }: { image: any, onClick?: () => void, onTap?: () => void, draggable?: boolean, onTransformEnd?: (e: any) => void }) => {
  const [img] = useImage(image.src);
  return (
    <KonvaImage
      id={image.id}
      image={img}
      x={image.x}
      y={image.y}
      width={image.width}
      height={image.height}
      onClick={onClick}
      onTap={onTap}
      draggable={draggable}
      onTransformEnd={onTransformEnd}
    />
  );
};

export const Whiteboard: React.FC = () => {
  const {
    tool,
    color,
    size,
    items,
    addItem,
    updateItem,
    removeItem,
    stagePos,
    setStagePos,
    stageScale,
    setStageScale,
    saveHistory,
    textOptions,
    selectedId,
    setSelectedId,
    backgroundImage,
  } = useWhiteboardStore();

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const prevItemsLength = useRef(items.length);

  useEffect(() => {
    if (items.length > prevItemsLength.current) {
      const lastItem = items[items.length - 1];
      if (lastItem.type === 'text' && tool === 'text' && lastItem.text === 'Type here...') {
        startTextEditing(lastItem.id);
      }
    }
    prevItemsLength.current = items.length;
  }, [items, tool]);

  // Drawing state refs
  const isDrawing = useRef(false);
  const currentStrokeId = useRef<string | null>(null);
  const currentPointsRef = useRef<number[]>([]); 
  const previewLineRef = useRef<Konva.Line>(null); 
  const cursorRef = useRef<Konva.Circle>(null);
  const lastEraserPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastRightClickTime = useRef<number>(0);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  // Handwriting-specific state
  const handwritingStrokesRef = useRef<string[]>([]);
  const handwritingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandwritingActive = useRef(false);

  // Cleanup effect for tool switching
  useEffect(() => {
    // Reset drawing state when tool changes
    isDrawing.current = false;
    currentStrokeId.current = null;
    currentPointsRef.current = [];
    lastEraserPosRef.current = null;
    
    // Clean up any existing text editors when switching tools
    const existingContainer = document.querySelector('[data-text-editor]');
    if (existingContainer && tool !== 'text') {
      document.body.removeChild(existingContainer);
      setEditingTextId(null);
    }
    
    // Clean up handwriting-specific state
    if (tool !== 'handwriting') {
      isHandwritingActive.current = false;
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current);
        handwritingTimerRef.current = null;
      }
    }
    
    // Hide preview line when switching tools
    if (previewLineRef.current) {
      previewLineRef.current.visible(false);
      previewLineRef.current.getLayer()?.batchDraw();
    }
  }, [tool]);

  useEffect(() => {
    if (!transformerRef.current) return;

    if (selectedId && editingTextId !== selectedId) {
      const stage = stageRef.current;
      const node = stage?.findOne('#' + selectedId);
      
      if (node && stage) {
        const nodes = [node];
        
        // Find overlapping erasers to move together
        const selectedRect = node.getClientRect();
        
        items.forEach(item => {
            if (item.type === 'stroke' && (item.tool === 'eraser' || item.tool === 'highlighter-eraser')) {
                const eraserNode = stage.findOne('#' + item.id);
                if (eraserNode) {
                    const eraserRect = eraserNode.getClientRect();
                    
                    // Simple AABB intersection check
                    if (
                        selectedRect.x < eraserRect.x + eraserRect.width &&
                        selectedRect.x + selectedRect.width > eraserRect.x &&
                        selectedRect.y < eraserRect.y + eraserRect.height &&
                        selectedRect.y + selectedRect.height > eraserRect.y
                    ) {
                        nodes.push(eraserNode);
                    }
                }
            }
        });

        transformerRef.current.nodes(nodes);
        
        // Configure transformer for text items
        const selectedItem = items.find(i => i.id === selectedId);
        if (selectedItem?.type === 'text') {
          transformerRef.current.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']);
          transformerRef.current.rotateEnabled(false);
        } else {
          transformerRef.current.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']);
          transformerRef.current.rotateEnabled(true);
        }
        
        transformerRef.current.getLayer()?.batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, items, editingTextId]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId) {
        removeItem(selectedId);
        setSelectedId(null);
        saveHistory();
        return;
      }
      if (e.key === 'F12' || e.key === 'F5') {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.shiftKey && ( e.key === 'J' || e.key === 'C')) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [selectedId, removeItem, setSelectedId, saveHistory]);

  // Cleanup handwriting timers on unmount
  useEffect(() => {
    return () => {
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current);
      }
      // Clean up any text editors on unmount
      const existingContainer = document.querySelector('[data-text-editor]');
      if (existingContainer) {
        document.body.removeChild(existingContainer);
      }
    };
  }, []);



  // Handwriting recognition processing
  const processHandwritingStrokes = useCallback(async () => {
    if (handwritingStrokesRef.current.length === 0) return;
    
    try {
      // Create a temporary canvas to render handwriting strokes
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Find bounding box of all handwriting strokes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const strokeItems = handwritingStrokesRef.current.map(id => 
        items.find(item => item.id === id && item.type === 'stroke')
      ).filter(Boolean) as Stroke[];
      
      strokeItems.forEach(stroke => {
        for (let i = 0; i < stroke.points.length; i += 2) {
          minX = Math.min(minX, stroke.points[i]);
          maxX = Math.max(maxX, stroke.points[i]);
          minY = Math.min(minY, stroke.points[i + 1]);
          maxY = Math.max(maxY, stroke.points[i + 1]);
        }
      });
      
      const offsetX = -minX + 50;
      const offsetY = -minY + 50;
      
      // Draw strokes on canvas
      strokeItems.forEach(stroke => {
        if (stroke.points.length < 4) return;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0] + offsetX, stroke.points[1] + offsetY);
        for (let i = 2; i < stroke.points.length; i += 2) {
          ctx.lineTo(stroke.points[i] + offsetX, stroke.points[i + 1] + offsetY);
        }
        ctx.stroke();
      });
      
      // Convert canvas to base64 properly
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1]; // Extract base64 part only
      const text = await transcribeHandwriting(base64Data);
      
      if (text && text !== "No handwriting detected") {
        // Remove original handwriting strokes
        handwritingStrokesRef.current.forEach(id => removeItem(id));
        
        // Add recognized text
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        addItem({
          type: 'text',
          id: uuidv4(),
          x: centerX - 100,
          y: centerY - 16,
          text: text,
          fontSize: 32,
          fontFamily: 'Monotype Corsiva, "Brush Script MT", cursive',
          fill: color, // Store the color that was active when handwriting was created
        });
        saveHistory();
      }
    } catch (error) {
      console.error("Handwriting recognition error:", error);
    } finally {
      handwritingStrokesRef.current = [];
    }
  }, [items, removeItem, addItem, color, saveHistory]);



  // --- MATH HELPERS for Circle Detection ---
  const getPathLength = (pts: {x:number, y:number}[]) => {
    let len = 0;
    for(let i=1; i<pts.length; i++) {
      len += Math.sqrt(getSqDist(pts[i-1], pts[i]));
    }
    return len;
  };

  const getPolygonArea = (pts: {x:number, y:number}[]) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
  };

  const isCircle = (pts: { x: number; y: number }[]) => {
    if (pts.length < 10) return false;
    const perimeter = getPathLength(pts);
    const area = getPolygonArea(pts);
    if (area === 0) return false;
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    return circularity > 0.82; 
  };

  const processShape = (strokeId: string) => {
    const stroke = items.find(i => i.id === strokeId && i.type === 'stroke') as Stroke;
    if (!stroke || stroke.points.length < 5) return;

    const rawPoints = stroke.points;
    const pts = [];
    for (let i = 0; i < rawPoints.length; i += 2) {
      pts.push({ x: rawPoints[i], y: rawPoints[i + 1] });
    }

    let shapeItem: WhiteboardItem;

    if (isCircle(pts)) {
       const box = getBoundingBox(stroke.points);
       const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
       const radius = (box.width + box.height) / 4;

       shapeItem = {
        type: 'shape',
        id: uuidv4(),
        shapeType: 'circle',
        x: center.x,
        y: center.y,
        width: radius,
        stroke: stroke.color,
        strokeWidth: stroke.size,
        fill: 'transparent',
        opacity: 1,
      } as any;
    } else {
        const simplified = simplifyDP(pts, 200);
        const start = pts[0];
        const end = pts[pts.length - 1];
        const dist = Math.sqrt(getSqDist(start, end));
        const box = getBoundingBox(stroke.points);
        const maxDim = Math.max(box.width, box.height);
        const closed = dist < Math.max(50, maxDim * 0.2);

        if (simplified.length < 2) return;

        const flatPoints: number[] = [];
        simplified.forEach(p => flatPoints.push(p.x, p.y));

        if (closed) {
            shapeItem = {
                type: 'shape',
                id: uuidv4(),
                shapeType: 'polygon',
                points: flatPoints,
                stroke: stroke.color,
                strokeWidth: stroke.size,
                opacity: 1,
                closed: true
            } as any;
        } else {
            shapeItem = {
                type: 'shape',
                id: uuidv4(),
                shapeType: 'line',
                points: flatPoints,
                stroke: stroke.color,
                strokeWidth: stroke.size,
                opacity: 1,
                closed: false
            } as any;
        }
    }

    if (shapeItem) {
      removeItem(strokeId);
      addItem(shapeItem);
      saveHistory();
    }
  };

  const hexToRgba = (hex: string, alpha: number) => {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.evt.preventDefault();
    if ((e.evt as TouchEvent).touches && (e.evt as TouchEvent).touches.length > 1) return;

    // Guard: Never process canvas events if target is text
    if ((e.evt.target as HTMLElement)?.dataset?.type === 'text') return;

    const stage = e.target.getStage();
    const clickedOnEmpty = e.target === stage;
    const isTouch = e.evt.type === 'touchstart';
    const isRightClick = !isTouch && (e.evt as MouseEvent).button === 2;

    if (clickedOnEmpty) {
        setSelectedId(null);
    }
    
    // Early return for pan tool - let stage handle dragging
    if (tool === 'hand') {
      return;
    }
    
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;

    if (tool === 'text') {
      if (!clickedOnEmpty) {
        // Select existing text
        const targetId = e.target.id();
        if (targetId) {
          setSelectedId(targetId);
        }
      }
      return; 
    }

    if (tool === 'fill') {
       const shape = e.target;
       if (shape === stage) return;
       const id = shape.id();
       const item = items.find(i => i.id === id);
       if (item) {
           if (item.type === 'shape') {
               const transparentFill = hexToRgba(color, 0.6);
               updateItem(id, { fill: transparentFill, opacity: 1 });
               saveHistory();
           } else if (item.type === 'text') {
               updateItem(id, { fill: color }); 
               saveHistory();
           }
       }
       return;
    }

    if (tool === 'select') return;
    if (isRightClick) return;

    isDrawing.current = true;
    const id = uuidv4();
    currentStrokeId.current = id;
    currentPointsRef.current = [pos.x, pos.y];

    if (previewLineRef.current) {
        previewLineRef.current.points([pos.x, pos.y]);
        previewLineRef.current.stroke(color);
        previewLineRef.current.strokeWidth(size);
        previewLineRef.current.opacity(tool === 'highlighter' ? 0.4 : 1);
        previewLineRef.current.visible(true);
        previewLineRef.current.getLayer()?.batchDraw();
    }

    if (tool === 'eraser' || tool === 'highlighter-eraser') {
       addItem({
        type: 'stroke',
        id,
        tool,
        points: [pos.x, pos.y],
        color: '#000000',
        size: size,
        isEraser: true,
        isHighlighter: false
      });
       return;
    }

    // Handle handwriting as normal strokes with thinner width
    if (tool === 'handwriting') {
      isHandwritingActive.current = true;
      handwritingStrokesRef.current.push(id);
      
      // Clear any existing timer
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current);
      }
      
      // Use thinner stroke width for handwriting (3px default)
      const handwritingWidth = Math.max(2, Math.min(size * 0.1, 4));
      
      addItem({
        type: 'stroke', 
        id, 
        tool, 
        points: [pos.x, pos.y],
        color: color, // Store color at creation time
        size: handwritingWidth, // Store width at creation time
        isEraser: false, 
        isHighlighter: false
      });
      return;
    }
    
    addItem({
      type: 'stroke', 
      id, 
      tool, 
      points: [pos.x, pos.y],
      color: color, // Store color at creation time
      size: size, // Store width at creation time
      isEraser: false, 
      isHighlighter: tool === 'highlighter'
    });
  };

 const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.evt.preventDefault();
    
    // Guard: Never process canvas events if target is text
    if ((e.evt.target as HTMLElement)?.dataset?.type === 'text') return;
    
    const stage = e.target.getStage();
    const point = stage?.getRelativePointerPosition();
    if (!point) return;

    // Update cursor for eraser tools
    if (cursorRef.current) {
        const isEraser = tool === 'eraser' || tool === 'highlighter-eraser';
        cursorRef.current.visible(isEraser);
        if (isEraser) {
            cursorRef.current.x(point.x);
            cursorRef.current.y(point.y);
            cursorRef.current.radius(size / 2);
            cursorRef.current.getLayer()?.batchDraw();
        }
    }

    // Only handle drawing if we're actually drawing and not using pan/select tools
    if (!isDrawing.current || tool === 'hand' || tool === 'select' || tool === 'text' || tool === 'fill') {
      return;
    }

    if (currentStrokeId.current) {
        const stroke = items.find(i => i.id === currentStrokeId.current) as Stroke;
        if (stroke) {
            updateItem(currentStrokeId.current, {
                points: [...stroke.points, point.x, point.y]
            });
        }
    }
  };

 const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastEraserPosRef.current = null;

    saveHistory();
    const strokeId = currentStrokeId.current;
    
    if (!strokeId) return;

    // Handle handwriting recognition timer
    if (tool === 'handwriting' && isHandwritingActive.current) {
      // Clear existing timer
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current);
      }
      
      // Set new timer for recognition
      handwritingTimerRef.current = setTimeout(() => {
        if (isHandwritingActive.current) {
          processHandwritingStrokes();
        }
      }, 1500); // Wait 1.5 seconds after last stroke
    }

    if (tool === 'shape') {
      setTimeout(() => {
        processShape(strokeId);
      }, 500);
    }
    
    currentStrokeId.current = null;
};

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setStageScale(newScale);
    setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>, item: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const updatePayload: any = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };

    if (item.type === 'text') {
      updatePayload.width = Math.max(30, node.width() * scaleX);
      updatePayload.fontSize = Math.max(10, item.fontSize * scaleY);
    } else if (item.type === 'image' || (item.type === 'shape' && item.shapeType === 'rect')) {
      updatePayload.width = Math.max(5, node.width() * scaleX);
      updatePayload.height = Math.max(5, node.height() * scaleY);
    } else if (item.type === 'shape' && item.shapeType === 'circle') {
      updatePayload.width = Math.max(5, item.width * scaleX);
    } else if (item.type === 'shape' && item.shapeType === 'triangle') {
      updatePayload.width = Math.max(5, item.width * scaleX);
    } else if (item.type === 'shape' && (item.shapeType === 'line' || item.shapeType === 'polygon')) {
      const newPoints = item.points.map((p: number, i: number) => i % 2 === 0 ? p * scaleX : p * scaleY);
      updatePayload.points = newPoints;
    } else if (item.type === 'stroke') {
       const newPoints = item.points.map((p: number, i: number) => i % 2 === 0 ? p * scaleX : p * scaleY);
      updatePayload.points = newPoints;
    }

    updateItem(item.id, updatePayload);
    saveHistory();
  };

const getCursorStyle = () => {
    if (tool === 'eraser' || tool === 'highlighter-eraser') return { cursor: 'none' };
    if (tool === 'fill') {
      const cursorSize = 24;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11l-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z"/><path d="M5 21v-7"/></svg>`;
      const encoded = encodeURIComponent(svg);
      return { cursor: `url('data:image/svg+xml;utf8,${encoded}') 2 22, auto` };
    }
    return { cursor: 'crosshair' };
  };

  const [stageSize, setStageSize] = React.useState({ width: window.innerWidth, height: window.innerHeight });

  React.useEffect(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  // Text editing functions
  const startTextEditing = (textId: string) => {
    // Clean up any existing editing session first
    const existingContainer = document.querySelector('[data-text-editor]');
    if (existingContainer) {
      document.body.removeChild(existingContainer);
    }
    
    const textItem = items.find(i => i.id === textId && i.type === 'text');
    if (!textItem || textItem.type !== 'text') return;

    setEditingTextId(textId);
    
    // Create container
    const container = document.createElement('div');
    container.setAttribute('data-text-editor', 'true');
    container.style.position = 'absolute';
    container.style.left = `${textItem.x * stageScale + stagePos.x}px`;
    container.style.top = `${textItem.y * stageScale + stagePos.y}px`;
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    toolbar.style.background = '#fff';
    toolbar.style.padding = '4px';
    toolbar.style.borderRadius = '4px';
    toolbar.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toolbar.style.border = '1px solid #ccc';
    toolbar.style.cursor = 'move';
    
    // Make toolbar draggable
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    toolbar.onmousedown = (e) => {
      if (e.target === toolbar || (e.target as HTMLElement).parentElement === toolbar) {
        isDragging = true;
        const rect = container.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        e.preventDefault();
      }
    };
    
    document.onmousemove = (e) => {
      if (isDragging) {
        container.style.left = `${e.clientX - dragOffset.x}px`;
        container.style.top = `${e.clientY - dragOffset.y}px`;
      }
    };
    
    document.onmouseup = () => {
      isDragging = false;
    };

    // Bold button
    const boldBtn = document.createElement('button');
    boldBtn.innerHTML = '<b>B</b>';
    boldBtn.style.width = '24px';
    boldBtn.style.height = '24px';
    boldBtn.style.border = '1px solid #eee';
    boldBtn.style.cursor = 'pointer';
    boldBtn.style.background = (textItem as any).fontStyle?.includes('bold') ? '#eee' : '#fff';
    boldBtn.onmousedown = (e) => e.preventDefault();
    boldBtn.onclick = (e) => {
      e.stopPropagation();
      const currentItem = items.find(i => i.id === textId);
      if (!currentItem || currentItem.type !== 'text') return;
      const isBold = currentItem.fontStyle?.includes('bold');
      const currentStyle = currentItem.fontStyle || '';
      const newStyle = isBold 
        ? currentStyle.replace(/\bbold\b/g, '').replace(/\s+/g, ' ').trim()
        : `bold ${currentStyle}`.trim();
      updateItem(textId, { fontStyle: newStyle });
      textarea.style.fontWeight = isBold ? 'normal' : 'bold';
      boldBtn.style.background = isBold ? '#fff' : '#eee';
      textarea.focus();
    };

    // Italic button
    const italicBtn = document.createElement('button');
    italicBtn.innerHTML = '<i>I</i>';
    italicBtn.style.width = '24px';
    italicBtn.style.height = '24px';
    italicBtn.style.border = '1px solid #eee';
    italicBtn.style.cursor = 'pointer';
    italicBtn.style.background = (textItem as any).fontStyle?.includes('italic') ? '#eee' : '#fff';
    italicBtn.onmousedown = (e) => e.preventDefault();
    italicBtn.onclick = (e) => {
      e.stopPropagation();
      const currentItem = items.find(i => i.id === textId);
      if (!currentItem || currentItem.type !== 'text') return;
      const isItalic = currentItem.fontStyle?.includes('italic');
      const currentStyle = currentItem.fontStyle || '';
      const newStyle = isItalic 
        ? currentStyle.replace(/\bitalic\b/g, '').replace(/\s+/g, ' ').trim()
        : `${currentStyle} italic`.trim();
      updateItem(textId, { fontStyle: newStyle });
      textarea.style.fontStyle = isItalic ? 'normal' : 'italic';
      italicBtn.style.background = isItalic ? '#fff' : '#eee';
      textarea.focus();
    };

    // Font selector
    const fontSelect = document.createElement('select');
    FONTS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.innerText = f;
      if (FONT_STACKS[f] === (textItem as any).fontFamily || f === (textItem as any).fontFamily) opt.selected = true;
      fontSelect.appendChild(opt);
    });
    fontSelect.style.fontSize = '12px';
    fontSelect.style.cursor = 'pointer';
    fontSelect.onmousedown = (e) => e.stopPropagation();
    fontSelect.onchange = () => {
      const newFont = FONT_STACKS[fontSelect.value] || fontSelect.value;
      updateItem(textId, { fontFamily: newFont });
      textarea.style.fontFamily = newFont;
    };

    // Font size selector
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.value = (textItem as any).fontSize.toString();
    sizeInput.style.width = '40px';
    sizeInput.style.fontSize = '12px';
    sizeInput.onmousedown = (e) => e.stopPropagation();
    sizeInput.oninput = () => {
      const newSize = parseInt(sizeInput.value);
      if (newSize > 0) {
        updateItem(textId, { fontSize: newSize });
        textarea.style.fontSize = `${newSize * stageScale}px`;
      }
    };

    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(fontSelect);
    toolbar.appendChild(sizeInput);

    // Create temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = (textItem as any).text === 'Type here...' ? '' : (textItem as any).text;
    textarea.placeholder = 'Type here...';
    textarea.style.fontSize = `${(textItem as any).fontSize * stageScale}px`;
    textarea.style.fontFamily = (textItem as any).fontFamily;
    textarea.style.fontWeight = (textItem as any).fontStyle?.includes('bold') ? 'bold' : 'normal';
    textarea.style.fontStyle = (textItem as any).fontStyle?.includes('italic') ? 'italic' : 'normal';
    textarea.style.color = (textItem as any).fill;
    textarea.style.background = 'rgba(255,255,255,0.9)';
    textarea.style.border = '2px solid #0099ff';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.minWidth = '150px';
    textarea.style.minHeight = '50px';
    textarea.style.width = '100%';
    textarea.style.boxSizing = 'border-box';
    
    const finishEditing = () => {
      const newText = textarea.value.trim() || 'Type here...';
      updateItem(textId, { text: newText });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      document.removeEventListener('click', handleClickOutside);
      document.onmousemove = null;
      document.onmouseup = null;
      setEditingTextId(null);
      saveHistory();
    };
    
    // Close editor when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (!container.contains(e.target as Node)) {
        finishEditing();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      }
      if (e.key === 'Escape') {
        finishEditing();
      }
    });
    
    container.appendChild(toolbar);
    container.appendChild(textarea);
    document.body.appendChild(container);
    textareaRef.current = textarea;
    textarea.focus();
    if ((textItem as any).text === 'Type here...') {
        textarea.select();
    }
  };

  const handleTextDoubleClick = (textId: string) => {
    if (tool === 'text') {
      startTextEditing(textId);
    }
  };

  const linkedErasersRef = useRef<string[]>([]);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const linkedErasersStartPosRef = useRef<Record<string, {x: number, y: number}>>({});

  const handleItemDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      const node = e.target;
      if (!stage) return;
      dragStartPosRef.current = { x: node.x(), y: node.y() };
      linkedErasersRef.current = [];
      linkedErasersStartPosRef.current = {};
      const selectedRect = node.getClientRect();
      items.forEach(item => {
          if (item.type === 'stroke' && (item.tool === 'eraser' || item.tool === 'highlighter-eraser')) {
              const eraserNode = stage.findOne('#' + item.id);
              if (eraserNode) {
                  const eraserRect = eraserNode.getClientRect();
                  if (selectedRect.x < eraserRect.x + eraserRect.width && selectedRect.x + selectedRect.width > eraserRect.x && selectedRect.y < eraserRect.y + eraserRect.height && selectedRect.y + selectedRect.height > eraserRect.y) {
                      linkedErasersRef.current.push(item.id);
                      linkedErasersStartPosRef.current[item.id] = { x: eraserNode.x(), y: eraserNode.y() };
                  }
              }
          }
      });
  };

  const handleItemDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!dragStartPosRef.current) return;
      const node = e.target;
      const dx = node.x() - dragStartPosRef.current.x;
      const dy = node.y() - dragStartPosRef.current.y;
      const stage = node.getStage();
      if (stage) {
          linkedErasersRef.current.forEach(id => {
              const eraserNode = stage.findOne('#' + id);
              const startPos = linkedErasersStartPosRef.current[id];
              if (eraserNode && startPos) {
                  eraserNode.x(startPos.x + dx);
                  eraserNode.y(startPos.y + dy);
              }
          });
          stage.batchDraw();
      }
  };

  const handleItemDragEnd = (e: Konva.KonvaEventObject<DragEvent>, item: any) => {
      const node = e.target;
      updateItem(item.id, { x: node.x(), y: node.y() });
      const stage = node.getStage();
      if (stage) {
          linkedErasersRef.current.forEach(id => {
              const eraserNode = stage.findOne('#' + id);
              if (eraserNode) updateItem(id, { x: eraserNode.x(), y: eraserNode.y() });
          });
      }
      saveHistory();
  };

  const renderLayer3Item = (item: WhiteboardItem) => {
    if (item.type === 'image') return null;
    
    // Render text as Konva.Text
    if (item.type === 'text') {
      return (
        <KonvaText
          key={item.id}
          id={item.id}
          x={item.x}
          y={item.y}
          text={editingTextId === item.id ? '' : item.text}
          fontSize={item.fontSize}
          fontFamily={item.fontFamily}
          fontStyle={item.fontStyle}
          textDecoration={item.textDecoration}
          fill={item.fill}
          lineHeight={item.lineHeight}
          width={item.width}
          draggable={tool === 'select' || tool === 'text'}
          onClick={() => {
            if (tool === 'select' || tool === 'text') {
              setSelectedId(item.id);
            }
          }}
          onTap={() => {
            if (tool === 'select' || tool === 'text') {
              setSelectedId(item.id);
            }
          }}
          onDblClick={() => handleTextDoubleClick(item.id)}
          onDblTap={() => handleTextDoubleClick(item.id)}
          onTransformEnd={(e: any) => handleTransformEnd(e, item)}
          onDragStart={handleItemDragStart}
          onDragMove={handleItemDragMove}
          onDragEnd={(e: any) => handleItemDragEnd(e, item)}
        />
      );
    }
    
    const commonProps = {
      key: item.id,
      id: item.id,
      draggable: tool === 'select',
      onClick: () => (tool === 'select' || tool === 'text') && setSelectedId(item.id),
      onTap: () => (tool === 'select' || tool === 'text') && setSelectedId(item.id),
      onTransformEnd: (e: any) => handleTransformEnd(e, item),
      onDragStart: handleItemDragStart,
      onDragMove: handleItemDragMove,
      onDragEnd: (e: any) => handleItemDragEnd(e, item),
    };

    if (item.type === 'stroke') {
      if (item.isHighlighter || item.tool === 'highlighter-eraser') return null;
      if ((item as any)._hidden) return null;
      const isEraser = item.tool === 'eraser';
      const isHandwriting = item.tool === 'handwriting';
      return (
        <Line
          {...commonProps}
          listening={!isEraser}
          points={item.points}
          stroke={item.color} // Always use the stroke's own color, never current color
          strokeWidth={item.size} // Always use the stroke's own width, never current size
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          opacity={isHandwriting ? 0.9 : 1} // Slightly more visible for handwriting
          globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'}
          strokeScaleEnabled={false} // Prevent width scaling with zoom
        />
      );
    }

    if (item.type === 'shape') {
      if (item.shapeType === 'line') return <Line {...commonProps} points={item.points || []} stroke={item.stroke} strokeWidth={item.strokeWidth} opacity={item.opacity ?? 1} />;
      if (item.shapeType === 'polygon') return <Line {...commonProps} points={item.points || []} closed={true} stroke={item.stroke} strokeWidth={item.strokeWidth} fill={item.fill || 'transparent'} opacity={item.opacity ?? 1} />;
      if (item.shapeType === 'circle') return <Circle {...commonProps} x={item.x} y={item.y} radius={item.width} stroke={item.stroke} strokeWidth={item.strokeWidth} fill={item.fill || 'transparent'} opacity={item.opacity ?? 1} />;
      if (item.shapeType === 'rect') return <Rect {...commonProps} x={item.x} y={item.y} width={item.width} height={item.height} stroke={item.stroke} strokeWidth={item.strokeWidth} fill={item.fill || 'transparent'} opacity={item.opacity ?? 1} />;
      if (item.shapeType === 'triangle') return <RegularPolygon {...commonProps} x={item.x + (item.width ?? 50) / 2} y={item.y + (item.height ?? 50) / 2} sides={3} radius={(item.width ?? 50) / 2} stroke={item.stroke} strokeWidth={item.strokeWidth} fill={item.fill || 'transparent'} opacity={item.opacity ?? 1} />;
    }
    return null;
  };

  return (
    <div 
      className="fixed inset-0 w-screen h-screen overflow-hidden" 
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        ...getCursorStyle(),
        backgroundColor: '#f5f5f5',
        touchAction: 'none',
      }}
    >

      <Stage
        ref={stageRef}
        style={{ background: 'transparent', zIndex: 10 }}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        draggable={tool === 'hand'}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
      >
        <Layer>
          {items.map((item) => {
            if (item.type !== 'image') return null;
            const commonProps = {
              key: item.id,
              id: item.id,
              draggable: tool === 'select',
              onClick: () => (tool === 'select') && setSelectedId(item.id),
              onTap: () => (tool === 'select') && setSelectedId(item.id),
              onTransformEnd: (e: any) => handleTransformEnd(e, item),
            };
            return <URLImage {...commonProps} image={item} />;
          })}
        </Layer>
        <Layer>
          {items.map((item) => {
            if (item.type !== 'stroke') return null;
            if (item.isHighlighter) {
               if ((item as any)._hidden) return null;
               return <Line key={item.id + '-hl'} id={item.id} points={item.points} stroke={item.color} strokeWidth={item.size} tension={0.5} lineCap="round" lineJoin="round" opacity={0.4} globalCompositeOperation="source-over" />;
            }
            if (item.tool === 'highlighter-eraser') {
               return <Line key={item.id + '-hl'} points={item.points} stroke="#000000" strokeWidth={item.size} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation="destination-out" />;
            }
            return null;
          })}
        </Layer>
        <Layer>
          {items.map((item) => {
            if (item.type === 'image') return null;
            return renderLayer3Item(item);
          })}
          {selectionBox && <Rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.width} height={selectionBox.height} stroke="#0099ff" strokeWidth={1} dash={[5, 5]} />}
          <Line ref={previewLineRef} listening={false} tension={0.5} lineCap="round" lineJoin="round" stroke="#000000" strokeWidth={5} visible={false} />
          <Circle ref={cursorRef} listening={false} radius={size / 2} stroke="#ff1493" strokeWidth={2.5} fill="rgba(255, 20, 147, 0.15)" visible={tool === 'eraser' || tool === 'highlighter-eraser'} opacity={1} />
          <Transformer ref={transformerRef} />
        </Layer>
      </Stage>

    </div>
  );
};





