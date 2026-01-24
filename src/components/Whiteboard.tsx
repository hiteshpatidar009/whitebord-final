
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Stage, Layer, Line, Image as KonvaImage, Rect, Circle, RegularPolygon, Transformer, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import type { Stroke, WhiteboardItem } from '../types';
import { getBoundingBox } from '../utils/canvasUtils';
import { FONT_STACKS, FONTS } from './TextToolbar';
import ChromeWidget from './ChromeWidget';
import Protractor from './tabs/Protractor';
import Divider from './Divider/Divider';
import { RulerUtils } from './tabs/Ruler';


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

// --- COMPONENTS ---

// Rich Text Component for Konva
// const RichText: React.FC<{
//   id: string;
//   x: number;
//   y: number;
//   text: string;
//   fontSize: number;
//   fontFamily: string;
//   fill: string;
//   width?: number;
//   draggable?: boolean;
//   onClick?: (e?: any) => void;
//   onTap?: () => void;
//   onDblClick?: () => void;
//   onDblTap?: () => void;
//   onTransformEnd?: (e: any) => void;
//   onDragStart?: (e: any) => void;
//   onDragMove?: (e: any) => void;
//   onDragEnd?: (e: any) => void;
// }> = (props) => {
//   // Parse HTML and render multiple text elements for different formatting
//   const segments = parseHtmlToSegments(props.text);
  
