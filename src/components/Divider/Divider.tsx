// Divider.tsx
import React, { useRef, useState } from 'react'
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
    clientY: 0
  })
  const drawingPoints = useRef<number[]>([])
  const currentStrokeId = useRef<string | null>(null)

  /* ---------- Drag ---------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    start.current.x = e.clientX - position.x
    start.current.y = e.clientY - position.y
  }

  /* ---------- Rotate ---------- */
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

  /* ---------- Draw ---------- */
  const onDrawStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDrawing(true)
    const id = uuidv4()
    currentStrokeId.current = id
    drawingPoints.current = []

    // Also start rotating when drawing from the marker tip
    setRotating(true)
    start.current.clientX = e.clientX
    start.current.angle = angle
  }

  const onMouseMove = (e: React.MouseEvent) => {
    let angleChanged = false

    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }

    if (rotating) {
      const delta = e.clientX - start.current.clientX
      const newAngle = clamp(start.current.angle + delta * 0.2, 5, 75)
      setAngle(newAngle)
      angleChanged = true
    }

    if (extending) {
      const delta = e.clientY - start.current.clientY
      setLength(clamp(start.current.length + delta, 120, 260))
    }

    if (drawing && ref.current) {
      // Calculate marker tip position
      const rightArmAngle = angle * (Math.PI / 180)
      const tipX = position.x + 5 + Math.sin(rightArmAngle) * length
      const tipY = position.y + 5 + Math.cos(rightArmAngle) * length

      // Add point to drawing
      drawingPoints.current.push(tipX, tipY)

      // Save stroke if we have enough points
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

      // If angle changed during drawing, also update the rotation start point
      if (angleChanged) {
        start.current.clientX = e.clientX
        start.current.angle = angle
      }
    }
  }

  const stopAll = () => {
    setDragging(false)
    setRotating(false)
    setExtending(false)

    if (drawing) {
      setDrawing(false)
      drawingPoints.current = []
      currentStrokeId.current = null
      saveHistory()
    }
  }

  return (
    <div
      className='fixed inset-0 z-50'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
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
            className='absolute -top-6 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center cursor-pointer'
          >
            ⟳
          </div>
        </div>

        {/* Arms */}
        <div className='relative flex justify-center'>
          {/* Extend handle */}
          <div
            onMouseDown={onExtendStart}
            className='absolute top-0 left-1/2 -translate-x-1/2 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center cursor-ns-resize z-10'
          >
            ⇳
          </div>

          <DividerArm angle={angle} length={length} side='left' />
          <DividerArm
            angle={angle}
            length={length}
            side='right'
            onMouseDown={onDrawStart}
            isDrawing={drawing}
          />
        </div>
      </div>
    </div>
  )
}

export default Divider
