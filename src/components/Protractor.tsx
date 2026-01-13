import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../store/useWhiteboardStore'

const Protractor: React.FC = () => {
  const { setShowProtractor } = useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 300, y: 300 })
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState(420)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)

  const start = useRef({ x: 0, y: 0, size: 0, angle: 0 })

  /* ---------------- Drag ---------------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    start.current.x = e.clientX - position.x
    start.current.y = e.clientY - position.y
  }

  /* ---------------- Resize ---------------- */
  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setResizing(true)
    start.current.x = e.clientX
    start.current.size = size
  }

  /* ---------------- Rotate ---------------- */
  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRotating(true)

    const rect = ref.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height

    start.current.angle =
      Math.atan2(e.clientY - cy, e.clientX - cx) - rotation * (Math.PI / 180)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }

    if (resizing) {
      const delta = e.clientX - start.current.x
      setSize(Math.max(280, Math.min(700, start.current.size + delta)))
    }

    if (rotating) {
      const rect = ref.current!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height

      const angle =
        Math.atan2(e.clientY - cy, e.clientX - cx) - start.current.angle

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
      style={{
        pointerEvents: dragging || resizing || rotating ? 'auto' : 'none'
      }}
    >
      <div
        ref={ref}
        onMouseDown={onDragStart}
        className='absolute select-none cursor-grab'
        style={{
          left: position.x,
          top: position.y,
          width: size,
          height: size / 2,
          transform: `rotate(${rotation}deg)`,
          pointerEvents: 'auto'
        }}
      >
        {/* Body */}
        <div className='relative w-full h-full bg-[#B9DEA5]/80 backdrop-blur-sm border-2 border-gray-900 rounded-t-full shadow-2xl overflow-hidden'>
          {/* Degree lines */}
          {[...Array(181)].map((_, i) => (
            <div
              key={i}
              className='absolute bottom-0 left-1/2 bg-gray-900 origin-bottom'
              style={{
                width: '1px',
                height: i % 10 === 0 ? '26%' : i % 5 === 0 ? '20%' : '14%',
                transform: `rotate(${i - 90}deg) translateY(-10%)`
              }}
            />
          ))}

          {/* Degree numbers */}
          {[0, 30, 60, 90, 120, 150, 180].map(d => (
            <span
              key={d}
              className='absolute text-xs font-bold text-gray-900'
              style={{
                left: `${(d / 180) * 100}%`,
                bottom: d === 90 ? '42%' : '30%',
                transform: 'translateX(-50%)'
              }}
            >
              {d}
            </span>
          ))}

          {/* Center pivot */}
          <div className='absolute bottom-0 left-1/2 w-3 h-3 bg-gray-900 rounded-full -translate-x-1/2 translate-y-1/2' />

          {/* ---------- BUTTONS (EXACT PLACEMENT) ---------- */}

          {/* Close */}
          <button
            onClick={() => setShowProtractor(false)}
            className='absolute top-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg'
          >
            ×
          </button>

          {/* Rotate */}
          <button
            onMouseDown={onRotateStart}
            className='absolute bottom-6 left-16 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg'
          >
            ⟳
          </button>

          {/* Angle badge */}
          <div className='absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-1 rounded-lg text-sm font-bold shadow-lg'>
            {Math.round(rotation)}°
          </div>

          {/* Confirm */}
          <button className='absolute bottom-6 right-16 w-8 h-8 rounded-lg bg-white text-gray-900 flex items-center justify-center shadow-lg'>
            ✔
          </button>

          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            className='absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-gray-900/80 rounded cursor-ew-resize'
          />
        </div>
      </div>
    </div>
  )
}

export default Protractor
