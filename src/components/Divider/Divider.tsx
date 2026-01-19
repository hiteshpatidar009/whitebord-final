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
  const [leftArmRotation, setLeftArmRotation] = useState(-15) // Left arm moves (drawing)
  const [rightArmRotation] = useState(15) // Right arm always fixed
  const [radius, setRadius] = useState(150)

  // Interaction State
  const [dragging, setDragging] = useState(false)
  const [adjustingRadius, setAdjustingRadius] = useState(false)

  // Refs for smooth interaction
  const start = useRef({
    x: 0,
    y: 0,
    centerX: 0,
    centerY: 0,
    radius: 0,
    initialRotation: 0
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
  const [drawing, setDrawing] = useState(false)
  // const [hasStartedMoving, setHasStartedMoving] = useState(false)

  /* ---------- Drag Whole Tool ---------- */
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return
    setDragging(true)
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    start.current.x = clientX - position.x
    start.current.y = clientY - position.y
  }

  /* ---------- Rotate (Top Handle) ---------- */
  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    
    const center = getExactCenter()
    const dx = e.clientX - center.x 
    const dy = e.clientY - center.y
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    setLeftArmRotation(angle)
  }

  /* ---------- Adjust Radius ---------- */
  const onAdjustRadiusStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    
    setAdjustingRadius(true)
    const center = getExactCenter()
    start.current.centerX = center.x
    start.current.centerY = center.y
    start.current.radius = radius
    start.current.initialRotation = leftArmRotation
  }

  /* ---------- Draw Circle Manually ---------- */
  const onDrawStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if ('button' in e && e.button !== 0) return

    setDrawing(true)
    isStrokeCreated.current = false

    const center = getExactCenter()
    start.current.centerX = center.x
    start.current.centerY = center.y
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    start.current.x = clientX
    start.current.y = clientY

    const id = uuidv4()
    currentStrokeId.current = id
    drawingPoints.current = []
    lastPointTime.current = Date.now()
  }

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    // Adjusting Radius
    if (adjustingRadius) {
      const dx = clientX - start.current.centerX
      const newRadius = clamp(Math.abs(dx), 50, 400)
      setRadius(newRadius)
      
      // Move left arm horizontally (0 degrees = right, 180 = left)
      setLeftArmRotation(dx > 0 ? 0 : 180)
    }

    // Drawing Circle
    if (drawing) {
      const dx = clientX - start.current.centerX
      const dy = clientY - start.current.centerY
      const mouseAngle = Math.atan2(dy, dx)
      
      // Update only left arm rotation to follow mouse
      setLeftArmRotation(mouseAngle * (180 / Math.PI))

      const now = Date.now()
      if (now - lastPointTime.current > 8) { // Smoother drawing
        // CENTER → ARM LENGTH → PURPLE CIRCLE OFFSET (-bottom-4 = 16px) → TIP OFFSET (-bottom-1 = 4px) → TIP HEIGHT (2px)
        const pencilTipX = start.current.centerX + Math.cos(mouseAngle) * (radius + 22)
        const pencilTipY = start.current.centerY + Math.sin(mouseAngle) * (radius + 22)

        drawingPoints.current.push(pencilTipX, pencilTipY)
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

    // Dragging
    if (dragging) {
      setPosition({
        x: clientX - start.current.x,
        y: clientY - start.current.y
      })
    }
  }

  const stopAll = () => {
    if (drawing && currentStrokeId.current && drawingPoints.current.length >= 4) {
      updateItem(currentStrokeId.current, {
        points: [...drawingPoints.current]
      })
      saveHistory()
    }

    setDragging(false)
    setAdjustingRadius(false)
    setDrawing(false)
    drawingPoints.current = []
    currentStrokeId.current = null
    isStrokeCreated.current = false
  }

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragging || adjustingRadius || drawing) {
        stopAll()
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [dragging, adjustingRadius, drawing])

  // Right arm stays fixed, left arm moves independently
  const leftRotation = leftArmRotation // Moves based on interaction
  const rightRotation = rightArmRotation // Always fixed at 15 degrees

  return (
    <div
      className='fixed inset-0 z-[1000]'
      onMouseMove={onMouseMove}
      onTouchMove={onMouseMove}
      onMouseUp={stopAll}
      onTouchEnd={stopAll}
      onMouseLeave={stopAll}
      style={{
        pointerEvents: dragging || adjustingRadius || drawing ? 'auto' : 'none'
      }}
    >
      <div
        ref={ref}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
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
        <div className='absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2'>
          {/* Left Arm (Drawing) */}
          <DividerArm
            rotation={leftRotation}
            length={radius}
            side='left'
            onMouseDown={onDrawStart}
            isDrawing={drawing}
          />

          {/* Right Arm (Fixed) */}
          <DividerArm
            rotation={rightRotation}
            length={radius}
            side='right'
          />
        </div>

        {/* --- Top Joint / Handle --- */}
        <div className='absolute inset-0 bg-gray-800 rounded-full flex items-center justify-center shadow-xl border-2 border-gray-600 z-20'>
          {/* Drag button */}
          <div className='w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center'>
            <div 
              onMouseDown={onDragStart}
              className='w-2 h-2 bg-white rounded-full cursor-move'
            />
          </div>
        </div>

        {/* --- Top Handle --- */}
        <div
          onMouseDown={onRotateStart}
          className='absolute -top-6 left-1/2 w-6 h-12 bg-gray-400 rounded-t-md cursor-pointer'
          style={{ transform: 'translateX(-50%)' }}
          title='Rotate Divider'
        />

        {/* --- Radius Adjust Button --- */}
        <div
          onMouseDown={onAdjustRadiusStart}
          className='absolute -bottom-6 left-1/2 -translate-x-1/2 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer z-30 hover:bg-blue-700 shadow-md text-xs font-bold'
          title='Adjust Radius'
        >
          ⟷
        </div>

        {/* --- Radius Display --- */}
        {adjustingRadius && (
          <div className='absolute -top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap z-50 pointer-events-none'>
            Radius: {Math.round(radius)}px
          </div>
        )}

        {/* --- Drawing Indicator --- */}
        {/* {drawing && (
          <div className='absolute -top-16 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap z-50 pointer-events-none'>
            Drawing...
          </div>
        )} */}
      </div>
    </div>
  )
}

export default Divider