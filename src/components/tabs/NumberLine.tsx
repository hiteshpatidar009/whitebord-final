import React, { useRef, useState } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const UNIT_PX = 35
const MIN_RANGE = 3

const NumberLine: React.FC = () => {
  const { setShowNumberLine } = useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 400, y: 300 })
  const [xRange, setXRange] = useState(5)
  const [yRange, setYRange] = useState(5)

  const [dragging, setDragging] = useState(false)
  const [stretchX, setStretchX] = useState(false)
  const [stretchY, setStretchY] = useState(false)

  const start = useRef({
    x: 0,
    y: 0,
    range: 0
  })

  /* ---------------- Drag ---------------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    start.current.x = e.clientX - position.x
    start.current.y = e.clientY - position.y
  }

  /* ---------------- Stretch X Left ---------------- */
  const onStretchXLeftStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStretchX(true)
    start.current.x = e.clientX
    start.current.range = xRange
  }

  /* ---------------- Stretch X Right ---------------- */
  const onStretchXRightStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStretchX(true)
    start.current.x = e.clientX
    start.current.range = xRange
  }

  /* ---------------- Stretch Y Top ---------------- */
  const onStretchYTopStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStretchY(true)
    start.current.y = e.clientY
    start.current.range = yRange
  }

  /* ---------------- Stretch Y Bottom ---------------- */
  const onStretchYBottomStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStretchY(true)
    start.current.y = e.clientY
    start.current.range = yRange
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
    }

    if (stretchX) {
      const delta = e.clientX - start.current.x
      setXRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchY) {
      const delta = start.current.y - e.clientY
      setYRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }
  }

  const stopAll = () => {
    setDragging(false)
    setStretchX(false)
    setStretchY(false)
  }

  return (
    <div
      className='fixed inset-0 z-50'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      style={{
        pointerEvents: dragging || stretchX || stretchY ? 'auto' : 'none'
      }}
    >
      <div
        ref={ref}
        onMouseDown={onDragStart}
        className='absolute cursor-move select-none'
        style={{
          left: position.x,
          top: position.y,
          pointerEvents: 'auto'
        }}
      >
        {/* Close Button */}
        <button
          className='absolute -top-9 -right-3 w-6 h-6 rounded-full bg-gray-800 hover:bg-gray-900 border-2 border-gray-700 text-white text-sm font-bold flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95'
          onClick={() => setShowNumberLine(false)}
        >
          ×
        </button>

        {/* ================= X AXIS ================= */}
        <div
          className='relative h-[2px] bg-black'
          style={{ width: xRange * 2 * UNIT_PX }}
        >
          {/* Numbers */}
          {Array.from({ length: xRange * 2 + 1 }).map((_, i) => {
            const v = i - xRange
            if (v === 0) return null
            return (
              <span
                key={v}
                className='absolute text-xs text-black font-bold'
                style={{
                  left: i * UNIT_PX,
                  top: 6,
                  transform: 'translateX(-50%)'
                }}
              >
                {v}
              </span>
            )
          })}

          {/* Tick marks */}
          {Array.from({ length: xRange * 2 + 1 }).map((_, i) => (
            <div
              key={i}
              className='absolute w-[1px] h-2 bg-black'
              style={{
                left: i * UNIT_PX,
                top: -4,
                transform: 'translateX(-50%)'
              }}
            />
          ))}

          {/* Right stretch handle */}
          <div
            onMouseDown={onStretchXRightStart}
            className='absolute right-0 top-1/2 w-4 h-4 bg-gray-800 text-white rounded-full cursor-ew-resize flex items-center justify-center text-xs font-bold hover:bg-gray-700'
            style={{ transform: 'translate(50%, -50%)' }}
            title='Stretch X-axis'
          >
            →
          </div>

          {/* Left stretch handle */}
          <div
            onMouseDown={onStretchXLeftStart}
            className='absolute left-0 top-1/2 w-4 h-4 bg-gray-800 text-white rounded-full cursor-ew-resize flex items-center justify-center text-xs font-bold hover:bg-gray-700'
            style={{ transform: 'translate(-50%, -50%)' }}
            title='Stretch X-axis'
          >
            ←
          </div>
        </div>

        {/* ================= Y AXIS ================= */}
        <div
          className='absolute left-1/2 bg-black w-[2px]'
          style={{
            height: yRange * 2 * UNIT_PX,
            top: -(yRange * UNIT_PX)
          }}
        >
          {/* Numbers */}
          {Array.from({ length: yRange * 2 + 1 }).map((_, i) => {
            const v = yRange - i
            if (v === 0) return null
            return (
              <span
                key={v}
                className='absolute text-xs text-black font-bold'
                style={{
                  top: i * UNIT_PX,
                  left: -8,
                  transform: 'translate(-100%, -50%)'
                }}
              >
                {v}
              </span>
            )
          })}

          {/* Tick marks */}
          {Array.from({ length: yRange * 2 + 1 }).map((_, i) => (
            <div
              key={i}
              className='absolute h-[1px] w-2 bg-black'
              style={{
                top: i * UNIT_PX,
                left: -4,
                transform: 'translateY(-50%)'
              }}
            />
          ))}

          {/* Top stretch handle */}
          <div
            onMouseDown={onStretchYTopStart}
            className='absolute top-0 left-1/2 w-4 h-4 bg-gray-800 text-white rounded-full cursor-ns-resize flex items-center justify-center text-xs font-bold hover:bg-gray-700'
            style={{ transform: 'translate(-50%, -50%)' }}
            title='Stretch Y-axis'
          >
            ↑
          </div>

          {/* Bottom stretch handle */}
          <div
            onMouseDown={onStretchYBottomStart}
            className='absolute bottom-0 left-1/2 w-4 h-4 bg-gray-800 text-white rounded-full cursor-ns-resize flex items-center justify-center text-xs font-bold hover:bg-gray-700'
            style={{ transform: 'translate(-50%, 50%)' }}
            title='Stretch Y-axis'
          >
            ↓
          </div>
        </div>

        {/* Origin */}
        <div className='absolute left-1/2 top-0 w-3 h-3 bg-red-600 rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-md' />

        {/* Origin label */}
        <span className='absolute left-1/2 top-0 text-xs font-bold text-red-600 transform translate-x-2 translate-y-2'>
          0
        </span>
      </div>
    </div>
  )
}

export default NumberLine
