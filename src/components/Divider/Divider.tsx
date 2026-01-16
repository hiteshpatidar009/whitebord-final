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
  const [rotation, setRotation] = useState(0) // Base rotation
  const [spread, setSpread] = useState(45) // Angle between legs
  const [length, setLength] = useState(200)

  // Interaction State
  const [dragging, setDragging] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [extending, setExtending] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [adjustingLeftTip, setAdjustingLeftTip] = useState(false)
  const [adjustingRightTip, setAdjustingRightTip] = useState(false)

  // Refs for smooth interaction
  const start = useRef({
    x: 0,
    y: 0,
    rotation: 0,
    spread: 0,
    length: 0,
    centerX: 0,
    centerY: 0,
    startAngle: 0,
    tipStartAngle: 0,
    tipStartSpread: 0
  })

  // Exact center calculation using DOM
  const getExactCenter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      return {
        x: rect.left + 20,
        y: rect.top + 20
      }
    }
    return { x: position.x + 20, y: position.y + 20 }
  }

  // Calculate radius (distance between tips)
  const getRadius = () => {
    const angleRad = spread * (Math.PI / 180)
    return 2 * length * Math.sin(angleRad / 2)
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

  /* ---------- Adjust Left Tip ---------- */
  const onLeftTipStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return

    setAdjustingLeftTip(true)
    const center = getExactCenter()
    start.current.centerX = center.x
    start.current.centerY = center.y
    start.current.rotation = rotation
    start.current.spread = spread

    const dx = e.clientX - center.x
    const dy = e.clientY - center.y
    start.current.tipStartAngle = Math.atan2(dx, dy) * (180 / Math.PI)
    start.current.tipStartSpread = spread
  }

  /* ---------- Adjust Right Tip ---------- */
  const onRightTipStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return

    setAdjustingRightTip(true)
    const center = getExactCenter()
    start.current.centerX = center.x
    start.current.centerY = center.y
    start.current.rotation = rotation
    start.current.spread = spread

    const dx = e.clientX - center.x
    const dy = e.clientY - center.y
    start.current.tipStartAngle = Math.atan2(dx, dy) * (180 / Math.PI)
    start.current.tipStartSpread = spread
  }

  /* ---------- Start Drawing Circle ---------- */
  const onDrawStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (e.button !== 0) return

    setDrawing(true)
    isStrokeCreated.current = false

    const center = getExactCenter()
    const radius = getRadius()

    // Start drawing circle from right tip position
    const rightTipAngle = (rotation + spread) * (Math.PI / 180)
    const startX = center.x + Math.sin(rightTipAngle) * length
    const startY = center.y + Math.cos(rightTipAngle) * length

    // Initialize stroke for full circle
    const id = uuidv4()
    currentStrokeId.current = id
    drawingPoints.current = [startX, startY]

    // Generate circle points
    const circlePoints: number[] = []
    const steps = 64 // Smooth circle
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const x = center.x + Math.sin(angle) * radius
      const y = center.y + Math.cos(angle) * radius
      circlePoints.push(x, y)
    }

    // Create the circle stroke
    addItem({
      type: 'stroke',
      id: id,
      tool: 'pen',
      points: circlePoints,
      color: color,
      size: 2,
      isEraser: false,
      isHighlighter: false
    })
    isStrokeCreated.current = true
    saveHistory()
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

    // 3. Adjust Left Tip (Changes rotation)
    if (adjustingLeftTip) {
      const dx = e.clientX - start.current.centerX
      const dy = e.clientY - start.current.centerY
      const mouseAngleGlobal = Math.atan2(dx, dy) * (180 / Math.PI)

      // Keep spread constant, rotate entire tool
      const newRotation =
        mouseAngleGlobal -
        (start.current.tipStartAngle - start.current.rotation)
      setRotation(newRotation)
    }

    // 4. Adjust Right Tip (Changes spread)
    if (adjustingRightTip) {
      const dx = e.clientX - start.current.centerX
      const dy = e.clientY - start.current.centerY
      const mouseAngleGlobal = Math.atan2(dx, dy) * (180 / Math.PI)

      // Keep rotation constant, adjust spread
      const newSpread = mouseAngleGlobal - rotation
      setSpread(clamp(newSpread, 5, 175)) // Limit to avoid crossing
    }

    // 5. Dragging
    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }
  }

  const stopAll = () => {
    setDragging(false)
    setRotating(false)
    setExtending(false)
    setDrawing(false)
    setAdjustingLeftTip(false)
    setAdjustingRightTip(false)
    drawingPoints.current = []
    currentStrokeId.current = null
    isStrokeCreated.current = false
  }

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (
        drawing ||
        rotating ||
        dragging ||
        extending ||
        adjustingLeftTip ||
        adjustingRightTip
      ) {
        stopAll()
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [
    drawing,
    rotating,
    dragging,
    extending,
    adjustingLeftTip,
    adjustingRightTip
  ])

  const radius = getRadius()
  const center = getExactCenter()

  return (
    <div
      className='fixed inset-0 z-[1000]'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      style={{
        pointerEvents:
          dragging ||
          rotating ||
          extending ||
          drawing ||
          adjustingLeftTip ||
          adjustingRightTip
            ? 'auto'
            : 'none'
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
        {/* --- Radius Display --- */}
        <div className='absolute -top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap z-50 pointer-events-none'>
          Radius: {Math.round(radius)}px
        </div>

        {/* --- Arms Container --- */}
        <div className='absolute top-1/2 left-1/2 w-0 h-0'>
          {/* Left Arm */}
          <DividerArm
            rotation={rotation}
            length={length}
            side='left'
            onMouseDown={onLeftTipStart}
            isAdjusting={adjustingLeftTip}
          />

          {/* Right Arm */}
          <DividerArm
            rotation={rotation + spread}
            length={length}
            side='right'
            onMouseDown={onRightTipStart}
            onDrawStart={onDrawStart}
            isAdjusting={adjustingRightTip}
            isDrawing={drawing}
          />
        </div>

        {/* --- Center Pivot --- */}
        <div className='absolute inset-0 bg-gray-800 rounded-full flex items-center justify-center shadow-xl border-2 border-gray-700 z-20'>
          {/* Rotate Handle */}
          <div
            onMouseDown={onRotateStart}
            className='absolute -top-8 w-8 h-8 bg-gray-900/90 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black transition-transform hover:scale-110'
            title='Rotate Divider'
          >
            ⟳
          </div>
          <div className='w-3 h-3 bg-gray-400 rounded-full' />
        </div>

        {/* --- Length Adjuster --- */}
        <div
          onMouseDown={onExtendStart}
          className='absolute -bottom-6 left-1/2 -translate-x-1/2 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center cursor-ns-resize z-30 hover:bg-gray-600 shadow-md'
          title='Adjust leg length'
        >
          ⇳
        </div>

        {/* --- Drawing Indicator --- */}
        {drawing && (
          <div className='absolute -top-16 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap z-50 pointer-events-none'>
            Circle drawn!
          </div>
        )}
      </div>
    </div>
  )
}

export default Divider
