import React, { useRef, useState } from 'react'

const UNIT_PX = 35
const MIN_RANGE = 3

const NumberLine: React.FC = () => {
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

  /* ---------------- Stretch X ---------------- */
  const onStretchXStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStretchX(true)
    start.current.x = e.clientX
    start.current.range = xRange
  }

  /* ---------------- Stretch Y ---------------- */
  const onStretchYStart = (e: React.MouseEvent) => {
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
      className='absolute inset-0'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
    >
      <div
        ref={ref}
        onMouseDown={onDragStart}
        className='absolute cursor-move select-none'
        style={{
          left: position.x,
          top: position.y
        }}
      >
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
                className='absolute text-xs text-black'
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

          {/* Right stretch handle */}
          <div
            onMouseDown={onStretchXStart}
            className='absolute right-0 top-1/2 w-2 h-2 bg-black rounded-full cursor-ew-resize'
            style={{ transform: 'translate(50%, -50%)' }}
          />
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
                className='absolute text-xs text-black'
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

          {/* Top stretch handle */}
          <div
            onMouseDown={onStretchYStart}
            className='absolute top-0 left-1/2 w-4 h-4 bg-black rounded-full cursor-ns-resize'
            style={{ transform: 'translate(-50%, -50%)' }}
          />
        </div>

        {/* Origin */}
        <div className='absolute left-1/2 top-0 w-2 h-2 bg-black rounded-full -translate-x-1/2 -translate-y-1/2' />
      </div>
    </div>
  )
}

export default NumberLine
