import React, { useRef, useState, useCallback } from 'react';
import { useWhiteboardStore } from '../../store/useWhiteboardStore';
import {LockKeyhole,  LockKeyholeOpen } from 'lucide-react';
import { polarToCartesian, distance, angleBetween } from '../../utils/mathUtils';
import { v4 as uuidv4 } from 'uuid';

interface DividerState {
  centerX: number;
  centerY: number;
  radius: number;
  angle: number;
  isLocked: boolean;
  isDragging: boolean;
  isDrawing: boolean;
  dragType: 'body' | 'pencil' | null;
}

const Divider: React.FC = () => {
  const { addItem, updateItem, saveHistory, color, size, showDivider, setShowDivider } =
    useWhiteboardStore();

  const stateRef = useRef<DividerState>({
    centerX: 300,
    centerY: 200,
    radius: 100,
    angle: 0,
    isLocked: false,
    isDragging: false,
    isDrawing: false,
    dragType: null
  });

  const [, forceUpdate] = useState({});
  const currentDrawingId = useRef<string | null>(null);
  const drawingPoints = useRef<number[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const update = useCallback(() => forceUpdate({}), []);

  const getPencilPosition = useCallback(() => {
    const state = stateRef.current;
    return polarToCartesian(
      state.centerX,
      state.centerY,
      state.radius,
      state.angle
    );
  }, []);

  /* ============================
     YOUR LOGIC — UNCHANGED
     ============================ */

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, type: 'body' | 'pencil') => {
      e.preventDefault();
      e.stopPropagation();
      const state = stateRef.current;

      if (type === 'pencil' && !state.isLocked) {
        state.dragType = 'pencil';
      } else if (type === 'body') {
        state.dragType = 'body';
      } else if (type === 'pencil' && state.isLocked) {
        state.isDrawing = true;
        currentDrawingId.current = uuidv4();
        drawingPoints.current = [];

        const p = getPencilPosition();
        drawingPoints.current.push(p.x, p.y);

        addItem({
          type: 'stroke',
          id: currentDrawingId.current,
          tool: 'pen',
          points: [...drawingPoints.current],
          color,
          size
        });
      }

      state.isDragging = true;
      update();
    },
    [update, addItem, color, size, getPencilPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const state = stateRef.current;
      if (!state.isDragging && !state.isDrawing) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      if (state.dragType === 'body') {
        state.centerX = mouseX;
        state.centerY = mouseY;
      } else if (state.dragType === 'pencil' && !state.isLocked) {
        state.radius = Math.max(
          20,
          Math.min(300, distance(state.centerX, state.centerY, mouseX, mouseY))
        );
        state.angle = angleBetween(
          state.centerX,
          state.centerY,
          mouseX,
          mouseY
        );
      } else if (state.isDrawing && state.isLocked) {
        const newAngle = angleBetween(
          state.centerX,
          state.centerY,
          mouseX,
          mouseY
        );
        if (Math.abs(newAngle - state.angle) > 0.05) {
          state.angle = newAngle;
          const p = polarToCartesian(
            state.centerX,
            state.centerY,
            state.radius,
            state.angle
          );
          drawingPoints.current.push(p.x, p.y);

          updateItem(currentDrawingId.current!, {
            points: [...drawingPoints.current]
          });
        }
      }

      update();
    },
    [update, updateItem]
  );

  const handleMouseUp = useCallback(() => {
    const state = stateRef.current;
    state.isDragging = false;
    state.dragType = null;

    if (state.isDrawing) {
      state.isDrawing = false;
      saveHistory();
      currentDrawingId.current = null;
      drawingPoints.current = [];
    }

    update();
  }, [update, saveHistory]);

  const toggleLock = useCallback((e?: React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    stateRef.current.isLocked = !stateRef.current.isLocked;
    update();
  }, [update]);

  const closeDivider = useCallback((e?: React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowDivider(false);
  }, [setShowDivider]);

  React.useEffect(() => {
    if (!showDivider) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMouseMove(e);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [showDivider, handleMouseMove, handleMouseUp]);

  if (!showDivider) return null;

  const state = stateRef.current;
  const pencilPos = getPencilPosition();

  /* ============================
     UI — REALISTIC COMPASS DESIGN
     ============================ */

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <svg ref={svgRef} className="w-full h-full pointer-events-auto">

        {/* TOP ADJUSTMENT SCREW */}
        <circle
          cx={state.centerX}
          cy={state.centerY - 65}
          r="8"
          fill="#9CA3AF"
          stroke="#6B7280"
          strokeWidth="1"
        />
        <rect
          x={state.centerX - 6}
          y={state.centerY - 67}
          width="12"
          height="4"
          fill="#6B7280"
        />

        {/* MAIN BODY - DARKER AND MORE REALISTIC */}
        <ellipse
          cx={state.centerX}
          cy={state.centerY - 25}
          rx="35"
          ry="45"
          fill="#374151"
          stroke="#1F2937"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => handleMouseDown(e, 'body')}
          onTouchStart={(e) => handleMouseDown(e, 'body')}
        />

        {/* BLUE CIRCULAR DISPLAY */}
        <circle
          cx={state.centerX}
          cy={state.centerY - 25}
          r="20"
          fill="#2563EB"
          stroke="#1D4ED8"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => handleMouseDown(e, 'body')}
          onTouchStart={(e) => handleMouseDown(e, 'body')}
        />

        {/* COMPASS ICON IN DISPLAY */}
        <g fill="white">
          <path
            d={`M ${state.centerX - 8} ${state.centerY - 25} 
                A 8 8 0 1 1 ${state.centerX + 8} ${state.centerY - 25}
                A 8 8 0 1 1 ${state.centerX - 8} ${state.centerY - 25}`}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          />
          <polygon
            points={`${state.centerX},${state.centerY - 33} ${state.centerX - 3},${state.centerY - 25} ${state.centerX + 3},${state.centerY - 25}`}
            fill="white"
          />
        </g>

        {/* LEFT LEG - NEEDLE */}
        <defs>
          <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9CA3AF" />
            <stop offset="50%" stopColor="#D1D5DB" />
            <stop offset="100%" stopColor="#6B7280" />
          </linearGradient>
        </defs>
        
        <line
          x1={state.centerX - 0}
          y1={state.centerY + 15}
          x2={state.centerX - 25}
          y2={state.centerY + 180}
          stroke="url(#metalGradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* NEEDLE POINT */}
        <polygon
          points={`${state.centerX - 25},${state.centerY + 190} ${state.centerX - 21},${state.centerY + 175} ${state.centerX - 29},${state.centerY + 175}`}
          fill="#374151"
        />

        {/* RIGHT LEG - PENCIL ARM */}
        <line
          x1={state.centerX + 5}
          y1={state.centerY + 15}
          x2={pencilPos.x}
          y2={pencilPos.y - 25}
          stroke="url(#metalGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-grab'}
        />

        {/* LOCK CONTROL - PURPLE CIRCLE */}
        <circle
          cx={pencilPos.x - 25}
          cy={pencilPos.y - 60}
          r="15"
          fill="#7C3AED"
          stroke="#5B21B6"
          strokeWidth="2"
          onClick={toggleLock}
          onTouchStart={toggleLock}
          className="cursor-pointer"
        />
        
        {/* LOCK ICON */}
        {state.isLocked ? (
          <g onClick={toggleLock} onTouchStart={toggleLock} className="cursor-pointer">
            <rect
              x={pencilPos.x - 30}
              y={pencilPos.y - 63}
              width="10"
              height="8"
              rx="1"
              fill="white"
            />
            <path
              d={`M ${pencilPos.x - 28} ${pencilPos.y - 62} v -3 a 3 3 0 0 1 6 0 v 3`}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        ) : (
          <g onClick={toggleLock} onTouchStart={toggleLock} className="cursor-pointer">
            <rect
              x={pencilPos.x - 30}
              y={pencilPos.y - 63}
              width="10"
              height="8"
              rx="1"
              fill="white"
            />
            <path
              d={`M ${pencilPos.x - 23} ${pencilPos.y - 63} v -3 a 3 3 0 0 1 6 0`}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* PENCIL HOLDER */}
        <ellipse
          cx={pencilPos.x}
          cy={pencilPos.y - 35}
          rx="12"
          ry="18"
          fill="#6B7280"
          stroke="#4B5563"
          strokeWidth="2"
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-grab'}
        />

        {/* PENCIL */}
        <rect
          x={pencilPos.x - 3}
          y={pencilPos.y - 17}
          width="6"
          height="25"
          fill="#FBBF24"
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-grab'}
        />
        
        {/* PENCIL TIP */}
        <polygon
          points={`${pencilPos.x},${pencilPos.y + 12} ${pencilPos.x - 3},${pencilPos.y + 8} ${pencilPos.x + 3},${pencilPos.y + 8}`}
          fill="#1F2937"
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-grab'}
        />

        {/* CLOSE BUTTON */}
        <circle
          cx={state.centerX}
          cy={state.centerY}
          r="8"
          fill="#DC2626"
          stroke="#991B1B"
          strokeWidth="1"
          onClick={closeDivider}
          onTouchStart={closeDivider}
          className="cursor-pointer"
        />
        <text
          x={state.centerX}
          y={state.centerY + 2}
          textAnchor="middle"
          fontSize="10"
          fill="white"
          className="cursor-pointer select-none"
          onClick={closeDivider}
          onTouchStart={closeDivider}
        >
          ✕
        </text>

      </svg>
    </div>
  );
};

export default Divider;
