// Divider.tsx
import React, { useRef, useState, useEffect } from 'react'
import DividerArm from './DividerArm'
import { clamp } from './dividerMath'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { v4 as uuidv4 } from 'uuid'

const Divider: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null)
  const { addItem, updateItem, color, saveHistory } = useWhiteboardStore()

  // Mechanical State
  const [position, setPosition] = useState({ x: 500, y: 300 })
  const [rotation, setRotation] = useState(0) // Base rotation (Left Leg)
  const [spread, setSpread] = useState(45)   // Angle between legs
  const [length, setLength] = useState(200)

  // Interaction State
  const [dragging, setDragging] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [extending, setExtending] = useState(false)
  const [drawing, setDrawing] = useState(false)

  // Refs for smooth interaction
  const start = useRef({
    x: 0,
    y: 0,
    rotation: 0,
    spread: 0,
    length: 0,
    centerX: 0,
    centerY: 0,
    startAngle: 0
  })

  // Exact center calculation using DOM
  const getExactCenter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      // The pivot is the center of the top handle (w-10 h-10 => +20 offset)
      return {
        x: rect.left + 20,
        y: rect.top + 20
      }
    }
    // Fallback if needed
    return { x: position.x + 20, y: position.y + 20 }
  }

  const drawingPoints = useRef<number[]>([])
  const currentStrokeId = useRef<string | null>(null)
  const lastPointTime = useRef<number>(0)
  const isStrokeCreated = useRef<boolean>(false)

  /* ---------- Drag Whole Tool ---------- */
  const onDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    start.current.x = e.clientX - position.x
    start.current.y = e.clientY - position.y
  }

  /* ---------- Rotate (Top Handle) ---------- */
  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.button === 0 && setRotating(true)

    const center = getExactCenter()
    start.current.centerX = center.x
    start.current.centerY = center.y
    start.current.rotation = rotation

    // Calculate initial angle of mouse relative to center
    const dx = e.clientX - center.x
    const dy = e.clientY - center.y
    start.current.startAngle = Math.atan2(dx, dy) * (180 / Math.PI)
  }

  /* ---------- Extend Length ---------- */
  const onExtendStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.button === 0 && setExtending(true)
    start.current.length = length
    start.current.centerY = e.clientY
  }

  /* ---------- Draw / Spread (Right Tip) ---------- */
  const onDrawStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault() // Prevent text selection

    if (e.button !== 0) return

    setDrawing(true)
    isStrokeCreated.current = false

    const center = getExactCenter()
    start.current.centerX = center.x
    start.current.centerY = center.y
    start.current.spread = spread
    start.current.rotation = rotation

    // Calculate initial angle of mouse to correctly offset spread
    const dx = e.clientX - center.x
    const dy = e.clientY - center.y
    // Angle from +Y axis (down)
    start.current.startAngle = Math.atan2(dx, dy) * (180 / Math.PI)

    // Init Stroke
    const id = uuidv4()
    currentStrokeId.current = id
    drawingPoints.current = []

    // Record first point exactly at tip
    // Left Arm transform: rotate(rotation)
    // Right Arm transform: rotate(rotation + spread)
    const tipAngle = (rotation + spread) * (Math.PI / 180)

    const tipX = center.x + Math.sin(tipAngle) * (length)
    const tipY = center.y + Math.cos(tipAngle) * (length)

    drawingPoints.current.push(tipX, tipY)
    lastPointTime.current = Date.now()
  }

  const onMouseMove = (e: React.MouseEvent) => {
    // 1. Rotation
    if (rotating) {
      const dx = e.clientX - start.current.centerX
      const dy = e.clientY - start.current.centerY
      const currentAngle = Math.atan2(dx, dy) * (180 / Math.PI)

      const delta = currentAngle - start.current.startAngle
      setRotation(start.current.rotation + delta)
    }

    // 2. Extending
    if (extending) {
      const delta = e.clientY - start.current.centerY
      setLength(clamp(start.current.length + delta, 100, 300))
    }

    // 3. Drawing (Changing Spread)
    if (drawing) {
      const dx = e.clientX - start.current.centerX
      const dy = e.clientY - start.current.centerY

      // Calculate angle of the *mouse* relative to pivot
      const mouseAngleGlobal = Math.atan2(dx, dy) * (180 / Math.PI)

      // Spread = Global Angle - Rotation
      // We use the FIXED rotation from start to ensure tool doesn't drift
      const newSpread = mouseAngleGlobal - rotation

      setSpread(newSpread)

      // --- Drawing Logic ---
      const now = Date.now()
      if (now - lastPointTime.current > 16) {
        // Calculate Exact Tip Position
        // Must match the Visual Rotation: rotation + newSpread
        const tipAngle = (rotation + newSpread) * (Math.PI / 180)

        // Use the center from start to avoid jitter
        const tipX = start.current.centerX + Math.sin(tipAngle) * length
        const tipY = start.current.centerY + Math.cos(tipAngle) * length

        drawingPoints.current.push(tipX, tipY)
        lastPointTime.current = now

        if (currentStrokeId.current && drawingPoints.current.length >= 2) {
          if (!isStrokeCreated.current) {
            addItem({
              type: 'stroke',
              id: currentStrokeId.current,
              tool: 'pen',
              points: [...drawingPoints.current],
              color: color,
              size: 2,
              isEraser: false,
              isHighlighter: false
            })
            isStrokeCreated.current = true
          } else {
            updateItem(currentStrokeId.current, {
              points: [...drawingPoints.current]
            })
          }
        }
      }
    }

    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }
  }

  const stopAll = () => {
    // Save final stroke when drawing stops
    if (
      drawing &&
      currentStrokeId.current &&
      drawingPoints.current.length >= 4 &&
      isStrokeCreated.current
    ) {
      // Final update to ensure all points are saved
      updateItem(currentStrokeId.current, {
        points: [...drawingPoints.current]
      })
      saveHistory()
    } else if (
      drawing &&
      currentStrokeId.current &&
      drawingPoints.current.length >= 4 &&
      !isStrokeCreated.current
    ) {
      // Edge case: drag ended before first throttle? Unlikely with >=4 points check
      addItem({
        type: 'stroke',
        id: currentStrokeId.current,
        tool: 'pen',
        points: [...drawingPoints.current],
        color: color,
        size: 3,
        isEraser: false,
        isHighlighter: false
      })
      saveHistory()
    }

    setDragging(false)
    setRotating(false)
    setExtending(false)
    setDrawing(false)
    drawingPoints.current = []
    currentStrokeId.current = null
    isStrokeCreated.current = false
  }

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (drawing || rotating || dragging || extending) {
        stopAll()
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [drawing, rotating, dragging, extending])

  return (
    <div
      className='fixed inset-0 z-[1000]'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      style={{
        pointerEvents: dragging || rotating || extending || drawing ? 'auto' : 'none'
      }}
    >
      <div
        ref={ref}
        onMouseDown={onDragStart}
        className='absolute select-none group'
        style={{
          left: position.x,
          top: position.y,
          width: 40,
          height: 40,
          pointerEvents: 'auto',
          cursor: 'move'
        }}
      >
        {/* --- Arms Container --- */}
        {/* Centered at 20,20 w.r.t the div */}
        <div className='absolute top-1/2 left-1/2 w-0 h-0'>
          {/* Left Arm (Fixed Pivot Leg) */}
          <DividerArm
            rotation={rotation}
            length={length}
            side='left'
          />

          {/* Right Arm (Movable Drawing Leg) */}
          <DividerArm
            rotation={rotation + spread}
            length={length}
            side='right'
            onMouseDown={onDrawStart}
            isDrawing={drawing}
          />
        </div>

        {/* --- Top Joint / Handle --- */}
        <div className='absolute inset-0 bg-gray-800 rounded-full flex items-center justify-center shadow-xl border-2 border-gray-700 z-20'>
          {/* Rotate Handle Overlay */}
          <div
            onMouseDown={onRotateStart}
            className='absolute -top-8 w-8 h-8 bg-gray-900/90 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black transition-transform hover:scale-110'
            title='Rotate Divider'
          >
            ⟳
          </div>
          <div className='w-3 h-3 bg-gray-400 rounded-full' />
        </div>

        {/* --- Length Adjuster (Center) --- */}
        <div
          onMouseDown={onExtendStart}
          className='absolute -bottom-6 left-1/2 -translate-x-1/2 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center cursor-ns-resize z-30 hover:bg-gray-600 shadow-md'
          title='Adjust length'
        >
          ⇳
        </div>

        {/* --- Drawing Indicator --- */}
        {drawing && (
          <div className='absolute -top-16 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap z-50 pointer-events-none'>
            Drawing...
          </div>
        )}
      </div>
    </div>
  )
}

export default Divider
