import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const Protractor: React.FC = () => {
  const { setShowProtractor } = useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  // -- Window/Tool State --
  const [position, setPosition] = useState({ x: 300, y: 300 })
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState(400) // Width of the base

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

  /* ================= TOOL TRANSFORM HANDLERS ================= */

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking the main body (background) and not controls
    if ((e.target as Element).closest('.protractor-control')) return
    e.preventDefault() // Prevent text selection
    e.stopPropagation()
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
      initialSize: 0,
      initialRotation: 0
    }
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    dragStart.current = {
      ...dragStart.current,
      x: e.clientX,
      initialSize: size
    }
  }

  const handleRotateStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsRotating(true)
    // Pivot is stable at position + size/2
    const cx = position.x + size / 2
    const cy = position.y + size / 2
    const currentAngle =
      Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
    dragStart.current = {
      ...dragStart.current,
      initialRotation: rotation - currentAngle
    }
  }

  /* ================= ARM INTERACTION HANDLERS ================= */

  const handleArmMouseDown = (e: React.MouseEvent, armIndex: 1 | 2) => {
    e.preventDefault() // Important to stop browser drag/select behavior
    e.stopPropagation()
    setDraggingArm(armIndex)
    lastAngleUpdate.current = Date.now()
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
    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Use requestAnimationFrame for smooth updates
      animationFrameRef.current = requestAnimationFrame(() => {
        if (isDragging) {
          setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
          })
        } else if (isResizing) {
          const delta = e.clientX - dragStart.current.x
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
          const angle =
            Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
          setRotation(angle + dragStart.current.initialRotation)
        } else if (draggingArm) {
          // Throttle angle updates to reduce jitter
          const now = Date.now()
          if (now - lastAngleUpdate.current < 16) {
            // ~60fps
            return
          }
          lastAngleUpdate.current = now

          const newAngle = calculateAngle(e.clientX, e.clientY)

          if (draggingArm === 1) {
            setAngle1(newAngle)
          } else {
            setAngle2(newAngle)
          }
        }
      })
    }

    const handleMouseUp = () => {
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

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
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
          stroke={isMajor ? '#000' : '#666'}
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
            fill='#333'
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
          fill='#DC2626'
          transform={`rotate(${90 - i} ${pText.x} ${pText.y})`}
        >
          {val}
        </text>
      )
    }

    return ticks
  }, [rOuter])

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
            fill='rgba(5, 255, 41, 0.1)'
            stroke='#000'
            strokeWidth='2.5'
            className='backdrop-blur-sm'
          />

          {/* Scales */}
          {renderTicks}

          {/* Pivot Point */}
          <circle cx={size / 2} cy={size / 2} r={5} fill='#000' />

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
            stroke='#FFF'
            strokeWidth='2'
          />
        </svg>

        {/* Live Angle Display Box */}
        <div className='absolute left-1/2 bottom-2 -translate-x-1/2 bg-gray-900/90 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg pointer-events-none'>
          {displayAngle}°
        </div>
      </div>

      {/* Controls */}

      {/* Close Button */}
      <button
        className='absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-gray-900 border border-gray-700 protractor-control pointer-events-auto'
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setShowProtractor(false)
        }}
      >
        ×
      </button>

      {/* Resize Handle */}
      <div
        className='absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-8 h-8 bg-gray-800/80 border-2 border-gray-700 rounded-full cursor-se-resize flex items-center justify-center shadow-lg protractor-control pointer-events-auto hover:bg-gray-900'
        onMouseDown={handleResizeStart}
      >
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke='white'
          strokeWidth='3'
        >
          <path d='M15 3h6v6M9 21H3v-6' />
        </svg>
      </div>

      {/* Rotate Handle */}
      <div
        className='absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-gray-800/80 border-2 border-gray-700 rounded-full cursor-move flex items-center justify-center shadow-lg protractor-control pointer-events-auto hover:bg-gray-900'
        onMouseDown={handleRotateStart}
      >
        <svg
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='white'
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
