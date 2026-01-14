// Divider.tsx
import React, { useRef, useState } from 'react'
import DividerArm from './DividerArm'
import { clamp } from './dividerMath'

const Divider: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 500, y: 300 })
  const [angle, setAngle] = useState(25)
  const [length, setLength] = useState(180)

  const [dragging, setDragging] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [extending, setExtending] = useState(false)

  const start = useRef({ x: 0, y: 0, angle: 0, length: 0 })

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
    start.current.x = e.clientX
    start.current.angle = angle
  }

  /* ---------- Extend ---------- */
  const onExtendStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExtending(true)
    start.current.y = e.clientY
    start.current.length = length
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }

    if (rotating) {
      const delta = e.clientX - start.current.x
      setAngle(clamp(start.current.angle + delta * 0.2, 5, 75))
    }

    if (extending) {
      const delta = start.current.y - e.clientY
      setLength(clamp(start.current.length + delta, 120, 260))
    }
  }

  const stopAll = () => {
    setDragging(false)
    setRotating(false)
    setExtending(false)
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

          {/* Extend handle */}
          <div
            onMouseDown={onExtendStart}
            className='absolute top-center w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center cursor-ns-resize'
          >
            ⇳
          </div>
        </div>

        {/* Arms */}
        <div className='relative flex justify-center'>
          <DividerArm angle={angle} length={length} side='left' />
          <DividerArm angle={angle} length={length} side='right' />
        </div>
      </div>
    </div>
  )
}

export default Divider
