import React, { useRef, useState } from 'react'

const Ruler: React.FC = () => {
  const rulerRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 200, y: 200 })
  const [rotation, setRotation] = useState(0)
  const [width, setWidth] = useState(420)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)

  const startRef = useRef({ x: 0, y: 0, width: 0, angle: 0 })

  /* ---------------- Drag ---------------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    startRef.current = {
      ...startRef.current,
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }

  /* ---------------- Resize ---------------- */
  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setResizing(true)
    startRef.current.width = width
    startRef.current.x = e.clientX
  }

  /* ---------------- Rotate ---------------- */
  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRotating(true)

    const rect = rulerRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    startRef.current.angle =
      Math.atan2(e.clientY - cy, e.clientX - cx) - rotation * (Math.PI / 180)
  }

  /* ---------------- Mouse Move ---------------- */
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - startRef.current.x,
        y: e.clientY - startRef.current.y
      })
    }

    if (resizing) {
      const delta = e.clientX - startRef.current.x
      setWidth(Math.max(250, Math.min(700, startRef.current.width + delta)))
    }

    if (rotating) {
      const rect = rulerRef.current!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const angle =
        Math.atan2(e.clientY - cy, e.clientX - cx) - startRef.current.angle

      setRotation((angle * 180) / Math.PI)
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  return (
    <div
      className='absolute inset-0'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      style={{ pointerEvents: dragging || resizing || rotating ? 'auto' : 'none' }}
    >
      <div
        ref={rulerRef}
        onMouseDown={onDragStart}
        style={{
          left: position.x,
          top: position.y,
          width,
          transform: `rotate(${rotation}deg)`,
          pointerEvents: 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Ruler Body */}
        <div className='relative h-20 rounded-2xl bg-gradient-to-b from-[#e8f0dc] to-[#cfdcbc] shadow-md flex items-center px-10'>
          {/* Ticks */}
          <div className='absolute top-2 left-6 right-6 flex justify-between text-xs text-gray-600'>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i}>{i}</span>
            ))}
          </div>

          {/* Center Angle */}
          <div className='mx-auto text-gray-700 font-semibold'>
            {Math.round(rotation)}°
          </div>

          {/* Close Button (UI only) */}
          <button className='absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-400 text-white text-sm flex items-center justify-center'>
            ×
          </button>

          {/* Resize Handle */}
          <div
            onMouseDown={onResizeStart}
            className='absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-500 cursor-ew-resize'
          />

          {/* Rotate Handle */}
          <div
            onMouseDown={onRotateStart}
            className='absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-600 cursor-pointer flex items-center justify-center text-white text-sm'
          >
            ⟳
          </div>
        </div>
      </div>
    </div>
  )
}

export default Ruler
