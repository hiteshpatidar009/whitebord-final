import React, { useRef, useState, useCallback } from 'react';
import { useWhiteboardStore } from '../../store/useWhiteboardStore';
import { polarToCartesian, distance, angleBetween } from '../../utils/mathUtils';
import { v4 as uuidv4 } from 'uuid';

interface DividerState {
  centerX: number;
  centerY: number;
  radius: number;
  angle: number;
  rotation: number;
  isLocked: boolean;
  isDragging: boolean;
  isDrawing: boolean;
  isRotating: boolean;
  dragType: 'body' | 'pencil' | 'rotate' | null;
}

const Divider: React.FC = () => {
  const { addItem, updateItem, saveHistory, color, size, showDivider, setShowDivider, tool } =
    useWhiteboardStore();

  const stateRef = useRef<DividerState>({
    centerX: 300,
    centerY: 200,
    radius: 100, // Horizontal spread when unlocked
    angle: 0,
    rotation: 0,
    isLocked: false,
    isDragging: false,
    isDrawing: false,
    isRotating: false,
    dragType: null
  });

  const [, forceUpdate] = useState({});
  const currentDrawingId = useRef<string | null>(null);
  const drawingPoints = useRef<number[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const update = useCallback(() => forceUpdate({}), []);

  const getPencilPosition = useCallback(() => {
    const state = stateRef.current;
    if (!state.isLocked) {
      return {
        x: state.centerX + state.radius,
        y: state.centerY + 125
      };
    }
    return polarToCartesian(
      state.centerX,
      state.centerY,
      state.radius,
      state.angle
    );
  }, []);

  const getLeftLegPosition = useCallback(() => {
    const state = stateRef.current;
    // Left arm FIXED at center (doesn't move)
    return {
      x: state.centerX - 10, // Fixed distance from center
      y: state.centerY + 130  // Fixed position
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, type: 'body' | 'pencil' | 'rotate') => {
      e.preventDefault();
      e.stopPropagation();
      const state = stateRef.current;

      if (type === 'rotate') {
        state.dragType = 'rotate';
        state.isRotating = true;
      } else if (type === 'pencil' && !state.isLocked) {
        state.dragType = 'pencil';
      } else if (type === 'body') {
        state.dragType = 'body';
      } else if (type === 'pencil' && state.isLocked) {
        // Reset any previous drawing state
        if (state.isDrawing) {
          state.isDrawing = false;
          currentDrawingId.current = null;
          drawingPoints.current = [];
        }
        
        state.isDrawing = true;
        currentDrawingId.current = uuidv4();
        drawingPoints.current = [];

        const p = getPencilPosition();
        // Start drawing from exact pencil tip position
        drawingPoints.current.push(p.x, p.y + 15);

        addItem({
          type: 'stroke',
          id: currentDrawingId.current,
          tool: 'pen',
          points: [...drawingPoints.current],
          color,
          size,
          isEraser: false,
          isHighlighter: false
        } as any);
      }

      state.isDragging = true;
      update();
    },
    [update, addItem, color, size, getPencilPosition, tool]
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
      } else if (state.dragType === 'rotate') {
        const angle = Math.atan2(mouseY - state.centerY, mouseX - state.centerX);
        state.rotation = (angle * 180) / Math.PI;
      } else if (state.dragType === 'pencil' && !state.isLocked) {
        // When unlocked: adjust RADIUS only for right arm
        // Angle remains fixed at 0 (pointing right)
        state.angle = 0; // Always point right
        
        // Calculate horizontal distance for radius
        const newRadius = Math.max(50, Math.min(300, mouseX - state.centerX));
        state.radius = newRadius;
      } else if (state.isDrawing && state.isLocked) {
        // When locked: full circular movement for drawing
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
          // Draw from the pencil tip (15px offset)
          drawingPoints.current.push(p.x, p.y + 15);

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
    state.isRotating = false;
    state.dragType = null;

    if (state.isDrawing) {
      state.isDrawing = false;
      saveHistory();
      currentDrawingId.current = null;
      drawingPoints.current = [];
    }

    update();
  }, [update, saveHistory]);

  const toggleLock = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const state = stateRef.current;
    
    if (!state.isLocked) {
      // Transitioning from UNLOCKED to LOCKED
      // Calculate effective radius and angle based on current (x, y)
      // current x = centerX + radius, current y = centerY + 125
      const currentX = state.centerX + state.radius;
      const currentY = state.centerY + 125;
      
      state.radius = distance(state.centerX, state.centerY, currentX, currentY);
      state.angle = angleBetween(state.centerX, state.centerY, currentX, currentY);
    } else {
      // Transitioning from LOCKED to UNLOCKED
      // Calculate horizontal spread (radius) from current polar position
      const p = polarToCartesian(state.centerX, state.centerY, state.radius, state.angle);
      state.radius = Math.max(50, p.x - state.centerX);
      state.angle = 0;
    }
    
    state.isLocked = !state.isLocked;
    update();
  }, [update]);

  const closeDivider = useCallback((e?: React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowDivider(false);
  }, [setShowDivider]);

  // Disable back navigation when divider is active
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent back navigation
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Push current state back to prevent navigation
      window.history.pushState(null, '', window.location.href);
      return false;
    };

    // Add history entry to prevent back navigation
    window.history.pushState(null, '', window.location.href);
    
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('popstate', handlePopState, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('popstate', handlePopState, true);
    };
  }, []);

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
  const leftLegPos = getLeftLegPosition();

  return (
    <div className="fixed inset-0 pointer-events-none z-50" style={{ touchAction: 'none' }}>
      <svg ref={svgRef} className="w-full h-full" style={{ pointerEvents: 'none', touchAction: 'none' }}>
        <g transform={`rotate(${state.rotation} ${state.centerX} ${state.centerY})`}>

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

        {/* MAIN BODY */}
        <ellipse
          cx={state.centerX}
          cy={state.centerY - 25}
          rx="35"
          ry="45"
          fill="#374151"
          stroke="#1F2937"
          strokeWidth="2"
          className="cursor-move"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'body')}
          onTouchStart={(e) => handleMouseDown(e, 'body')}
        />

        {/* BLUE CIRCULAR DISPLAY */}
        

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

        {/* LEFT LEG - FIXED AT CENTER (DOESN'T MOVE) */}
        <defs>
          <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9CA3AF" />
            <stop offset="50%" stopColor="#D1D5DB" />
            <stop offset="100%" stopColor="#6B7280" />
          </linearGradient>
          
          <linearGradient id="fixedLegGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6B7280" />
            <stop offset="50%" stopColor="#9CA3AF" />
            <stop offset="100%" stopColor="#4B5563" />
          </linearGradient>
        </defs>
        
        {/* FIXED LEFT LEG (ALWAYS SAME POSITION) */}
        <line
          x1={state.centerX - 5}
          y1={state.centerY + 15}
          x2={leftLegPos.x}
          y2={leftLegPos.y}
          stroke="url(#fixedLegGradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* FIXED LEFT LEG POINT */}
        <polygon
          points={`${leftLegPos.x},${leftLegPos.y + 10} 
                   ${leftLegPos.x - 4},${leftLegPos.y} 
                   ${leftLegPos.x + 4},${leftLegPos.y}`}
          fill="#1F2937"
        />

        {/* RIGHT LEG - PENCIL ARM (ADJUSTABLE RADIUS) */}
        <line
          x1={state.centerX - 2}
          y1={state.centerY + 15}
          x2={pencilPos.x}
          y2={pencilPos.y - 25}
          stroke="url(#metalGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-ew-resize'}
        />

        {/* LOCK CONTROL */}
        <circle
          cx={state.centerX}
          cy={state.centerY - 25}
          r="15"
          fill={state.isLocked ? "#7C3AED" : "#10B981"}
          stroke={state.isLocked ? "#5B21B6" : "#059669"}
          strokeWidth="2"
          style={{ pointerEvents: 'auto' }}
          onClick={toggleLock}
          onTouchEnd={toggleLock}
          className="cursor-pointer"
        />
        
        {/* LOCK ICON */}
        {state.isLocked ? (
          <g onClick={toggleLock} onTouchEnd={toggleLock} className="cursor-pointer" style={{ pointerEvents: 'auto' }}>
            <rect
              x={state.centerX - 5}
              y={state.centerY - 28}
              width="10"
              height="8"
              rx="1"
              fill="white"
            />
            <path
              d={`M ${state.centerX - 3} ${state.centerY - 27} v -3 a 3 3 0 0 1 6 0 v 3`}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        ) : (
          <g onClick={toggleLock} onTouchEnd={toggleLock} className="cursor-pointer" style={{ pointerEvents: 'auto' }}>
            <rect
              x={state.centerX - 5}
              y={state.centerY - 28}
              width="10"
              height="8"
              rx="1"
              fill="white"
            />
            <path
              d={`M ${state.centerX + 2} ${state.centerY - 28} v -3 a 3 3 0 0 1 6 0`}
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
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-ew-resize'}
        />

        {/* PENCIL */}
        <rect
          x={pencilPos.x - 3}
          y={pencilPos.y - 17}
          width="6"
          height="25"
          fill="#FBBF24"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-ew-resize'}
        />
        
        {/* PENCIL TIP */}
        <polygon
          points={`${pencilPos.x},${pencilPos.y + 15} ${pencilPos.x - 3},${pencilPos.y + 8} ${pencilPos.x + 3},${pencilPos.y + 8}`}
          fill="#1F2937"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'pencil')}
          onTouchStart={(e) => handleMouseDown(e, 'pencil')}
          className={state.isLocked ? 'cursor-crosshair' : 'cursor-ew-resize'}
        />

        {/* DRAG HANDLE ICON */}
        <circle
          cx={state.centerX - 50}
          cy={state.centerY - 25}
          r="10"
          fill="#10B981"
          stroke="#059669"
          strokeWidth="2"
          className="cursor-move"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'body')}
          onTouchStart={(e) => handleMouseDown(e, 'body')}
        />
        <g fill="white" style={{ pointerEvents: 'auto' }} onMouseDown={(e) => handleMouseDown(e, 'body')} onTouchStart={(e) => handleMouseDown(e, 'body')}>
          <circle cx={state.centerX - 53} cy={state.centerY - 28} r="1" />
          <circle cx={state.centerX - 50} cy={state.centerY - 28} r="1" />
          <circle cx={state.centerX - 47} cy={state.centerY - 28} r="1" />
          <circle cx={state.centerX - 53} cy={state.centerY - 25} r="1" />
          <circle cx={state.centerX - 50} cy={state.centerY - 25} r="1" />
          <circle cx={state.centerX - 47} cy={state.centerY - 25} r="1" />
          <circle cx={state.centerX - 53} cy={state.centerY - 22} r="1" />
          <circle cx={state.centerX - 50} cy={state.centerY - 22} r="1" />
          <circle cx={state.centerX - 47} cy={state.centerY - 22} r="1" />
        </g>

        {/* ROTATION HANDLE */}
        <circle
          cx={state.centerX + 50}
          cy={state.centerY - 25}
          r="16"
          fill="rgba(31, 41, 55, 0.8)"
          stroke="#374151"
          strokeWidth="2"
          className="cursor-move"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => handleMouseDown(e, 'rotate')}
          onTouchStart={(e) => handleMouseDown(e, 'rotate')}
        />
        <g stroke="white" strokeWidth="2.5" fill="none" style={{ pointerEvents: 'auto' }} onMouseDown={(e) => handleMouseDown(e, 'rotate')} onTouchStart={(e) => handleMouseDown(e, 'rotate')}>
          <path d={`M ${state.centerX + 41} ${state.centerY - 25} a 9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L ${state.centerX + 41} ${state.centerY - 29}`} />
          <path d={`M ${state.centerX + 41} ${state.centerY - 32} v 5 h 5`} />
        </g>

        {/* CLOSE BUTTON */}
        <circle
          cx={state.centerX}
          cy={state.centerY}
          r="8"
          fill="#DC2626"
          stroke="#991B1B"
          strokeWidth="1"
          style={{ pointerEvents: 'auto' }}
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
          style={{ pointerEvents: 'auto' }}
          onClick={closeDivider}
          onTouchStart={closeDivider}
        >
          ✕
        </text>

      
        
       
        
      
       

        {/* RADIUS ADJUSTMENT GUIDE */}
       

        </g>
      </svg>
    </div>
  );
};

export default Divider;