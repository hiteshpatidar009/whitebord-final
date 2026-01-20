import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { useTouchAndMouse } from '../../hooks/useTouchAndMouse'

const Protractor: React.FC = () => {
  const { setShowProtractor, addItem, color, saveHistory } =
    useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  // -- Window/Tool State --
  const [position, setPosition] = useState({ x: 300, y: 300 })
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState(400) // Width of the base
  const [isDarkTheme, setIsDarkTheme] = useState(false) // Theme toggle state

  // -- Interaction State --
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  // -- Measurement Arms State --
  // Angles in degrees, 0 is pointing right (3 o'clock), 90 is up, 180 is left.
  const [angle1, setAngle1] = useState(45)
  const [angle2, setAngle2] = useState(135)
  const [draggingArm, setDraggingArm] = useState<1 | 2 | null>(null)

  const dragStart = useRef({ x: 0, y: 0, initialSize: 0, initialRotation: 0 })
  const lastAngleUpdate = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const { getPointerEvent } = useTouchAndMouse()
  const drawingPoints = useRef<{ [key: number]: number[] }>({ 1: [], 2: [] })
  const currentStrokeId = useRef<{ [key: number]: string | null }>({
    1: null,
    2: null
  })

  /* ---------------- Theme Toggle ---------------- */
  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  /* ================= TOOL TRANSFORM HANDLERS ================= */

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as Element).closest('.protractor-control')) return
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setIsDragging(true)
    dragStart.current = {
      x: pointer.clientX - position.x,
      y: pointer.clientY - position.y,
      initialSize: 0,
      initialRotation: 0
    }
  }

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setIsResizing(true)
    dragStart.current = {
      ...dragStart.current,
      x: pointer.clientX,
      initialSize: size
    }
  }

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setIsRotating(true)
    const cx = position.x + size / 2
    const cy = position.y + size / 2
    const currentAngle =
      Math.atan2(pointer.clientY - cy, pointer.clientX - cx) * (180 / Math.PI)
    dragStart.current = {
      ...dragStart.current,
      initialRotation: rotation - currentAngle
    }
  }

  /* ================= ARM INTERACTION HANDLERS ================= */

  const handleArmMouseDown = (
    e: React.MouseEvent | React.TouchEvent,
    armIndex: 1 | 2
  ) => {
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setDraggingArm(armIndex)
    lastAngleUpdate.current = Date.now()

    // Initialize drawing
    const id = `protractor-${armIndex}-${Date.now()}`
    currentStrokeId.current[armIndex] = id
    drawingPoints.current[armIndex] = []

    // Get current arm tip position in screen coordinates
    const cx = position.x + size / 2
    const cy = position.y + size / 2
    const currentAngle = armIndex === 1 ? angle1 : angle2
    const rad = (currentAngle * Math.PI) / 180
    const rotRad = (rotation * Math.PI) / 180
    const armLen = rOuter + 40

    const localX = armLen * Math.cos(-rad)
    const localY = armLen * Math.sin(-rad)
    const screenX = cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
    const screenY = cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)

    drawingPoints.current[armIndex].push(screenX, screenY)
  }

  /* ================= CALCULATE ANGLE FOR ARM ================= */

  const calculateAngle = (clientX: number, clientY: number): number => {
    const cx = position.x + size / 2
    const cy = position.y + size / 2

    // Calculate vector from pivot to mouse
    const dx = clientX - cx
    const dy = clientY - cy

    // Rotate vector by -rotation to align with protractor
    const rad = -rotation * (Math.PI / 180)
    const localDx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const localDy = dx * Math.sin(rad) + dy * Math.cos(rad)

    // Calculate angle with smoothing
    let deg = Math.atan2(-localDy, localDx) * (180 / Math.PI)
    if (deg < 0) deg += 360

    // Clamp to protractor range (0-180)
    if (deg > 180) {
      // If dragging below, snap to nearest side with some hysteresis
      if (deg > 270) deg = 0
      else deg = 180
    }

    // Apply rounding to reduce jitter
    return Math.round(deg / 0.5) * 0.5 // Round to nearest 0.5 degree
  }

  /* ================= GLOBAL MOUSE HANDLERS ================= */

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const touch = 'touches' in e ? e.touches[0] : null
      const clientX = touch ? touch.clientX : (e as MouseEvent).clientX
      const clientY = touch ? touch.clientY : (e as MouseEvent).clientY
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Use requestAnimationFrame for smooth updates
      animationFrameRef.current = requestAnimationFrame(() => {
        if (isDragging) {
          setPosition({
            x: clientX - dragStart.current.x,
            y: clientY - dragStart.current.y
          })
        } else if (isResizing) {
          const delta = clientX - dragStart.current.x
          // Limit size
          const newSize = Math.max(
            200,
            Math.min(800, dragStart.current.initialSize + delta * 2)
          )
          setSize(newSize)
        } else if (isRotating) {
          // Pivot is stable at position + size/2
          const cx = position.x + size / 2
          const cy = position.y + size / 2
          const angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI)
          setRotation(angle + dragStart.current.initialRotation)
        } else if (draggingArm) {
          // Throttle angle updates to reduce jitter
          const now = Date.now()
          if (now - lastAngleUpdate.current < 16) {
            // ~60fps
            return
          }
          lastAngleUpdate.current = now

          const newAngle = calculateAngle(clientX, clientY)

          if (draggingArm === 1) {
            setAngle1(newAngle)
          } else {
            setAngle2(newAngle)
          }

          // Add drawing point
          const cx = position.x + size / 2
          const cy = position.y + size / 2
          const rad = (newAngle * Math.PI) / 180
          const rotRad = (rotation * Math.PI) / 180
          const armLen = rOuter + 40

          const localX = armLen * Math.cos(-rad)
          const localY = armLen * Math.sin(-rad)
          const screenX =
            cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
          const screenY =
            cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)

          drawingPoints.current[draggingArm].push(screenX, screenY)

          if (
            currentStrokeId.current[draggingArm] &&
            drawingPoints.current[draggingArm].length >= 4
          ) {
            const armColor = draggingArm === 1 ? '#2563EB' : '#DC2626'
            addItem({
              type: 'stroke',
              id: currentStrokeId.current[draggingArm]!,
              tool: 'pen',
              points: [...drawingPoints.current[draggingArm]],
              color: armColor,
              size: 2,
              isEraser: false,
              isHighlighter: true
            })
          }
        }
      })
    }

    const handleMouseUp = () => {
      if (
        draggingArm &&
        currentStrokeId.current[draggingArm] &&
        drawingPoints.current[draggingArm].length >= 4
      ) {
        saveHistory()
      }
      setIsDragging(false)
      setIsResizing(false)
      setIsRotating(false)
      setDraggingArm(null)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [
    isDragging,
    isResizing,
    isRotating,
    draggingArm,
    size,
    rotation,
    position
  ])

  // -- Rendering Helpers --

  // Radius calculations
  const rOuter = size / 2

  // Convert degrees to SVG coordinates (0 at right, 180 at left, counter-clockwise)
  const pivotX = size / 2
  const pivotY = size / 2

  const degToSvg = (deg: number, radius: number) => {
    const rad = (deg * Math.PI) / 180
    return {
      x: pivotX + radius * Math.cos(-rad),
      y: pivotY + radius * Math.sin(-rad)
    }
  }

  // Generate ticks with memoization to prevent unnecessary re-renders
  const renderTicks = React.useMemo(() => {
    const ticks = []
    // Outer scale 0 to 180
    for (let i = 0; i <= 180; i++) {
      const isMajor = i % 10 === 0
      const isMid = i % 5 === 0
      const len = isMajor ? 15 : isMid ? 10 : 5
      const rStart = rOuter - 5
      const rEnd = rStart - len

      const p1 = degToSvg(i, rStart)
      const p2 = degToSvg(i, rEnd)

      ticks.push(
        <line
          key={`tick-${i}`}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={
            isMajor
              ? isDarkTheme
                ? '#fff'
                : '#000'
              : isDarkTheme
              ? '#aaa'
              : '#666'
          }
          strokeWidth={isMajor ? 1.5 : 1}
        />
      )

      // Labels for Outer (0-180 increasing CCW)
      if (isMajor) {
        const pText = degToSvg(i, rEnd - 12)
        ticks.push(
          <text
            key={`label-outer-${i}`}
            x={pText.x}
            y={pText.y}
            fontSize={10}
            fontWeight='600'
            textAnchor='middle'
            dominantBaseline='middle'
            fill={isDarkTheme ? '#fff' : '#333'}
            transform={`rotate(${90 - i} ${pText.x} ${pText.y})`}
          >
            {i}
          </text>
        )
      }
    }

    // Inner scale
    const innerRadius = rOuter - 50
    for (let i = 0; i <= 180; i += 10) {
      const val = 180 - i
      const pText = degToSvg(i, innerRadius)
      ticks.push(
        <text
          key={`label-inner-${i}`}
          x={pText.x}
          y={pText.y}
          fontSize={9}
          textAnchor='middle'
          dominantBaseline='middle'
          fill={isDarkTheme ? '#ff9999' : '#DC2626'}
          transform={`rotate(${90 - i} ${pText.x} ${pText.y})`}
        >
          {val}
        </text>
      )
    }

    return ticks
  }, [rOuter, isDarkTheme])

  const armLength = rOuter + 40 // Extend beyond the protractor body
  const pArm1 = degToSvg(angle1, armLength)
  const pArm2 = degToSvg(angle2, armLength)

  const angleDiff = Math.abs(angle1 - angle2)
  const displayAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff

  return (
    <div
      ref={ref}
      className='fixed z-[1000] select-none'
      style={{
        left: position.x,
        top: position.y,
        width: size,
        height: size / 2,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'bottom center',
        pointerEvents: 'none'
      }}
    >
      {/* Main Body */}
      <div
        className='absolute inset-0 cursor-grab active:cursor-grabbing'
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        style={{ pointerEvents: 'auto' }}
      >
        <svg
          width='100%'
          height='100%'
          viewBox={`0 0 ${size} ${size / 2}`}
          style={{ overflow: 'visible' }}
        >
          {/* Background Glass Semicircle */}
          <path
            d={`M 0,${size / 2} A ${size / 2},${size / 2} 0 0,1 ${size},${
              size / 2
            } Z`}
            fill={
              isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(5, 255, 41, 0.1)'
            }
            stroke={isDarkTheme ? '#fff' : '#000'}
            strokeWidth='2.5'
            className='backdrop-blur-sm'
          />

          {/* Scales */}
          {renderTicks}

          {/* Pivot Point */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={5}
            fill={isDarkTheme ? '#fff' : '#000'}
          />

          {/* Arm 1 (Blue) */}
          <line
            x1={size / 2}
            y1={size / 2}
            x2={pArm1.x}
            y2={pArm1.y}
            stroke='#2563EB'
            strokeWidth='3'
            strokeLinecap='round'
          />
          {/* Arm 1 Handle - Reduced hover effect to prevent visual noise */}
          <circle
            cx={pArm1.x}
            cy={pArm1.y}
            r={10}
            fill='#2563EB'
            className='cursor-pointer protractor-control transition-opacity duration-100'
            onMouseDown={e => handleArmMouseDown(e, 1)}
            onTouchStart={e => handleArmMouseDown(e, 1)}
            stroke='#FFF'
            strokeWidth='2'
          />

          {/* Arm 2 (Red) */}
          <line
            x1={size / 2}
            y1={size / 2}
            x2={pArm2.x}
            y2={pArm2.y}
            stroke='#DC2626'
            strokeWidth='3'
            strokeLinecap='round'
          />
          {/* Arm 2 Handle - Reduced hover effect to prevent visual noise */}
          <circle
            cx={pArm2.x}
            cy={pArm2.y}
            r={10}
            fill='#DC2626'
            className='cursor-pointer protractor-control transition-opacity duration-100'
            onMouseDown={e => handleArmMouseDown(e, 2)}
            onTouchStart={e => handleArmMouseDown(e, 2)}
            stroke='#FFF'
            strokeWidth='2'
          />
        </svg>

        {/* Live Angle Display Box */}
        <div
          className={`absolute left-1/2 bottom-2 -translate-x-1/2 ${
            isDarkTheme ? 'bg-white/20' : 'bg-gray-900/90'
          } ${
            isDarkTheme ? 'text-white' : 'text-white'
          } px-3 py-1 rounded-full text-sm font-bold shadow-lg pointer-events-none`}
        >
          {displayAngle}°
        </div>
      </div>

      {/* Controls */}

      {/* Close Button */}
      <button
        className={`absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full ${
          isDarkTheme
            ? 'bg-white/20 hover:bg-white/30 border-white/30'
            : 'bg-gray-800 hover:bg-gray-900 border-gray-700'
        } text-white flex items-center justify-center shadow-lg border protractor-control pointer-events-auto`}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setShowProtractor(false)
        }}
      >
        ×
      </button>

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className={`absolute -top-4 left-[calc(50%+50px)] -translate-x-1/2 w-8 h-8 rounded-full 
          ${isDarkTheme ? 'bg-white/20' : 'bg-gray-900/80'} backdrop-blur-sm
          border ${isDarkTheme ? 'border-white/30' : 'border-black'}
          ${isDarkTheme ? 'text-white' : 'text-white'} text-sm font-bold
          flex items-center justify-center
          shadow-lg protractor-control pointer-events-auto
          ${isDarkTheme ? 'hover:bg-white/30' : 'hover:bg-gray-700'}`}
        title={
          isDarkTheme
            ? 'Switch to light theme (original)'
            : 'Switch to dark theme (glass)'
        }
      >
        {isDarkTheme ? (
          // Sun icon for dark mode (switch to light)
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
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
          // Moon icon for light mode (switch to dark)
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
          </svg>
        )}
      </button>

      {/* Resize Handle */}
      <div
        className={`absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-8 h-8 ${
          isDarkTheme
            ? 'bg-white/20 border-white/30 hover:bg-white/30'
            : 'bg-gray-800/80 border-gray-700 hover:bg-gray-900'
        } rounded-full cursor-se-resize flex items-center justify-center shadow-lg protractor-control pointer-events-auto`}
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
      >
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke={isDarkTheme ? 'currentColor' : 'white'}
          strokeWidth='3'
        >
          <path d='M15 3h6v6M9 21H3v-6' />
        </svg>
      </div>

      {/* Rotate Handle */}
      <div
        className={`absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-8 h-8 ${
          isDarkTheme
            ? 'bg-white/20 border-white/30 hover:bg-white/30'
            : 'bg-gray-800/80 border-gray-700 hover:bg-gray-900'
        } rounded-full cursor-move flex items-center justify-center shadow-lg protractor-control pointer-events-auto`}
        onMouseDown={handleRotateStart}
        onTouchStart={handleRotateStart}
      >
        <svg
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke={isDarkTheme ? 'currentColor' : 'white'}
          strokeWidth='2.5'
        >
          <path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' />
          <path d='M3 3v5h5' />
        </svg>
      </div>
    </div>
  )
}

export default Protractor