//   if (segments.length === 0) {
//     // Fallback to plain text
//     return (
//       <KonvaText
//         id={props.id}
//         x={props.x}
//         y={props.y}
//         text={props.text}
//         fontSize={props.fontSize}
//         fontFamily={props.fontFamily}
//         fill={props.fill}
//         width={props.width}
//         draggable={props.draggable}
//         onClick={props.onClick}
//         onTap={props.onTap}
//         onDblClick={props.onDblClick}
//         onDblTap={props.onDblTap}
//         onTransformEnd={props.onTransformEnd}
//         onDragStart={props.onDragStart}
//         onDragMove={props.onDragMove}
//         onDragEnd={props.onDragEnd}
//       />
//     );
//   }

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
  // Parse HTML to extract text and formatting
  const { text, fontWeight, fontStyle, textDecoration, color } = React.useMemo(() => {
    const div = document.createElement('div');
    div.innerHTML = props.text;
    
    // Check for formatting
    const hasBold = /<(b|strong)/.test(props.text);
    const hasItalic = /<(i|em)/.test(props.text);
    const hasUnderline = /<u/.test(props.text);
    
    // Extract color from HTML (look for style="color:" or <font color="">)
    const colorMatch = props.text.match(/(?:style="[^"]*color:\s*([^;"]+)|<font[^>]+color="([^"]+)")/);
    const extractedColor = colorMatch ? (colorMatch[1] || colorMatch[2]) : null;
    
    const plainText = div.textContent || div.innerText || '';
    
    return {
      text: plainText.replace(/\n\s*\n/g, '\n'),
      fontWeight: hasBold ? 'bold' : 'normal',
      fontStyle: hasItalic ? 'italic' : 'normal',
      textDecoration: hasUnderline ? 'underline' : 'none',
      color: extractedColor || props.fill
    };
  }, [props.text, props.fill]);

  return (
    <KonvaText
      id={props.id}
      x={props.x}
      y={props.y}
      text={text}
      fontSize={props.fontSize}
      fontFamily={props.fontFamily}
      fill={color}
      fontStyle={`${fontStyle} ${fontWeight}`}
      textDecoration={textDecoration}
      width={props.width}
      wrap="word"
      lineHeight={1.4}
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
};

// URLImage component for loading images
const URLImage = ({ image, onClick, onTap, draggable, onTransformEnd }: { image: any, onClick?: (e?: any) => void, onTap?: () => void, draggable?: boolean, onTransformEnd?: (e: any) => void }) => {
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
    showProtractor,
    showDivider,
    rulerGeometry,
    // triangle45Geometry,
    // triangle60Geometry,
  } = useWhiteboardStore();

  // --- PAN STATE ---
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
  // const _lastRightClickTime = useRef<number>(0);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number, isMultiSelect?: boolean } | null>(null);
  const [chromeWidgets, setChromeWidgets] = useState<Array<{ id: string; x: number; y: number; locked: boolean }>>([]);

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
        
        // Enable dragging for multiple selections
        if (selectedIds.length > 1) {
          nodes.forEach(node => {
            node.draggable(true);
          });
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
      // Don't trigger if user is typing in an input or contenteditable
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      // Copy selected items with Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (selectedId) {
          const selectedIds = selectedId.split(',').filter(id => id);
          const selectedItems = selectedIds.map(id => items.find(item => item.id === id)).filter(Boolean);
          if (selectedItems.length > 0) {
            localStorage.setItem('whiteboard-clipboard', JSON.stringify(selectedItems));
          }
        }
        return;
      }
      
      // Paste items with Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const clipboardData = localStorage.getItem('whiteboard-clipboard');
        if (clipboardData) {
          try {
            const clipboardItems = JSON.parse(clipboardData);
            const newItems = clipboardItems.map((item: any) => ({
              ...item,
              id: uuidv4(),
              x: (item.x || 0) + 20,
              y: (item.y || 0) + 20
            }));
            newItems.forEach((item: any) => addItem(item));
            setSelectedId(newItems.map((item: any) => item.id).join(','));
            saveHistory();
          } catch (error) {
            console.error('Failed to paste items:', error);
          }
        }
        return;
      }

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
    };

    const handlePaste = (e: ClipboardEvent) => {
      // Don't trigger if user is typing in an input or contenteditable
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const text = e.clipboardData?.getData('text');
      if (text) {
        e.preventDefault();
        
        // Add new text item from clipboard
        addItem({
          type: 'text',
          id: uuidv4(),
          x: (window.innerWidth / 2 - stagePos.x) / stageScale - 200,
          y: (window.innerHeight / 2 - stagePos.y) / stageScale - 50,
          text: text,
          fontSize: 40,
          fontFamily: textOptions.fontFamily,
          fill: color,
          width: 400, // Explicit width for wrapping
        });
        saveHistory();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('paste', handlePaste);
    };
  }, [selectedId, removeItem, setSelectedId, saveHistory, groupItems, ungroupItems, items, addItem]);

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
          fontSize: 44,
          fontFamily: 'Monotype Corsiva, "Brush Script MT", cursive',
          fill: color, // Store the color that was active when handwriting was created
          width: 400,
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

  // Touch scaling state
  const touchStateRef = useRef({
    lastTouchDistance: 0,
    lastTouchCenter: { x: 0, y: 0 },
    isTouchScaling: false
  });

  const getTouchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: TouchList) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.evt.preventDefault();
    const touches = (e.evt as TouchEvent).touches;
    
    // Handle multi-touch for scaling
    if (touches && touches.length === 2) {
      touchStateRef.current.isTouchScaling = true;
      touchStateRef.current.lastTouchDistance = getTouchDistance(touches);
      touchStateRef.current.lastTouchCenter = getTouchCenter(touches);
      return;
    }
    
    if (touches && touches.length > 1) return;

    const stage = e.target.getStage();
    const clickedOnEmpty = e.target === stage;
    const isTouch = e.evt.type === 'touchstart';
    const isRightClick = !isTouch && (e.evt as MouseEvent).button === 2;
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;

    // --- PAN TOOL LOGIC ---
    if (tool === 'hand') {
      isPanningRef.current = true;
      const clientX = isTouch ? (e.evt as TouchEvent).touches[0].clientX : (e.evt as MouseEvent).clientX;
      const clientY = isTouch ? (e.evt as TouchEvent).touches[0].clientY : (e.evt as MouseEvent).clientY;
      panStartRef.current = { x: clientX, y: clientY };
      panOriginRef.current = { x: stagePos.x, y: stagePos.y };
      return;
    }

    if (clickedOnEmpty && tool === 'select') {
        const isMultiSelect = (e.evt as MouseEvent).ctrlKey || (e.evt as MouseEvent).metaKey;
        if (!isMultiSelect) {
          setSelectedId(null);
        }
        // Start selection box with multiselect flag
        setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0, isMultiSelect });
    }

    if (tool === 'text') {
      const targetId = e.target.id() || e.target.getParent()?.id();
      const clickedItem = items.find(i => i.id === targetId!);
      if (clickedItem?.type === 'text') {
        setSelectedId(targetId!);
      }
      return;
    }

    if (tool === 'fill') {
       const shape = e.target;
       if (shape === stage) return;
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
       const id = shape.id() || shape.getParent()?.id();
       const item = items.find(i => i && i.id === id!);
       if (item) {
           if (item.type === 'shape') {
               const transparentFill = hexToRgba(color, 0.6);
               updateItem(id!, { fill: transparentFill, opacity: 1 });
               saveHistory();
           } else if (item.type === 'text') {
               updateItem(id!, { fill: color }); 
               saveHistory();
           }
       }
       return;
    }

    if (!clickedOnEmpty) {
      const targetId = e.target.id() || e.target.getParent()?.id();
      if (targetId! && tool === 'select') {
        const currentSelected = selectedId ? selectedId.split(',') : [];
        if (currentSelected.includes(targetId!)) {
          const newSelected = currentSelected.filter(id => id !== targetId!);
          setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
        } else {
          setSelectedId([...currentSelected, targetId!].join(','));
        }
        return;
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
       // Check for text collision
       items.forEach(item => {
         if (item.type === 'text') {
           const textRect = {
             x: item.x,
             y: item.y,
             width: item.width || 200,
             height: item.fontSize * 1.4
           };
           if (pos.x >= textRect.x && pos.x <= textRect.x + textRect.width &&
               pos.y >= textRect.y && pos.y <= textRect.y + textRect.height) {
             // Calculate which word to erase based on position
             const words = item.text.split(' ');
             const charWidth = item.fontSize * 0.6; // Approximate character width
             const relativeX = pos.x - item.x;
             const wordIndex = Math.floor(relativeX / (charWidth * 6)); // Approximate word position
             
             if (wordIndex >= 0 && wordIndex < words.length) {
               words.splice(wordIndex, 1);
               const newText = words.join(' ').trim() || 'Type here...';
               updateItem(item.id, { text: newText });
             }
           }
         }
       });
       
       addItem({
        type: 'stroke',
        id,
        tool,
        points: [pos.x, pos.y],
        color: '#000000',
        size: size * 0.9,
        isEraser: true,
        isHighlighter: false
      });
       return;
    }

    if (tool === 'handwriting') {
      isHandwritingActive.current = true;
      handwritingStrokesRef.current.push(id);
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current);
      }
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

    if (tool === 'line') {
      addItem({
        type: 'shape',
        id,
        shapeType: 'line',
        points: [pos.x, pos.y],
        stroke: color,
        strokeWidth: size,
        opacity: 1,
        x: 0,
        y: 0
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
    // Guard: Never process canvas events if target is text or when pan tool is active with text overlay
    if ((e.evt.target as HTMLElement)?.dataset?.type === 'text' || 
        (tool === 'hand' && (e.evt.target as HTMLElement)?.closest('[data-text-overlay]'))) return;
    
    const touches = (e.evt as TouchEvent).touches;
    
    // Handle multi-touch scaling
    if (touches && touches.length === 2 && touchStateRef.current.isTouchScaling) {
      const stage = e.target.getStage();
      if (!stage) return;
      
      const currentDistance = getTouchDistance(touches);
      const currentCenter = getTouchCenter(touches);
      
      // Calculate scale change
      const scaleChange = currentDistance / touchStateRef.current.lastTouchDistance;
      const oldScale = stage.scaleX();
      const newScale = Math.max(0.1, Math.min(5, oldScale * scaleChange));
      
      // Calculate position to maintain center point
      const stageRect = stage.container().getBoundingClientRect();
      const centerX = currentCenter.x - stageRect.left;
      const centerY = currentCenter.y - stageRect.top;
      
      const mousePointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale
      };
      
      setStageScale(newScale);
      setStagePos({
        x: centerX - mousePointTo.x * newScale,
        y: centerY - mousePointTo.y * newScale
      });
      
      touchStateRef.current.lastTouchDistance = currentDistance;
      touchStateRef.current.lastTouchCenter = currentCenter;
      return;
    }
    
    const stage = e.target.getStage();
    const point = stage?.getRelativePointerPosition();
    if (!point) return;

    // --- PAN TOOL LOGIC ---
    if (tool === 'hand' && isPanningRef.current && panStartRef.current) {
      const isTouch = e.evt.type === 'touchmove';
      const clientX = isTouch ? (e.evt as TouchEvent).touches[0].clientX : (e.evt as MouseEvent).clientX;
      const clientY = isTouch ? (e.evt as TouchEvent).touches[0].clientY : (e.evt as MouseEvent).clientY;
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      setStagePos({
        x: panOriginRef.current.x + dx,
        y: panOriginRef.current.y + dy,
      });
      return;
    }

    // Handle selection box dragging
    if (selectionBox && tool === 'select') {
      const newWidth = point.x - selectionBox.x;
      const newHeight = point.y - selectionBox.y;
      setSelectionBox({
        x: selectionBox.x,
        y: selectionBox.y,
        width: newWidth,
        height: newHeight,
        isMultiSelect: selectionBox.isMultiSelect
      });
      return;
    }

    // Update cursor for eraser tools
    if (cursorRef.current) {
        const isEraser = tool === 'eraser' || tool === 'highlighter-eraser';
        cursorRef.current.visible(isEraser);
        if (isEraser) {
            cursorRef.current.x(point.x);
            cursorRef.current.y(point.y);
            cursorRef.current.radius(size * 0.9);
            cursorRef.current.getLayer()?.batchDraw();
        }
    }

    // Only handle drawing if we're actually drawing and not using pan/select tools
    if (!isDrawing.current || tool === 'hand' || tool === 'select' || tool === 'text' || tool === 'fill') {
      return;
    }

    if (currentStrokeId.current) {
        const stroke = items.find(i => i.id === currentStrokeId.current) as Stroke;
        const shape = items.find(i => i.id === currentStrokeId.current && i.type === 'shape');
        
        if (tool === 'line' && shape) {
            // For line tool, only store start and end points
            updateItem(currentStrokeId.current, {
                points: [(shape as any).points![0], (shape as any).points![1], point.x, point.y]
            });
        } else if (stroke) {
            let newX = point.x;
            let newY = point.y;
            
            // Apply ruler snapping if ruler is visible and cursor is near ruler edge
            if (rulerGeometry && (tool === 'pen' || tool === 'highlighter')) {
              if (RulerUtils.isNearRulerEdge(point.x, point.y, rulerGeometry)) {
                const snapped = RulerUtils.snapToRulerEdge(point.x, point.y, rulerGeometry);
                newX = snapped.x;
                newY = snapped.y;
              }
            }
            
            // Apply Triangle45 snapping if triangle is visible and cursor is near triangle edge
            // if (triangle45Geometry && (tool === 'pen' || tool === 'highlighter')) {
            //   if (Triangle45Utils.isNearTriangleEdge(point.x, point.y, triangle45Geometry)) {
            //     const snapped = Triangle45Utils.snapToTriangleEdge(point.x, point.y, triangle45Geometry);
            //     newX = snapped.x;
            //     newY = snapped.y;
            //   }
            // }
            
            // Apply Triangle60 snapping if triangle is visible and cursor is near triangle edge
            // if (triangle60Geometry && (tool === 'pen' || tool === 'highlighter')) {
            //   if (Triangle60Utils.isNearTriangleEdge(point.x, point.y, triangle60Geometry)) {
            //     const snapped = Triangle60Utils.snapToTriangleEdge(point.x, point.y, triangle60Geometry);
            //     newX = snapped.x;
            //     newY = snapped.y;
            //   }
            // }
            
            // Check for text collision during eraser move
            if (tool === 'eraser' || tool === 'highlighter-eraser') {
              items.forEach(item => {
                if (item.type === 'text') {
                  const textRect = {
                    x: item.x,
                    y: item.y,
                    width: item.width || 200,
                    height: item.fontSize * 1.4
                  };
                  if (newX >= textRect.x && newX <= textRect.x + textRect.width &&
                      newY >= textRect.y && newY <= textRect.y + textRect.height) {
             removeItem(item.id);
                  }
                }
              });
            }
            
            updateItem(currentStrokeId.current, {
                points: [...stroke.points, newX, newY]
            });
        }
    }
  };

 const handleMouseUp = (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Reset touch scaling state
    if (touchStateRef.current.isTouchScaling) {
      touchStateRef.current.isTouchScaling = false;
      touchStateRef.current.lastTouchDistance = 0;
      return;
    }
    
    // --- PAN TOOL LOGIC ---
    if (tool === 'hand' && isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      panOriginRef.current = { x: stagePos.x, y: stagePos.y };
      return;
    }

    // Handle selection box completion
    if (selectionBox && tool === 'select') {
      const stage = stageRef.current;
      if (stage) {
        const selectedItems: string[] = [];
        const box = {
          x: Math.min(selectionBox.x, selectionBox.x + selectionBox.width),
          y: Math.min(selectionBox.y, selectionBox.y + selectionBox.height),
          width: Math.abs(selectionBox.width),
          height: Math.abs(selectionBox.height)
        };
        items.forEach(item => {
          const node = stage.findOne('#' + item.id);
          if (node) {
            const nodeRect = node.getClientRect();
            if (
              nodeRect.x < box.x + box.width &&
              nodeRect.x + nodeRect.width > box.x &&
              nodeRect.y < box.y + box.height &&
              nodeRect.y + nodeRect.height > box.y
            ) {
              selectedItems.push(item.id);
            }
          }
        });
        if (selectedItems.length > 0) {
          if (selectionBox.isMultiSelect && selectedId) {
            const currentSelected = selectedId.split(',');
            const merged = [...new Set([...currentSelected, ...selectedItems])];
            setSelectedId(merged.join(','));
          } else {
            setSelectedId(selectedItems.join(','));
          }
        }
      }
      setSelectionBox(null);
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastEraserPosRef.current = null;

    saveHistory();
    const strokeId = currentStrokeId.current;
    if (!strokeId) return;

    if (tool === 'handwriting' && isHandwritingActive.current) {
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current);
      }
      handwritingTimerRef.current = setTimeout(() => {
        if (isHandwritingActive.current) {
          processHandwritingStrokes();
        }
      }, 1500);
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
      // DO NOT scale fontSize - preserve layout-driven behavior
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
    if (qModeActive) return { cursor: 'move' };
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



  // Q-key transform mode state
  const [qModeActive, setQModeActive] = useState(false);
  const qTransformRef = useRef({
    isTransforming: false,
    targetId: '',
    startPos: { x: 0, y: 0 },
    startItemPos: { x: 0, y: 0 },
    startItemSize: { width: 0, height: 0 },
    mode: 'move' // 'move', 'resize', 'resize-center'
  });

  // Q-key event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') {
        if (!qModeActive) {
          setQModeActive(true);
          document.body.style.userSelect = 'none';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') {
        setQModeActive(false);
        qTransformRef.current.isTransforming = false;
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [qModeActive]);

  // Q-mode mouse handlers
  const handleQMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>, itemId: string) => {
    if (!qModeActive) return;
    
    e.evt.preventDefault();
    e.evt.stopPropagation();
    
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;
    
    // Determine transform mode based on modifier keys
    let mode = 'move';
    if (e.evt.shiftKey && e.evt.altKey) mode = 'resize-center';
    else if (e.evt.shiftKey) mode = 'resize';
    else if (e.evt.altKey) mode = 'resize-center';
    
    qTransformRef.current = {
      isTransforming: true,
      targetId: itemId,
      startPos: { x: pos.x, y: pos.y },
      startItemPos: { x: (item as any).x || 0, y: (item as any).y || 0 },
      startItemSize: { 
        width: (item as any).width || (item.type === 'text' ? 100 : 50), 
        height: (item as any).height || (item.type === 'text' ? 50 : 50) 
      },
      mode
    };
  }, [qModeActive, items]);

  const handleQMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!qModeActive || !qTransformRef.current.isTransforming) return;
    
    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;
    
    const { targetId, startPos, startItemPos, startItemSize, mode } = qTransformRef.current;
    const deltaX = pos.x - startPos.x;
    const deltaY = pos.y - startPos.y;
    
    const item = items.find(i => i.id === targetId);
    if (!item) return;
    
    // Handle text items separately - DOM container resize only
    if (item.type === 'text' && (mode === 'resize' || mode === 'resize-center')) {
      const container = document.querySelector('[data-text-editor]') as HTMLElement;
      if (container) {
        const minWidth = 300;
        const minHeight = 200;
        
        let newWidth = startItemSize.width;
        let newHeight = startItemSize.height;
        
        if (mode === 'resize') {
          newWidth = Math.max(minWidth, startItemSize.width + deltaX);
          newHeight = Math.max(minHeight, startItemSize.height + deltaY);
        } else if (mode === 'resize-center') {
          const scale = Math.max(0.1, 1 + deltaX / startItemSize.width);
          newWidth = Math.max(minWidth, startItemSize.width * scale);
          newHeight = Math.max(minHeight, startItemSize.height * scale);
        }
        
        // Update DOM container dimensions
        container.style.width = newWidth + 'px';
        container.style.height = newHeight + 'px';
        
        // Force text layout recalculation (Premiere Pro-style)
        const editableDiv = container.querySelector('[contenteditable]') as HTMLElement;
        if (editableDiv) {
          // Force reflow by changing container width temporarily
          const tempWidth = container.style.width;
          container.style.width = (newWidth - 1) + 'px';
          container.offsetWidth; // Force layout
          container.style.width = tempWidth;
        }
      }
      return; // Exit early - no updateItem() for text resize
    }
    
    // Handle all other items (including text move)
    const updatePayload: any = {};
    
    if (mode === 'move') {
      updatePayload.x = startItemPos.x + deltaX;
      updatePayload.y = startItemPos.y + deltaY;
    } else {
      // For non-text items: normal scaling
      if (mode === 'resize') {
        const scaleX = Math.max(0.1, 1 + deltaX / startItemSize.width);
        const scaleY = Math.max(0.1, 1 + deltaY / startItemSize.height);
        updatePayload.width = Math.max(10, startItemSize.width * scaleX);
        updatePayload.height = Math.max(10, startItemSize.height * scaleY);
      } else if (mode === 'resize-center') {
        const scale = Math.max(0.1, 1 + deltaX / startItemSize.width);
        updatePayload.width = Math.max(10, startItemSize.width * scale);
        updatePayload.height = Math.max(10, startItemSize.height * scale);
        updatePayload.x = startItemPos.x - (updatePayload.width - startItemSize.width) / 2;
        updatePayload.y = startItemPos.y - (updatePayload.height - startItemSize.height) / 2;
      }
    }
    
    if (Object.keys(updatePayload).length > 0) {
      updateItem(targetId, updatePayload);
    }
  }, [qModeActive, updateItem, items]);

  const handleQMouseUp = useCallback(() => {
    if (qTransformRef.current.isTransforming) {
      qTransformRef.current.isTransforming = false;
      saveHistory();
    }
  }, [saveHistory]);

  // Persistent resize state (outside startTextEditing to prevent recreation)
  const textResizeStateRef = useRef({
    isResizing: false,
    direction: '',
    startData: { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 },
    isDragging: false
  });

  // Global resize handlers (persistent, attached once)
  const handleTextResizeMove = useCallback((e: MouseEvent) => {
    if (!textResizeStateRef.current.isResizing) return;
    
    const { startData, direction } = textResizeStateRef.current;
    const deltaX = e.clientX - startData.x;
    const deltaY = e.clientY - startData.y;
    
    let newWidth = startData.width;
    let newHeight = startData.height;
    let newLeft = startData.left;
    let newTop = startData.top;
    
    const minWidth = 300;
    const minHeight = 200;
    
    if (direction.includes('e')) {
      newWidth = Math.max(minWidth, startData.width + deltaX);
    }
    if (direction.includes('w')) {
      const proposedWidth = startData.width - deltaX;
      if (proposedWidth >= minWidth) {
        newWidth = proposedWidth;
        newLeft = startData.left + deltaX;
      }
    }
    if (direction.includes('s')) {
      newHeight = Math.max(minHeight, startData.height + deltaY);
    }
    if (direction.includes('n')) {
      const proposedHeight = startData.height - deltaY;
      if (proposedHeight >= minHeight) {
        newHeight = proposedHeight;
        newTop = startData.top + deltaY;
      }
    }
    
    const container = document.querySelector('[data-text-editor]') as HTMLElement;
    if (container) {
      container.style.width = newWidth + 'px';
      container.style.height = newHeight + 'px';
      container.style.left = newLeft + 'px';
      container.style.top = newTop + 'px';
      
      // Force text layout recalculation (Premiere Pro-style)
      const editableDiv = container.querySelector('[contenteditable]') as HTMLElement;
      if (editableDiv) {
        // Force reflow by changing container width temporarily
        const tempWidth = container.style.width;
        container.style.width = (newWidth - 1) + 'px';
        container.offsetWidth; // Force layout
        container.style.width = tempWidth;
      }
    }
  }, []);

  const handleTextResizeEnd = useCallback(() => {
    if (!textResizeStateRef.current.isResizing) return;
    textResizeStateRef.current.isResizing = false;
    textResizeStateRef.current.direction = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach global listeners once
  useEffect(() => {
    document.addEventListener('mousemove', handleTextResizeMove);
    document.addEventListener('mouseup', handleTextResizeEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleTextResizeMove);
      document.removeEventListener('mouseup', handleTextResizeEnd);
    };
  }, [handleTextResizeMove, handleTextResizeEnd]);
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
    container.style.left = '50%';
    container.style.top = '50%';
    container.style.transform = 'translate(-50%, -190%)';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.width = `${Math.max(350, (textItem as any).width || 350)}px`; // Use existing width or default
    container.style.height = '250px';
    container.style.resize = 'both';
    container.style.overflow = 'hidden';
    container.style.background = '#fff';
    container.style.border = '2px solid #0099ff';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    container.style.position = 'relative';
    
    // Create resize handles (using persistent state)
    const createResizeHandle = (position: string, cursor: string) => {
      const handle = document.createElement('div');
      handle.style.position = 'absolute';
      handle.style.width = '10px';
      handle.style.height = '10px';
      handle.style.background = '#0099ff';
      handle.style.cursor = cursor;
      handle.style.zIndex = '1001';
      handle.style.borderRadius = '2px';
      
      switch(position) {
        case 'nw': handle.style.top = '-5px'; handle.style.left = '-5px'; break;
        case 'ne': handle.style.top = '-5px'; handle.style.right = '-5px'; break;
        case 'sw': handle.style.bottom = '-5px'; handle.style.left = '-5px'; break;
        case 'se': handle.style.bottom = '-5px'; handle.style.right = '-5px'; break;
        case 'n': handle.style.top = '-5px'; handle.style.left = '50%'; handle.style.transform = 'translateX(-50%)'; handle.style.width = '20px'; handle.style.height = '5px'; break;
        case 's': handle.style.bottom = '-5px'; handle.style.left = '50%'; handle.style.transform = 'translateX(-50%)'; handle.style.width = '20px'; handle.style.height = '5px'; break;
        case 'w': handle.style.left = '-5px'; handle.style.top = '50%'; handle.style.transform = 'translateY(-50%)'; handle.style.width = '5px'; handle.style.height = '20px'; break;
        case 'e': handle.style.right = '-5px'; handle.style.top = '50%'; handle.style.transform = 'translateY(-50%)'; handle.style.width = '5px'; handle.style.height = '20px'; break;
      }
      
      handle.onmousedown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Use persistent state
        textResizeStateRef.current.isResizing = true;
        textResizeStateRef.current.direction = position;
        const rect = container.getBoundingClientRect();
        textResizeStateRef.current.startData = {
          x: e.clientX,
          y: e.clientY,
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top
        };
        
        document.body.style.userSelect = 'none';
      };
      
      return handle;
    };
    container.appendChild(createResizeHandle('nw', 'nw-resize'));
    container.appendChild(createResizeHandle('ne', 'ne-resize'));
    container.appendChild(createResizeHandle('sw', 'sw-resize'));
    container.appendChild(createResizeHandle('se', 'se-resize'));
    container.appendChild(createResizeHandle('n', 'n-resize'));
    container.appendChild(createResizeHandle('s', 's-resize'));
    container.appendChild(createResizeHandle('w', 'w-resize'));
    container.appendChild(createResizeHandle('e', 'e-resize'));

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    toolbar.style.background = '#f8f9fa';
    toolbar.style.padding = '8px';
    toolbar.style.borderBottom = '1px solid #dee2e6';
    toolbar.style.cursor = 'move';
    toolbar.style.flexWrap = 'wrap';
    
    // Make toolbar draggable with mutual exclusion from resizing
    toolbar.onmousedown = (e) => {
      // Only allow dragging if not resizing and clicking on toolbar elements
      if (!textResizeStateRef.current.isResizing && (e.target === toolbar || (e.target as HTMLElement).parentElement === toolbar)) {
        textResizeStateRef.current.isDragging = true;
        const rect = container.getBoundingClientRect();
        const dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        e.preventDefault();
        
        document.body.style.userSelect = 'none';
        
        const handleDragMove = (e: MouseEvent) => {
          if (textResizeStateRef.current.isDragging && !textResizeStateRef.current.isResizing) {
            container.style.left = `${e.clientX - dragOffset.x}px`;
            container.style.top = `${e.clientY - dragOffset.y}px`;
          }
        };
        
        const handleDragEnd = () => {
          textResizeStateRef.current.isDragging = false;
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', handleDragMove);
          document.removeEventListener('mouseup', handleDragEnd);
        };
        
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
      }
    };

    // Helper function to apply formatting to selected text
    const applyFormatToSelection = (command: string) => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        // Save the current range
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        // Apply formatting using execCommand
        document.execCommand('styleWithCSS', false, 'true');
        const success = document.execCommand(command, false);
        
        // If execCommand failed, use manual DOM manipulation
        if (!success && selectedText) {
          const span = document.createElement('span');
          if (command === 'bold') span.style.fontWeight = 'bold';
          if (command === 'italic') span.style.fontStyle = 'italic';
          if (command === 'underline') span.style.textDecoration = 'underline';
          
          try {
            range.surroundContents(span);
          } catch (e) {
            span.innerHTML = selectedText;
            range.deleteContents();
            range.insertNode(span);
          }
          
          // Restore selection
          selection.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          selection.addRange(newRange);
        }
      }
      // Always refocus the editor
      setTimeout(() => editableDiv.focus(), 0);
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
        // Change color of selected text only
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, colorPicker.value);
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
    
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = 'Save';
    saveBtn.style.padding = '4px 12px';
    saveBtn.style.border = '1px solid #dee2e6';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.background = '#28a745';
    saveBtn.style.color = 'white';
    saveBtn.style.fontSize = '12px';
    saveBtn.style.fontWeight = '600';
    saveBtn.style.marginLeft = 'auto';
    saveBtn.title = 'Save and close';
    saveBtn.onmousedown = (e) => e.preventDefault();
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      finishEditing();
    };
    toolbar.appendChild(saveBtn);

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
    editableDiv.style.maxHeight = 'none'; // Allow unlimited height
    editableDiv.style.overflowY = 'auto';
    editableDiv.style.overflowX = 'hidden'; // Prevent horizontal scroll
    editableDiv.style.padding = '12px';
    editableDiv.style.lineHeight = '1.4';
    editableDiv.style.overflowWrap = 'break-word';
    editableDiv.style.whiteSpace = 'normal';
    editableDiv.style.wordBreak = 'normal';
    editableDiv.style.width = '100%';
    editableDiv.style.height = '100%';
    editableDiv.style.boxSizing = 'border-box';
    editableDiv.style.userSelect = 'text';
    editableDiv.style.webkitUserSelect = 'text';
    editableDiv.style.flex = '1'; // Take remaining space
    
    // Prevent resize handles from interfering with text editing
    editableDiv.addEventListener('pointerdown', (e) => {
      // Allow text editing only if not resizing
      if (textResizeStateRef.current.isResizing) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
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
      
      // Get the current container position and size
      const rect = container.getBoundingClientRect();
      const stageRect = stageRef.current?.container().getBoundingClientRect();
      
      let canvasX = textItem.x;
      let canvasY = textItem.y;
      
      // If we have stage reference, calculate proper canvas coordinates
      if (stageRect) {
        canvasX = (rect.left - stageRect.left - stagePos.x) / stageScale;
        canvasY = (rect.top - stageRect.top - stagePos.y) / stageScale;
      }
      
      updateItem(textId, {
        text: newText,
        width: container.offsetWidth, // Keep the stretched container width
        x: canvasX,
        y: canvasY
      });
      
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      
      // Clean up local event listeners only
      cleanupEventListeners();
      
      // Reset persistent state
      textResizeStateRef.current.isResizing = false;
      textResizeStateRef.current.isDragging = false;
      
      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      
      setEditingTextId(null);
      setSelectedId(textId);
      saveHistory();
    };
    
    // Close editor when clicking outside (with proper cleanup)
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isCanvasClick = target.tagName === 'CANVAS' || target.closest('canvas');
      if (!container.contains(target) && !textResizeStateRef.current.isDragging && !textResizeStateRef.current.isResizing && !isCanvasClick) {
        finishEditing();
      }
    };
    
    const cleanupEventListeners = () => {
      document.removeEventListener('click', handleClickOutside);
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    // Handle keyboard shortcuts
    editableDiv.addEventListener('keydown', (e) => {
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
    
    // Handle paste to ensure proper text wrapping
    editableDiv.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      if (text) {
        document.execCommand('insertText', false, text);
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
    startTextEditing(textId);
  };

  const handleCanvasDoubleClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Handle double-click on existing text items only
    if (tool === 'text' || tool === 'select') {
      const stage = e.target.getStage();
      const clickedOnEmpty = e.target === stage;
      
      if (!clickedOnEmpty) {
        // Double-click on existing text to edit
        const targetId = e.target.id() || e.target.getParent()?.id();
        if (targetId) {
          const item = items.find(i => i.id === targetId);
          if (item?.type === 'text') {
            // Ensure the text item stays selected when double-clicking
            const currentSelected = selectedId ? selectedId.split(',') : [];
            if (!currentSelected.includes(targetId)) {
              setSelectedId(targetId);
            }
            startTextEditing(targetId);
          }
        }
      }
    }
  };

  // Expose functions globally for toolbar access
  useEffect(() => {
    (window as any).startTextEditing = startTextEditing;
    (window as any).addChromeWidget = () => {
      const newWidget = {
        id: uuidv4(),
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        locked: false
      };
      setChromeWidgets(prev => [...prev, newWidget]);
    };
    return () => {
      delete (window as any).startTextEditing;
      delete (window as any).addChromeWidget;
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
      
      // Handle multiple selected items
      if (selectedId && selectedId.includes(',')) {
        const selectedIds = selectedId.split(',');
        selectedIds.forEach(id => {
          const selectedItem = items.find(i => i.id === id);
          if (!selectedItem) return;
          
          if (selectedItem.type === 'text' || selectedItem.type === 'image' || selectedItem.type === 'group' || (selectedItem.type === 'shape' && selectedItem.shapeType !== 'line' && selectedItem.shapeType !== 'polygon')) {
            updateItem(id, { 
              x: ((selectedItem as any).x || 0) + dx, 
              y: ((selectedItem as any).y || 0) + dy 
            });
          } else if (selectedItem.type === 'stroke' || (selectedItem.type === 'shape' && (selectedItem.shapeType === 'line' || selectedItem.shapeType === 'polygon'))) {
            const newPoints = (selectedItem.points || []).map((p: number, i: number) => 
              i % 2 === 0 ? p + dx : p + dy
            );
            updateItem(id, { points: newPoints });
          }
        });
      } else if (item.type === 'group') {
        // Handle group item movement - move all items in the group
        updateItem(item.id, { x: node.x(), y: node.y() });
        
        // Move all items in the group
        item.items?.forEach((childItem: WhiteboardItem) => {
          if (childItem.type === 'text' || childItem.type === 'image' || (childItem.type === 'shape' && childItem.shapeType !== 'line' && childItem.shapeType !== 'polygon')) {
            updateItem(childItem.id, { 
              x: ((childItem as any).x || 0) + dx, 
              y: ((childItem as any).y || 0) + dy 
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
          onClick={() => {
            if (tool === 'select') {
              const currentSelected = selectedId ? selectedId.split(',') : [];
              
              if (currentSelected.includes(item.id)) {
                const newSelected = currentSelected.filter(id => id !== item.id);
                setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
              } else {
                setSelectedId([...currentSelected, item.id].join(','));
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

      // For formatted text, render invisible interaction rectangle
      const hasFormatting = /<(b|strong|i|em|u|span)/.test(item.text);
      if (hasFormatting) {
        // Calculate dynamic height based on text content and wrapping
        const plainText = item.text.replace(/<[^>]*>/g, '');
        const lineCount = Math.max(1, item.text.split('\n').length);
        const charCount = plainText.length;
        const avgCharsPerLine = Math.floor((item.width || 200) / (item.fontSize * 0.6));
        const wrappedLines = Math.ceil(charCount / avgCharsPerLine);
        const totalLines = Math.max(lineCount, wrappedLines);
        const textHeight = item.fontSize * 1.4 * totalLines;
        
        return (
          <Rect
            key={item.id}
            id={item.id}
            x={item.x}
            y={item.y}
            width={item.width || 200}
            height={textHeight}
            fill="transparent"
            listening={tool === 'select' || tool === 'text'}
            draggable={tool === 'select' || tool === 'text'}
            onClick={() => {
              if (tool === 'select' || tool === 'text') {
                const currentSelected = selectedId ? selectedId.split(',') : [];
                
                if (currentSelected.includes(item.id)) {
                  const newSelected = currentSelected.filter(id => id !== item.id);
                  setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                } else {
                  setSelectedId([...currentSelected, item.id].join(','));
                }
              }
            }}
            onTap={() => {
              if (tool === 'select' || tool === 'text') {
                const currentSelected = selectedId ? selectedId.split(',') : [];
                if (!currentSelected.includes(item.id)) {
                  setSelectedId([...currentSelected, item.id].join(','));
                }
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

      return (
        <RichText
          key={item.id}
          id={item.id}
          x={item.x}
          y={item.y}
          text={item.text} // Keep HTML formatting
          fontSize={item.fontSize}
          fontFamily={item.fontFamily}
          fill={item.fill}
          width={item.width} // Use stretched width
          draggable={tool === 'select' || tool === 'text'}
          onClick={() => {
            if (tool === 'select' || tool === 'text') {
              const currentSelected = selectedId ? selectedId.split(',') : [];
              
              if (currentSelected.includes(item.id)) {
                const newSelected = currentSelected.filter(id => id !== item.id);
                setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
              } else {
                setSelectedId([...currentSelected, item.id].join(','));
              }
            }
          }}
          onTap={() => {
            if (tool === 'select' || tool === 'text') {
              const currentSelected = selectedId ? selectedId.split(',') : [];
              if (!currentSelected.includes(item.id)) {
                setSelectedId([...currentSelected, item.id].join(','));
              }
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
      onClick: qModeActive ? () => {} : (_e: any) => {
        if (tool === 'select' || tool === 'text') {
          const currentSelected = selectedId ? selectedId.split(',') : [];
          
          if (currentSelected.includes(item.id)) {
            const newSelected = currentSelected.filter(id => id !== item.id);
            setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
          } else {
            setSelectedId([...currentSelected, item.id].join(','));
          }
        }
      },
      onMouseDown: qModeActive ? (_e: any) => handleQMouseDown(_e, item.id) : undefined,
      onTap: () => {
        if (tool === 'select' || tool === 'text') {
          const currentSelected = selectedId ? selectedId.split(',') : [];
          if (!currentSelected.includes(item.id)) {
            setSelectedId([...currentSelected, item.id].join(','));
          }
        }
      },
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
          listening={true}
          points={item.points}
          stroke={item.color}
          strokeWidth={isEraser ? item.size * 2 + 10 : item.size}
          tension={0}
          lineCap="round"
          lineJoin="round"
          opacity={isHandwriting ? 0.9 : 1} 
          globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'}
          perfectDrawEnabled={false}
          hitStrokeWidth={isEraser ? item.size * 2 + 20 : Math.max(10, item.size + 5)}
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
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
      onTouchStart={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
    >

      {/* Chrome Widgets - Render BEFORE Stage */}
      {chromeWidgets.map((widget) => (
        <React.Fragment key={widget.id}>
          <ChromeWidget
            x={widget.x}
            y={widget.y}
            locked={widget.locked}
            onClose={() => setChromeWidgets(prev => prev.filter(w => w.id !== widget.id))}
            onMove={(x, y) => setChromeWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, x, y } : w))}
            onToggleLock={() => setChromeWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, locked: !w.locked } : w))}
          />
          {/* Floating Unlock Button when locked */}
          {widget.locked && (
            <div
              style={{
                position: 'absolute',
                left: widget.x + 790,
                top: widget.y + 20,
                zIndex: 60,
                pointerEvents: 'auto'
              }}
            >
              <button
                onClick={() => setChromeWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, locked: false } : w))}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              >
                Unlock
              </button>
            </div>
          )}
        </React.Fragment>
      ))}

      {/* Stage Wrapper with higher z-index */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, touchAction: 'none' }}>
        <Stage
          ref={stageRef}
          style={{ background: 'transparent', zIndex: 10 }}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={qModeActive ? (e) => e.evt.preventDefault() : handleMouseDown}
          onMouseMove={qModeActive ? handleQMouseMove : handleMouseMove}
          onMouseUp={qModeActive ? handleQMouseUp : handleMouseUp}
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
          draggable={false}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
        >
          <Layer>
            {/* 1. Render Images at the bottom */}
            {items.map((item) => {
              if (item.type !== 'image') return null;
              const commonProps = {
                key: item.id,
                id: item.id,
                draggable: tool === 'select',
                onClick: () => {
                  if (tool === 'select') {
                    const currentSelected = selectedId ? selectedId.split(',') : [];
                    if (currentSelected.includes(item.id)) {
                      // Deselect if already selected
                      const newSelected = currentSelected.filter(id => id !== item.id);
                      setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                    } else {
                      // Add to selection
                      setSelectedId([...currentSelected, item.id].join(','));
                    }
                  }
                },
                onTap: () => {
                  if (tool === 'select') {
                    const currentSelected = selectedId ? selectedId.split(',') : [];
                    if (currentSelected.includes(item.id)) {
                      // Deselect if already selected
                      const newSelected = currentSelected.filter(id => id !== item.id);
                      setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                    } else {
                      // Add to selection
                      setSelectedId([...currentSelected, item.id].join(','));
                    }
                  }
                },
                onTransformEnd: (e: any) => handleTransformEnd(e, item)
              };
              return <URLImage {...commonProps} image={item} />;
            })}
          </Layer>
          
          <Layer>
            {/* 2. Render Highlighters and Highlighter-specific Eraser */}
            {items.map((item) => {
              if (item.type !== 'stroke') return null;
              if (item.isHighlighter) {
                if ((item as any)._hidden) return null;
                return (
                  <Line 
                    key={item.id + '-hl'} 
                    id={item.id}
                    draggable={tool === 'select'}
                    onClick={() => {
                      if (tool === 'select') {
                        const currentSelected = selectedId ? selectedId.split(',') : [];
                        
                        if (currentSelected.includes(item.id)) {
                          const newSelected = currentSelected.filter(id => id !== item.id);
                          setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                        } else {
                          setSelectedId([...currentSelected, item.id].join(','));
                        }
                      }
                    }}
                    onTap={() => {
                      if (tool === 'select') {
                        const currentSelected = selectedId ? selectedId.split(',') : [];
                        if (currentSelected.includes(item.id)) {
                          // Deselect if already selected
                          const newSelected = currentSelected.filter(id => id !== item.id);
                          setSelectedId(newSelected.length > 0 ? newSelected.join(',') : null);
                        } else {
                          // Add to selection
                          setSelectedId([...currentSelected, item.id].join(','));
                        }
                      }
                    }}
                    onTransformEnd={(e: any) => handleTransformEnd(e, item)}
                    onDragStart={handleItemDragStart}
                    onDragMove={handleItemDragMove}
                    onDragEnd={(e: any) => handleItemDragEnd(e, item)}
                    points={item.points} 
                    stroke={item.color} 
                    strokeWidth={item.size} 
                    tension={0} 
                    lineCap="round" 
                    lineJoin="round" 
                    opacity={0.4} 
                    globalCompositeOperation="source-over" 
                    perfectDrawEnabled={false}
                    hitStrokeWidth={Math.max(10, item.size + 5)}
                  />
                );
              }
              if (item.tool === 'highlighter-eraser') {
                 return (
                  <Line 
                    key={item.id + '-hl-eraser'} 
                    id={item.id}
                    points={item.points} 
                    stroke="#000000" 
                    strokeWidth={item.size * 2 + 10} 
                    tension={0} 
                    lineCap="round" 
                    lineJoin="round" 
                    globalCompositeOperation="destination-out" 
                    perfectDrawEnabled={false}
                  />
                 );
              }
              return null;
            })}
          </Layer>

          <Layer>
            {/* 3. Render everything else (Pen, Shapes, Text, Eraser) */}
            {items.map((item) => {
              if (item.type === 'image') return null;
              if (item.type === 'stroke' && (item.isHighlighter || item.tool === 'highlighter-eraser')) return null;
              return renderLayer3Item(item);
            })}
            
            {selectionBox && <Rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.width} height={selectionBox.height} stroke="#0099ff" strokeWidth={1} dash={[5, 5]} />}
            <Line ref={previewLineRef} listening={false} tension={0} lineCap="round" lineJoin="round" stroke={color} strokeWidth={(tool === 'eraser' || tool === 'highlighter-eraser') ? size * 2 + 10 : size} visible={false} />
            <Circle ref={cursorRef} listening={false} radius={size * 0.5} stroke="#ff1493" strokeWidth={2.5} fill="rgba(255, 20, 147, 0.15)" visible={tool === 'eraser' || tool === 'highlighter-eraser'} opacity={1} />
            <Transformer 
              ref={transformerRef} 
              onDragEnd={() => {
                if (selectedId && selectedId.includes(',')) {
                  saveHistory();
                }
              }}
            />
          </Layer>
        </Stage>
        
        {/* HTML overlay for formatted text */}
        {items.map((item) => {
          if (item.type !== 'text' || editingTextId === item.id) return null;
          
          const hasFormatting = /<(b|strong|i|em|u|span)/.test(item.text);
          if (!hasFormatting) return null;
          
          // Calculate dynamic height based on text content and wrapping
          const plainText = item.text.replace(/<[^>]*>/g, '');
          const lineCount = Math.max(1, item.text.split('\n').length);
          const charCount = plainText.length;
          const avgCharsPerLine = Math.floor((item.width || 200) / (item.fontSize * 0.6));
          const wrappedLines = Math.ceil(charCount / avgCharsPerLine);
          const totalLines = Math.max(lineCount, wrappedLines);
          const textHeight = item.fontSize * 1.4 * totalLines;
          
          // Calculate screen position accounting for zoom and pan
          const screenX = item.x * stageScale + stagePos.x;
          const screenY = item.y * stageScale + stagePos.y;
          
          return (
            <div
              key={`overlay-${item.id}`}
              style={{
                position: 'fixed',
                left: screenX,
                top: screenY,
                width: (item.width || 200) * stageScale,
                height: textHeight * stageScale,
                fontSize: item.fontSize * stageScale,
                fontFamily: item.fontFamily,
                color: item.fill,
                lineHeight: 1.4,
                pointerEvents: 'none',
                overflow: 'visible',
                wordWrap: 'break-word',
                zIndex: tool === 'hand' ? -1 : 20,
                userSelect: 'none',
                touchAction: 'none'
              }}
              dangerouslySetInnerHTML={{ __html: item.text }}
            />
          );
        })}
      </div>

      {/* Geometry Tools */}
      {showProtractor && <Protractor />}
      {showDivider && <Divider />}

      {/* Multi-selection drag overlay */}
      {selectedId && selectedId.includes(',') && (() => {
        const selectedIds = selectedId.split(',');
        const stage = stageRef.current;
        if (!stage) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedIds.forEach(id => {
          const node = stage.findOne('#' + id);
          if (node) {
            const rect = node.getClientRect();
            // Convert to screen coordinates
            const screenMinX = rect.x * stageScale + stagePos.x;
            const screenMinY = rect.y * stageScale + stagePos.y;
            const screenMaxX = (rect.x + rect.width) * stageScale + stagePos.x;
            const screenMaxY = (rect.y + rect.height) * stageScale + stagePos.y;
            
            minX = Math.min(minX, screenMinX);
            minY = Math.min(minY, screenMinY);
            maxX = Math.max(maxX, screenMaxX);
            maxY = Math.max(maxY, screenMaxY);
          }
        });
        
        const dragHandler = (e: React.MouseEvent | React.TouchEvent) => {
          e.preventDefault();
          const stageRect = stage.container().getBoundingClientRect();
          const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
          const startX = (clientX - stageRect.left - stagePos.x) / stageScale;
          const startY = (clientY - stageRect.top - stagePos.y) / stageScale;
          const initialItems = selectedIds.map(id => {
            const item = items.find(i => i.id === id);
            return item ? JSON.parse(JSON.stringify(item)) : null;
          }).filter(Boolean);
          
          let animationId: number;
          const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const currentX = (clientX - stageRect.left - stagePos.x) / stageScale;
            const currentY = (clientY - stageRect.top - stagePos.y) / stageScale;
            const dx = currentX - startX;
            const dy = currentY - startY;
            
            cancelAnimationFrame(animationId);
            animationId = requestAnimationFrame(() => {
              initialItems.forEach((initialItem: any) => {
                if (initialItem.type === 'text' || initialItem.type === 'image' || initialItem.type === 'group' || (initialItem.type === 'shape' && initialItem.shapeType !== 'line' && initialItem.shapeType !== 'polygon')) {
                  updateItem(initialItem.id, { 
                    x: initialItem.x + dx, 
                    y: initialItem.y + dy 
                  });
                } else if (initialItem.type === 'stroke' || (initialItem.type === 'shape' && (initialItem.shapeType === 'line' || initialItem.shapeType === 'polygon'))) {
                  const newPoints = initialItem.points.map((p: number, i: number) => 
                    i % 2 === 0 ? p + dx : p + dy
                  );
                  updateItem(initialItem.id, { points: newPoints });
                }
              });
            });
          };
          
          const handleUp = () => {
            cancelAnimationFrame(animationId);
            saveHistory();
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleUp);
          };
          
          document.addEventListener('mousemove', handleMove);
          document.addEventListener('mouseup', handleUp);
          document.addEventListener('touchmove', handleMove);
          document.addEventListener('touchend', handleUp);
        };
        
        return (
          <div
            onMouseDown={dragHandler}
            onTouchStart={dragHandler}
            style={{
              position: 'fixed',
              left: minX + 'px',
              top: minY + 'px',
              width: (maxX - minX) + 'px',
              height: (maxY - minY) + 'px',
              cursor: 'grab',
              zIndex: 999,
              pointerEvents: 'auto'
            }}
            onMouseDownCapture={(e) => e.currentTarget.style.cursor = 'grabbing'}
            onMouseUpCapture={(e) => e.currentTarget.style.cursor = 'grab'}
          />
        );
      })()}

    </div>
  );
};





