import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { useTouchAndMouse } from '../../hooks/useTouchAndMouse'
import { Minus } from 'lucide-react'

const CM_IN_PX = 37.8

const Triangle45: React.FC = () => {
  const { tool, setShowTriangle45, setTool } = useWhiteboardStore()
  const triangleRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 250, y: 250 })
  const [rotation, setRotation] = useState(-225) // Default -225° rotation
  const [size, setSize] = useState(320)
  const [isDarkTheme, setIsDarkTheme] = useState(false)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)

  const startRef = useRef({ x: 0, y: 0, size: 0, rotation: 0, mouseAngle: 0 })
  const [ticks, setTicks] = useState<number[]>([])
  const { getPointerEvent } = useTouchAndMouse()

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  const themeColors = {
    light: {
      triangleBg: 'bg-[#05FF29]/10',
      triangleBorder: 'border-black',
      tickColor: 'bg-gray-900',
      textColor: 'text-gray-900',
      angleTextColor: 'text-black',
      closeBtn: 'bg-gray-800 hover:bg-gray-900 border-gray-700 text-white',
      resizeHandle: 'bg-gray-900/80',
      rotateBtn: 'bg-gray-900 hover:bg-gray-800 text-white',
      angleBadge: 'bg-gray-900/90 text-white',
      squareCorner: 'border-black',
      arcStroke: 'black',
      toggleBtn: 'bg-gray-800 hover:bg-gray-900 border-gray-700 text-white'
    },
    dark: {
      triangleBg: 'bg-white/20',
      triangleBorder: 'border-white/30',
      tickColor: 'bg-white/60',
      textColor: 'text-white/80',
      angleTextColor: 'text-white',
      closeBtn: 'bg-white/20 hover:bg-white/30 border-white/30 text-white',
      resizeHandle: 'bg-white/40',
      rotateBtn: 'bg-white/20 hover:bg-white/30 border-white/30 text-white',
      angleBadge: 'bg-white/20 border-white/30 text-white',
      squareCorner: 'border-white',
      arcStroke: 'white',
      toggleBtn: 'bg-white/20 hover:bg-white/30 border-white/30 text-white'
    }
  }

  const colors = isDarkTheme ? themeColors.dark : themeColors.light

  /* --------- Generate scale --------- */
  useEffect(() => {
    const totalCm = Math.floor(size / CM_IN_PX)
    setTicks(Array.from({ length: totalCm * 10 + 1 }, (_, i) => i))
  }, [size])

  // Disable back navigation when triangle is active
  useEffect(() => {
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

  /* --------- Drag --------- */
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Check if pan or select tool is active - don't interfere
    if (tool === 'hand' || tool === 'select') {
      return; // Let whiteboard handle the event
    }
    
    const pointer = getPointerEvent(e)
    setDragging(true)
    startRef.current.x = pointer.clientX - position.x
    startRef.current.y = pointer.clientY - position.y
  }

  /* --------- Resize --------- */
  const onResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setResizing(true)
    startRef.current.size = size
    startRef.current.x = pointer.clientX
  }

  /* --------- Rotate --------- */
  const onRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setRotating(true)

    const rect = triangleRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    startRef.current.mouseAngle =
      Math.atan2(pointer.clientY - cy, pointer.clientX - cx) * (180 / Math.PI)

    startRef.current.rotation = rotation
  }

  /* --------- Mouse Move --------- */
  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    if (dragging) {
      setPosition({
        x: pointer.clientX - startRef.current.x,
        y: pointer.clientY - startRef.current.y
      })
    }

    if (resizing) {
      const delta = pointer.clientX - startRef.current.x
      setSize(Math.max(200, Math.min(700, startRef.current.size + delta)))
    }

    if (rotating) {
      const rect = triangleRef.current!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const currentMouseAngle =
        Math.atan2(pointer.clientY - cy, pointer.clientX - cx) * (180 / Math.PI)

      const deltaAngle = currentMouseAngle - startRef.current.mouseAngle

      const newRotation = startRef.current.rotation + deltaAngle
      setRotation(newRotation)
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  // Calculate display rotation - offset by -225 to show 0° initially
  const displayRotation = (((rotation + 225) % 360) + 360) % 360

  const tickHeight = (i: number) => (i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 7)

  return (
    <div
      className='fixed inset-0 z-50'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      onTouchMove={onMouseMove}
      onTouchEnd={stopAll}
      style={{
        pointerEvents: dragging || resizing || rotating ? 'auto' : 'none'
      }}
    >
      <div
        ref={triangleRef}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        style={{
          left: position.x,
          top: position.y,
          width: size,
          height: size,
          transform: `rotate(${rotation}deg)`,
          pointerEvents: tool === 'hand' || tool === 'select' ? 'none' : 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Triangle body */}
        <div
          className={`relative w-full h-full 
             ${colors.triangleBg} 
             backdrop-blur-sm 
             border-[2.5px] ${colors.triangleBorder} 
             shadow-2xl`}
          style={{
            clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
          }}
        >
          {/* Base scale */}
          {ticks.map(i => (
            <div
              key={`base-${i}`}
              className={`absolute bottom-0 ${colors.tickColor}`}
              style={{
                left: `${(i * CM_IN_PX) / 10}px`,
                width: '1px',
                height: tickHeight(i)
              }}
            />
          ))}
          {/* Height scale */}
          {ticks.map(i => (
            <div
              key={`height-${i}`}
              className={`absolute left-0 ${colors.tickColor}`}
              style={{
                bottom: `${(i * CM_IN_PX) / 10}px`,
                height: '1px',
                width: tickHeight(i)
              }}
            />
          ))}
          {/* CM Numbers (base) - Horizontal Edge (Bottom) */}
          {ticks
            .filter(i => i % 10 === 0 && i !== 0)
            .map(i => (
              <span
                key={`num-base-${i}`}
                className={`absolute bottom-6 text-xs font-bold ${colors.textColor} origin-center`}
                style={{
                  left: `${(i * CM_IN_PX) / 10}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                {i / 10}
              </span>
            ))}
          <span className={`absolute bottom-6 left-2 text-[10px] font-bold ${colors.textColor}`}>cm</span>

          {/* CM Numbers (height) - Vertical Edge (Left) */}
          {ticks
            .filter(i => i % 10 === 0 && i !== 0 && (i * CM_IN_PX) / 10 <= size)
            .map(i => (
              <span
                key={`num-height-${i}`}
                className={`absolute left-6 text-xs font-bold ${colors.textColor} origin-center`}
                style={{
                  bottom: `${(i * CM_IN_PX) / 10}px`,
                  transform: 'translateY(50%) rotate(-90deg)'
                }}
              >
                {i / 10}
              </span>
            ))}
          <span
            className={`absolute left-6 text-[10px] font-bold ${colors.textColor} origin-center`}
            style={{ bottom: '10px', transform: 'rotate(-90deg)' }}
          >
            cm
          </span>

          {/* Angle badge - Show display rotation (0° initially) - Rotated 90° anticlockwise */}
          <div
            className={`absolute left-16 top-[220px] ${colors.angleBadge} px-3 py-1 rounded-lg text-sm font-bold shadow-lg`}
            style={{ transform: 'rotate(-90deg) translateX(-50%)' }}
          >
            {Math.round(displayRotation)}°
          </div>

          {/* Angle markings with arcs */}
          <svg className='absolute inset-0 pointer-events-none' width='100%' height='100%' style={{ overflow: 'visible' }}>
            {/* 45° arc at top */}
            <path
              d='M 15 0 A 20 13 0 0 1 0 23'
              fill='none'
              stroke={colors.arcStroke}
              strokeWidth='2.5'
            />
            {/* 45° arc at bottom-right */}
            <path
              d={`M ${size - 25} ${size} A 25 25 0 0 1 ${size} ${size - 29}`}
              fill='none'
              stroke={colors.arcStroke}
              strokeWidth='2.5'
            />
          </svg>
          {/* 45° at top */}
          <div className={`absolute left-2 top-6 text-sm font-bold ${colors.angleTextColor}`}>
            45°
          </div>
          {/* 90° at bottom-left corner */}
          <div className={`absolute left-0 bottom-0 w-6 h-6 border-t-[3px] border-r-[3px] ${colors.squareCorner}`} />
          <div className={`absolute left-10 bottom-10 text-lg font-bold ${colors.angleTextColor}`}>
            90°
          </div>
          {/* 45° at bottom-right */}
          <div className={`absolute right-6 bottom-2 text-sm font-bold ${colors.angleTextColor}`}>
            45°
          </div>
          {/* Close */}
          <button
            onClick={() => setShowTriangle45(false)}
            className={`absolute left-16 top-24 w-7 h-7 rounded-full ${colors.closeBtn} flex items-center justify-center shadow-md hover:scale-110 active:scale-95`}
          >
            ×
          </button>
          
          {/* Line Tool Button */}
          <button
            onClick={() => setTool(tool === 'line' ? 'pen' : 'line')}
            className={`absolute left-16 top-36 w-7 h-7 rounded-full ${
              tool === 'line' 
                ? 'bg-blue-500 hover:bg-blue-600 border-blue-500 text-white' 
                : colors.closeBtn
            } flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-colors`}
            title={tool === 'line' ? 'Switch to Pen Tool' : 'Straight Line Tool'}
          >
            <Minus size={14} />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`absolute left-[65px] top-[190px] w-7 h-7 rounded-full ${colors.toggleBtn} flex items-center justify-center shadow-md hover:scale-110 active:scale-95`}
            title={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDarkTheme ? (
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <circle cx='12' cy='12' r='4' />
                <line x1='12' y1='2' x2='12' y2='4' />
                <line x1='12' y1='20' x2='12' y2='22' />
                <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
                <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
                <line x1='2' y1='12' x2='4' y2='12' />
                <line x1='20' y1='12' x2='22' y2='12' />
                <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
                <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
              </svg>
            ) : (
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
              </svg>
            )}
          </button>
          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className={`absolute right-32 bottom-14 w-14 h-4 ${colors.resizeHandle} cursor-ew-resize rounded shadow-inner`}
            title='Resize'
          />
          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            onTouchStart={onRotateStart}
            className={`absolute right-20 bottom-12 w-8 h-8 rounded-full ${colors.rotateBtn} flex items-center justify-center cursor-pointer shadow-lg`}
            title='Rotate'
          >
            ⟳
          </div>
        </div>
      </div>
    </div>
  )
}

export default Triangle45
