// Divider.tsx
import React, { useRef, useState, useEffect } from 'react'
import DividerArm from './DividerArm'
import { clamp } from './dividerMath'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { v4 as uuidv4 } from 'uuid'

const Divider: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null)
  const { addItem, color, saveHistory } = useWhiteboardStore()

  const [position, setPosition] = useState({ x: 500, y: 300 })
  const [angle, setAngle] = useState(25)
  const [length, setLength] = useState(180)

  const [dragging, setDragging] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [extending, setExtending] = useState(false)
  const [drawing, setDrawing] = useState(false)

  const start = useRef({
    x: 0,
    y: 0,
    angle: 0,
    length: 0,
    clientX: 0,
    clientY: 0,
    initialAngle: 0
  })

  const drawingPoints = useRef<number[]>([])
  const currentStrokeId = useRef<string | null>(null)
  const lastPointTime = useRef<number>(0)
  const isDrawingFromTip = useRef<boolean>(false)

  /* ---------- Drag ---------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    start.current.x = e.clientX - position.x
    start.current.y = e.clientY - position.y
  }

  /* ---------- Rotate (Top Handle) ---------- */
  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRotating(true)
    start.current.clientX = e.clientX
    start.current.angle = angle
  }

  /* ---------- Extend ---------- */
  const onExtendStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExtending(true)
    start.current.clientY = e.clientY
    start.current.length = length
  }

  /* ---------- Draw (Right Tip Only) ---------- */
  const onDrawStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Set drawing state
    setDrawing(true)
    isDrawingFromTip.current = true

    // Initialize drawing
    const id = uuidv4()
    currentStrokeId.current = id
    drawingPoints.current = []

    // Clear any previous points
    drawingPoints.current.length = 0

    // Get current tip position
    const centerX = position.x + 5
    const centerY = position.y + 5
    const currentAngleRad = angle * (Math.PI / 180)
    const tipX = centerX + Math.sin(currentAngleRad) * (length + 9)
    const tipY = centerY + Math.cos(currentAngleRad) * (length + 9)

    // Record FIRST point at current tip position
    drawingPoints.current.push(tipX, tipY)

    // Set rotation start for smooth movement
    start.current.clientX = e.clientX
    start.current.clientY = e.clientY
    start.current.initialAngle =
      Math.atan2(e.clientX - centerX, e.clientY - centerY) * (180 / Math.PI)

    start.current.angle = angle
    lastPointTime.current = Date.now()
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const centerX = position.x + 5
    const centerY = position.y + 5

    // Handle rotation from top handle
    if (rotating && !drawing) {
      const delta = e.clientX - start.current.clientX
      const newAngle = clamp(start.current.angle + delta * 0.2, 5, 75)
      setAngle(newAngle)
    }

    // Handle drawing from right tip
    if (drawing && isDrawingFromTip.current) {
      // Calculate angle based on mouse position relative to center
      const deltaX = e.clientX - centerX
      const deltaY = e.clientY - centerY

      // Calculate new angle (in degrees)
      let newAngle = Math.atan2(deltaX, deltaY) * (180 / Math.PI)

      // Allow full 360-degree rotation for complete circles
      // No clamping during drawing to enable full circles

      // Update angle
      setAngle(newAngle)

      // Calculate new tip position
      const newAngleRad = newAngle * (Math.PI / 180)
      const tipX = centerX + Math.sin(newAngleRad) * (length + 9)
      const tipY = centerY + Math.cos(newAngleRad) * (length + 9)

      // Add point with throttling for smooth drawing
      const now = Date.now()
      if (now - lastPointTime.current > 16) {
        // ~60fps
        drawingPoints.current.push(tipX, tipY)
        lastPointTime.current = now

        // Save stroke progressively
        if (currentStrokeId.current && drawingPoints.current.length >= 4) {
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
        }
      }
    }

    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }

    if (extending) {
      const delta = e.clientY - start.current.clientY
      setLength(clamp(start.current.length + delta, 120, 260))
    }
  }

  const stopAll = () => {
    // Save final stroke when drawing stops
    if (
      drawing &&
      currentStrokeId.current &&
      drawingPoints.current.length >= 4
    ) {
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
    isDrawingFromTip.current = false
    drawingPoints.current = []
    currentStrokeId.current = null
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
        className='absolute select-none'
        style={{
          left: position.x,
          top: position.y,
          pointerEvents: 'auto'
        }}
      >
        {/* Top joint */}
        <div className='relative w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center shadow-xl'>
          {/* Rotate handle */}
          <div
            onMouseDown={onRotateStart}
            className='absolute -top-6 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors'
            title='Rotate without drawing'
          >
            ⟳
          </div>
        </div>

        {/* Arms */}
        <div className='relative flex justify-center'>
          {/* Extend handle */}
          <div
            onMouseDown={onExtendStart}
            className='absolute top-0 left-1/2 -translate-x-1/2 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center cursor-ns-resize z-10 hover:bg-gray-700 transition-colors'
            title='Adjust length'
          >
            ⇳
          </div>

          {/* Left Arm (Fixed pivot) */}
          <DividerArm angle={angle} length={length} side='left' />

          {/* Right Arm (Drawing arm) - Always visible */}
          <DividerArm
            angle={angle}
            length={length}
            side='right'
            onMouseDown={onDrawStart}
            isDrawing={drawing}
          />
        </div>

        {/* Visual center point */}
        <div className='absolute top-1/2 left-1/2 w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-70'></div>

        {/* Drawing indicator */}
        {drawing && (
          <div className='absolute -top-12 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2'>
            <div className='w-2 h-2 bg-white rounded-full animate-pulse'></div>
            Drawing Mode
          </div>
        )}
      </div>
    </div>
  )
}

export default Divider
