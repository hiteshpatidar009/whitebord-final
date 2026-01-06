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

// Helper: Parse HTML and create text segments with formatting
const parseHtmlToSegments = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const segments: Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  }> = [];
  
  const traverse = (node: Node, inheritedStyle: any = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        segments.push({ text, ...inheritedStyle });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      const style = { ...inheritedStyle };
      
      // Apply formatting based on tags
      if (tagName === 'b' || tagName === 'strong') {
        style.bold = true;
      } else if (tagName === 'i' || tagName === 'em') {
        style.italic = true;
      } else if (tagName === 'u') {
        style.underline = true;
      } else if (tagName === 'font') {
        const color = element.getAttribute('color');
        if (color) style.color = color;
      }
      
      // Traverse children with inherited style
      element.childNodes.forEach(child => traverse(child, style));
    }
  };
  
  div.childNodes.forEach(node => traverse(node));
  return segments;
};

// Rich Text Component for Konva
const RichText: React.FC<{
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  width?: number;
  draggable?: boolean;
  onClick?: (e?: any) => void;
  onTap?: () => void;
  onDblClick?: () => void;
  onDblTap?: () => void;
  onTransformEnd?: (e: any) => void;
  onDragStart?: (e: any) => void;
  onDragMove?: (e: any) => void;
  onDragEnd?: (e: any) => void;
}> = (props) => {
  // Parse HTML and render multiple text elements for different formatting
  const segments = parseHtmlToSegments(props.text);
  
  if (segments.length === 0) {
    // Fallback to plain text
    return (
      <KonvaText
        id={props.id}
        x={props.x}
        y={props.y}
        text={props.text}
        fontSize={props.fontSize}
        fontFamily={props.fontFamily}
        fill={props.fill}
        width={props.width}
        draggable={props.draggable}
        onClick={props.onClick}
        onTap={props.onTap}
        onDblClick={props.onDblClick}
        onDblTap={props.onDblTap}
        onTransformEnd={props.onTransformEnd}
        onDragStart={props.onDragStart}
        onDragMove={props.onDragMove}
        onDragEnd={props.onDragEnd}
      />
    );
  }
  
  let currentX = 0;
  let currentY = 0;
  const lineHeight = props.fontSize * 1.2;
  
  return (
    <React.Fragment>
      {segments.map((segment, index) => {
        const fontStyle = `${segment.bold ? 'bold ' : ''}${segment.italic ? 'italic' : ''}`.trim();
        const textDecoration = segment.underline ? 'underline' : '';
        const fill = segment.color || props.fill;
        
        // Handle line breaks
        const lines = segment.text.split('\n');
        
        return lines.map((line, lineIndex) => {
          if (lineIndex > 0) {
            currentX = 0;
            currentY += lineHeight;
          }
          
          const textElement = (
            <KonvaText
              key={`${index}-${lineIndex}`}
              id={lineIndex === 0 && index === 0 ? props.id : undefined}
              x={props.x + currentX}
              y={props.y + currentY}
              text={line}
              fontSize={props.fontSize}
              fontFamily={props.fontFamily}
              fontStyle={fontStyle}
              textDecoration={textDecoration}
              fill={fill}
              draggable={lineIndex === 0 && index === 0 ? props.draggable : false}
              onClick={props.onClick}
              onTap={props.onTap}
              onDblClick={props.onDblClick}
              onDblTap={props.onDblTap}
              onTransformEnd={lineIndex === 0 && index === 0 ? props.onTransformEnd : undefined}
              onDragStart={lineIndex === 0 && index === 0 ? props.onDragStart : undefined}
              onDragMove={lineIndex === 0 && index === 0 ? props.onDragMove : undefined}
              onDragEnd={lineIndex === 0 && index === 0 ? props.onDragEnd : undefined}
            />
          );
          
          // Update position for next segment (approximate width calculation)
          const ctx = document.createElement('canvas').getContext('2d');
          if (ctx) {
            ctx.font = `${fontStyle} ${props.fontSize}px ${props.fontFamily}`;
            currentX += ctx.measureText(line).width;
          } else {
            currentX += line.length * props.fontSize * 0.6;
          }
          
          return textElement;
        });
      })}
    </React.Fragment>
  );
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
    groupItems,
    ungroupItems,
  } = useWhiteboardStore();

    // Clipboard for copy-paste
    const clipboardRef = useRef<WhiteboardItem[] | null>(null);
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

    // Don't show transformer when editing text
    if (editingTextId) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }

    if (selectedId) {
      const stage = stageRef.current;
      if (!stage) return;
      
      // Handle multiple selected items
      const selectedIds = selectedId.split(',');
      const nodes: Konva.Node[] = [];
      
      selectedIds.forEach(id => {
        const node = stage.findOne('#' + id);
        if (node) {
          nodes.push(node);
          
          // Find overlapping erasers for each selected item
          const selectedRect = node.getClientRect();
          items.forEach(item => {
            if (item.type === 'stroke' && (item.tool === 'eraser' || item.tool === 'highlighter-eraser')) {
              const eraserNode = stage.findOne('#' + item.id);
              if (eraserNode) {
                const eraserRect = eraserNode.getClientRect();
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
        }
      });

      if (nodes.length > 0) {
        transformerRef.current.nodes(nodes);
        
        // Configure transformer based on selection
        const hasText = selectedIds.some(id => {
          const item = items.find(i => i.id === id);
          return item?.type === 'text';
        });
        
        if (hasText && selectedIds.length === 1) {
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
      // Group items with Ctrl+G
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (selectedId) {
          const selectedIds = selectedId.split(',').filter(id => id);
          if (selectedIds.length > 1) {
            groupItems(selectedIds);
            saveHistory();
          }
        }
        return;
      }
      
      // Ungroup items with Ctrl+Shift+G
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        if (selectedId) {
          const item = items.find(i => i.id === selectedId);
          if (item && item.type === 'group') {
            ungroupItems(selectedId);
            saveHistory();
          }
        }
        return;
      }
      
      if (e.key === 'Delete' && selectedId) {
        const selectedIds = selectedId.split(',');
        selectedIds.forEach(id => removeItem(id));
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

        // Copy selected items (Ctrl+C)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && tool === 'select' && selectedId) {
          e.preventDefault();
          const selectedIds = selectedId.split(',').filter(id => id);
          clipboardRef.current = selectedIds
            .map(id => items.find(i => i.id === id))
            .filter(Boolean)
            .map(item => ({ ...item, id: undefined })); // Remove id for duplication
          return;
        }

        // Paste copied items (Ctrl+V)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && tool === 'select' && clipboardRef.current && clipboardRef.current.length > 0) {
          e.preventDefault();
          const newIds: string[] = [];
          clipboardRef.current.forEach(item => {
            const newId = uuidv4();
            newIds.push(newId);
            let offsetItem = { ...item, id: newId };
            if (typeof offsetItem.x === 'number') offsetItem.x += 30;
            if (typeof offsetItem.y === 'number') offsetItem.y += 30;
            // Only offset points for items that have them
            if (
              (offsetItem.type === 'stroke' || offsetItem.type === 'shape') &&
              Array.isArray((offsetItem as any).points)
            ) {
              offsetItem.points = (offsetItem as any).points.map((p: number, i: number) => p + (i % 2 === 0 ? 30 : 30));
            }
            addItem(offsetItem);
          });
          setSelectedId(newIds.join(','));
          saveHistory();
          return;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [selectedId, removeItem, setSelectedId, saveHistory, groupItems, ungroupItems, items]);

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

    if (clickedOnEmpty && tool === 'select') {
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
      } else {
        // Close any existing text editor when clicking on empty space
        const existingContainer = document.querySelector('[data-text-editor]');
        if (existingContainer) {
          document.body.removeChild(existingContainer);
          setEditingTextId(null);
        }
        // Only clear selection with text tool if no selection exists
        if (!selectedId) {
          setSelectedId(null);
        }
      }
      return; 
    }

    if (tool === 'fill') {
       const shape = e.target;
       if (shape === stage) return;
       
       // Apply fill to selected items if any are selected
       if (selectedId) {
         const selectedIds = selectedId.split(',');
         selectedIds.forEach(id => {
           const item = items.find(i => i.id === id);
           if (item) {
             if (item.type === 'shape') {
               const transparentFill = hexToRgba(color, 0.6);
               updateItem(id, { fill: transparentFill, opacity: 1 });
             } else if (item.type === 'text') {
               updateItem(id, { fill: color });
             }
           }
         });
         saveHistory();
         return;
       }
       
       // Apply fill to clicked item if no selection
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

    // Handle selection for all tools
    if (!clickedOnEmpty) {
      const targetId = e.target.id();
      if (targetId) {
        const isMultiSelect = (e.evt as MouseEvent).ctrlKey || (e.evt as MouseEvent).metaKey;
        
        if (tool === 'select') {
          const currentSelected = selectedId ? selectedId.split(',') : [];
          
          if (isMultiSelect) {
            // Ctrl+click: toggle item
            if (currentSelected.includes(targetId)) {
              const newSelected = currentSelected.filter(id => id !== targetId);
              setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
            } else {
              setSelectedId([...currentSelected, targetId].join(','));
            }
          } else {
            // Normal click: always add to selection
            if (!currentSelected.includes(targetId)) {
              setSelectedId([...currentSelected, targetId].join(','));
            }
          }
          return;
        }
      }
    }
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
            cursorRef.current.radius((size * 2.5) / 2);
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

    if (item.type === 'group') {
      // For groups, update width and height
      updatePayload.width = Math.max(5, node.width() * scaleX);
      updatePayload.height = Math.max(5, node.height() * scaleY);
      
      // Also update all child items' positions and sizes proportionally
      const originalWidth = item.width;
      const originalHeight = item.height;
      const scaleRatioX = originalWidth > 0 ? (updatePayload.width / originalWidth) : 1;
      const scaleRatioY = originalHeight > 0 ? (updatePayload.height / originalHeight) : 1;
      const deltaX = updatePayload.x - item.x;
      const deltaY = updatePayload.y - item.y;
      
      item.items?.forEach((childItem: WhiteboardItem) => {
        const childUpdatePayload: any = {};
        
        if (childItem.type === 'text' || childItem.type === 'image' || (childItem.type === 'shape' && childItem.shapeType !== 'line' && childItem.shapeType !== 'polygon')) {
          // Update position relative to group
          childUpdatePayload.x = item.x + ((childItem.x || 0) - item.x) * scaleRatioX + deltaX;
          childUpdatePayload.y = item.y + ((childItem.y || 0) - item.y) * scaleRatioY + deltaY;
          
          // Update size if applicable
          if (childItem.type === 'image' || (childItem.type === 'shape' && childItem.shapeType === 'rect')) {
            childUpdatePayload.width = Math.max(5, (childItem.width || 0) * scaleRatioX);
            childUpdatePayload.height = Math.max(5, (childItem.height || 0) * scaleRatioY);
          } else if (childItem.type === 'text') {
            childUpdatePayload.fontSize = Math.max(10, (childItem.fontSize || 12) * scaleRatioY);
            childUpdatePayload.width = Math.max(30, (childItem.width || 100) * scaleRatioX);
          }
        } else if (childItem.type === 'stroke' || (childItem.type === 'shape' && (childItem.shapeType === 'line' || childItem.shapeType === 'polygon'))) {
          const newPoints = (childItem.points || []).map((p: number, i: number) => {
            if (i % 2 === 0) return item.x + (p - item.x) * scaleRatioX + deltaX;
            return item.y + (p - item.y) * scaleRatioY + deltaY;
          });
          childUpdatePayload.points = newPoints;
          
          // Update stroke width proportionally
          if (childItem.type === 'stroke') {
            childUpdatePayload.size = Math.max(1, (childItem.size || 2) * Math.max(scaleRatioX, scaleRatioY));
          } else if (childItem.type === 'shape') {
            childUpdatePayload.strokeWidth = Math.max(1, (childItem.strokeWidth || 2) * Math.max(scaleRatioX, scaleRatioY));
          }
        }
        
        if (Object.keys(childUpdatePayload).length > 0) {
          updateItem(childItem.id, childUpdatePayload);
        }
      });
    } else if (item.type === 'text') {
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
    setSelectedId(null);
    
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
    container.style.width = `${Math.max(300, textItem.width * stageScale)}px`;
    container.style.resize = 'both';
    container.style.overflow = 'hidden';
    container.style.background = '#fff';
    container.style.border = '2px solid #0099ff';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    toolbar.style.background = '#f8f9fa';
    toolbar.style.padding = '8px';
    toolbar.style.borderBottom = '1px solid #dee2e6';
    toolbar.style.cursor = 'move';
    toolbar.style.flexWrap = 'wrap';
    
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

    // Helper function to apply formatting to selected text
    const applyFormatToSelection = (command: string) => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        document.execCommand(command, false);
      }
      editableDiv.focus();
    };

    // Bold button
    const boldBtn = document.createElement('button');
    boldBtn.innerHTML = '<b>B</b>';
    boldBtn.style.width = '28px';
    boldBtn.style.height = '28px';
    boldBtn.style.border = '1px solid #dee2e6';
    boldBtn.style.borderRadius = '4px';
    boldBtn.style.cursor = 'pointer';
    boldBtn.style.background = '#fff';
    boldBtn.style.fontSize = '14px';
    boldBtn.style.fontWeight = 'bold';
    boldBtn.title = 'Bold (Ctrl+B)';
    boldBtn.onmousedown = (e) => e.preventDefault();
    boldBtn.onclick = (e) => {
      e.stopPropagation();
      applyFormatToSelection('bold');
    };

    // Italic button
    const italicBtn = document.createElement('button');
    italicBtn.innerHTML = '<i>I</i>';
    italicBtn.style.width = '28px';
    italicBtn.style.height = '28px';
    italicBtn.style.border = '1px solid #dee2e6';
    italicBtn.style.borderRadius = '4px';
    italicBtn.style.cursor = 'pointer';
    italicBtn.style.background = '#fff';
    italicBtn.style.fontSize = '14px';
    italicBtn.style.fontStyle = 'italic';
    italicBtn.title = 'Italic (Ctrl+I)';
    italicBtn.onmousedown = (e) => e.preventDefault();
    italicBtn.onclick = (e) => {
      e.stopPropagation();
      applyFormatToSelection('italic');
    };

    // Underline button
    const underlineBtn = document.createElement('button');
    underlineBtn.innerHTML = '<u>U</u>';
    underlineBtn.style.width = '28px';
    underlineBtn.style.height = '28px';
    underlineBtn.style.border = '1px solid #dee2e6';
    underlineBtn.style.borderRadius = '4px';
    underlineBtn.style.cursor = 'pointer';
    underlineBtn.style.background = '#fff';
    underlineBtn.style.fontSize = '14px';
    underlineBtn.style.textDecoration = 'underline';
    underlineBtn.title = 'Underline (Ctrl+U)';
    underlineBtn.onmousedown = (e) => e.preventDefault();
    underlineBtn.onclick = (e) => {
      e.stopPropagation();
      applyFormatToSelection('underline');
    };

    // Text color picker
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = (textItem as any).fill || '#000000';
    colorPicker.style.width = '28px';
    colorPicker.style.height = '28px';
    colorPicker.style.border = '1px solid #dee2e6';
    colorPicker.style.borderRadius = '4px';
    colorPicker.style.cursor = 'pointer';
    colorPicker.style.padding = '0';
    colorPicker.title = 'Text Color';
    colorPicker.onmousedown = (e) => e.stopPropagation();
    colorPicker.onchange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        document.execCommand('foreColor', false, colorPicker.value);
      } else {
        editableDiv.style.color = colorPicker.value;
        updateItem(textId, { fill: colorPicker.value });
      }
      editableDiv.focus();
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
    fontSelect.style.padding = '4px';
    fontSelect.style.border = '1px solid #dee2e6';
    fontSelect.style.borderRadius = '4px';
    fontSelect.onmousedown = (e) => e.stopPropagation();
    fontSelect.onchange = () => {
      const newFont = FONT_STACKS[fontSelect.value] || fontSelect.value;
      editableDiv.style.fontFamily = newFont;
      updateItem(textId, { fontFamily: newFont });
      editableDiv.focus();
    };

    // Font size selector
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.value = (textItem as any).fontSize.toString();
    sizeInput.style.width = '50px';
    sizeInput.style.fontSize = '12px';
    sizeInput.style.padding = '4px';
    sizeInput.style.border = '1px solid #dee2e6';
    sizeInput.style.borderRadius = '4px';
    sizeInput.onmousedown = (e) => e.stopPropagation();
    sizeInput.oninput = () => {
      const newSize = parseInt(sizeInput.value);
      if (newSize > 0) {
        editableDiv.style.fontSize = `${newSize}px`;
        updateItem(textId, { fontSize: newSize });
      }
    };

    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(underlineBtn);
    toolbar.appendChild(colorPicker);
    toolbar.appendChild(fontSelect);
    toolbar.appendChild(sizeInput);

    // Create editable div instead of textarea for rich text support
    const editableDiv = document.createElement('div');
    editableDiv.contentEditable = 'true';
    editableDiv.innerHTML = (textItem as any).text === 'Type here...' ? '' : (textItem as any).text;
    editableDiv.style.fontSize = `${(textItem as any).fontSize}px`;
    editableDiv.style.fontFamily = (textItem as any).fontFamily;
    editableDiv.style.color = (textItem as any).fill;
    editableDiv.style.background = 'transparent';
    editableDiv.style.border = 'none';
    editableDiv.style.outline = 'none';
    editableDiv.style.minWidth = '280px';
    editableDiv.style.minHeight = '100px';
    editableDiv.style.maxHeight = '400px';
    editableDiv.style.overflowY = 'auto';
    editableDiv.style.padding = '12px';
    editableDiv.style.lineHeight = '1.4';
    editableDiv.style.wordWrap = 'break-word';
    editableDiv.style.whiteSpace = 'pre-wrap';
    
    // Add placeholder behavior
    if (!editableDiv.innerHTML.trim()) {
      editableDiv.innerHTML = '<span style="color: #999;">Type here...</span>';
    }
    
    editableDiv.onfocus = () => {
      if (editableDiv.innerHTML === '<span style="color: #999;">Type here...</span>') {
        editableDiv.innerHTML = '';
      }
    };
    
    editableDiv.onblur = () => {
      if (!editableDiv.innerHTML.trim()) {
        editableDiv.innerHTML = '<span style="color: #999;">Type here...</span>';
      }
    };
    
    const finishEditing = () => {
      let newText = editableDiv.innerHTML;
      if (newText === '<span style="color: #999;">Type here...</span>' || !newText.trim()) {
        newText = 'Type here...';
      }
      updateItem(textId, { text: newText });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      document.removeEventListener('click', handleClickOutside);
      document.onmousemove = null;
      document.onmouseup = null;
      setEditingTextId(null);
      setSelectedId(textId);
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

    // Handle keyboard shortcuts
    editableDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      }
      if (e.key === 'Escape') {
        finishEditing();
      }
      // Handle formatting shortcuts
      if (e.ctrlKey) {
        if (e.key === 'b') {
          e.preventDefault();
          applyFormatToSelection('bold');
        } else if (e.key === 'i') {
          e.preventDefault();
          applyFormatToSelection('italic');
        } else if (e.key === 'u') {
          e.preventDefault();
          applyFormatToSelection('underline');
        }
      }
    });
    
    container.appendChild(toolbar);
    container.appendChild(editableDiv);
    document.body.appendChild(container);
    textareaRef.current = editableDiv as any;
    editableDiv.focus();
    
    // Select all text if it's the default placeholder
    if ((textItem as any).text === 'Type here...') {
      const range = document.createRange();
      range.selectNodeContents(editableDiv);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const handleTextDoubleClick = (textId: string) => {
    if (tool === 'text') {
      startTextEditing(textId);
    }
  };

  const handleCanvasDoubleClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Only handle double-click on existing text items, not empty canvas
    if (tool === 'text') {
      const stage = e.target.getStage();
      const clickedOnEmpty = e.target === stage;
      
      if (!clickedOnEmpty) {
        // Double-click on existing text to edit
        const targetId = e.target.id();
        if (targetId) {
          // Ensure the text item stays selected when double-clicking
          const currentSelected = selectedId ? selectedId.split(',') : [];
          if (!currentSelected.includes(targetId)) {
            setSelectedId(targetId);
          }
          startTextEditing(targetId);
        }
      }
    }
  };

  // Expose startTextEditing globally for toolbar access
  useEffect(() => {
    (window as any).startTextEditing = startTextEditing;
    return () => {
      delete (window as any).startTextEditing;
    };
  }, [startTextEditing]);

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
      const dx = node.x() - (dragStartPosRef.current?.x || node.x());
      const dy = node.y() - (dragStartPosRef.current?.y || node.y());
      
      // Handle group item movement - move all items in the group
      if (item.type === 'group') {
        // Update group position
        updateItem(item.id, { x: node.x(), y: node.y() });
        
        // Move all items in the group
        item.items?.forEach((childItem: WhiteboardItem) => {
          if (childItem.type === 'text' || childItem.type === 'image' || (childItem.type === 'shape' && childItem.shapeType !== 'line' && childItem.shapeType !== 'polygon')) {
            updateItem(childItem.id, { 
              x: (childItem.x || 0) + dx, 
              y: (childItem.y || 0) + dy 
            });
          } else if (childItem.type === 'stroke' || (childItem.type === 'shape' && (childItem.shapeType === 'line' || childItem.shapeType === 'polygon'))) {
            const newPoints = (childItem.points || []).map((p: number, i: number) => 
              i % 2 === 0 ? p + dx : p + dy
            );
            updateItem(childItem.id, { points: newPoints });
          }
        });
      } else {
        updateItem(item.id, { x: node.x(), y: node.y() });
      }
      
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
    
    // Don't render items that are part of a group
    const itemIsInGroup = items.some(i => i.type === 'group' && (i as any).items.some((gItem: any) => gItem.id === item.id));
    if (itemIsInGroup) return null;
    
    // Render group items as selectable rectangles
    if (item.type === 'group') {
      return (
        <Rect
          key={item.id}
          id={item.id}
          x={item.x}
          y={item.y}
          width={item.width}
          height={item.height}
          stroke="#0099ff"
          strokeWidth={2}
          fill="transparent"
          dash={[5, 5]}
          draggable={tool === 'select'}
          onClick={(e: any) => {
            if (tool === 'select') {
              const isMultiSelect = e.evt?.ctrlKey || e.evt?.metaKey;
              const currentSelected = selectedId ? selectedId.split(',') : [];
              
              if (isMultiSelect) {
                if (currentSelected.includes(item.id)) {
                  const newSelected = currentSelected.filter(id => id !== item.id);
                  setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                } else {
                  setSelectedId([...currentSelected, item.id].join(','));
                }
              } else {
                if (!currentSelected.includes(item.id)) {
                  setSelectedId([...currentSelected, item.id].join(','));
                }
              }
            }
          }}
          onTap={() => {
            if (tool === 'select') {
              setSelectedId(item.id);
            }
          }}
          onTransformEnd={(e: any) => handleTransformEnd(e, item)}
          onDragStart={handleItemDragStart}
          onDragMove={handleItemDragMove}
          onDragEnd={(e: any) => handleItemDragEnd(e, item)}
        />
      );
    }
    
    // Render text as Rich Text
    if (item.type === 'text') {
      // Don't render text on canvas while editing it
      if (editingTextId === item.id) {
        return null;
      }

      return (
        <RichText
          key={item.id}
          id={item.id}
          x={item.x}
          y={item.y}
          text={item.text}
          fontSize={item.fontSize}
          fontFamily={item.fontFamily}
          fill={item.fill}
          width={item.width}
          draggable={tool === 'select' || tool === 'text'}
          onClick={(e: any) => {
            if (tool === 'select' || tool === 'text') {
              const isMultiSelect = e.evt?.ctrlKey || e.evt?.metaKey;
              const currentSelected = selectedId ? selectedId.split(',') : [];
              
              if (isMultiSelect && tool === 'select') {
                if (currentSelected.includes(item.id)) {
                  const newSelected = currentSelected.filter(id => id !== item.id);
                  setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                } else {
                  setSelectedId([...currentSelected, item.id].join(','));
                }
              } else {
                if (!currentSelected.includes(item.id)) {
                  setSelectedId([...currentSelected, item.id].join(','));
                }
              }
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
      onClick: (e: any) => {
        if (tool === 'select' || tool === 'text') {
          const isMultiSelect = e.evt?.ctrlKey || e.evt?.metaKey;
          const currentSelected = selectedId ? selectedId.split(',') : [];
          
          if (isMultiSelect && tool === 'select') {
            if (currentSelected.includes(item.id)) {
              const newSelected = currentSelected.filter(id => id !== item.id);
              setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
            } else {
              setSelectedId([...currentSelected, item.id].join(','));
            }
          } else {
            if (!currentSelected.includes(item.id)) {
              setSelectedId([...currentSelected, item.id].join(','));
            }
          }
        }
      },
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
          strokeWidth={isEraser ? item.size * 2 + 10 : item.size} // Rule 2: Eraser overlap buffer
          hitStrokeWidth={isEraser ? item.size * 3 : undefined} // Rule 5: Larger hit precision for eraser
          tension={isEraser ? 0 : 0.5} // Rule 1: Straight segments for eraser, curved for pen
          lineCap={isEraser ? 'butt' : 'round'}
          lineJoin={isEraser ? 'miter' : 'round'}
          opacity={isHandwriting ? 0.9 : 1} // Slightly more visible for handwriting
          globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'} // Rule 3: Same-layer compositing
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
        onClick={(e) => {
          // Deselect when clicking on empty canvas
          if (e.target === e.target.getStage()) {
            setSelectedId(null);
          }
        }}
        onDblClick={handleCanvasDoubleClick}
        onDblTap={handleCanvasDoubleClick}
        draggable={tool === 'hand'}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        perfectDrawEnabled={false}
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
               return <Line key={item.id + '-hl'} points={item.points} stroke="#000000" strokeWidth={item.size * 2 + 10} hitStrokeWidth={item.size * 3} tension={0} lineCap="butt" lineJoin="miter" globalCompositeOperation="destination-out" />;
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





