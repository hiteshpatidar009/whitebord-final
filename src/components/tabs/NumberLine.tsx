import React, { useRef, useState } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const UNIT_PX = 35
const MIN_RANGE = 3

const NumberLine: React.FC = () => {
  const { setShowNumberLine } = useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 400, y: 300 })

  const [leftRange, setLeftRange] = useState(5)
  const [rightRange, setRightRange] = useState(5)
  const [topRange, setTopRange] = useState(5)
  const [bottomRange, setBottomRange] = useState(5)

  const [dragging, setDragging] = useState(false)
  const [stretchDir, setStretchDir] = useState<
    null | 'left' | 'right' | 'top' | 'bottom'
  >(null)

  const start = useRef({ x: 0, y: 0, range: 0 })

  /* ---------------- Drag ---------------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    start.current.x = e.clientX - position.x
    start.current.y = e.clientY - position.y
  }

  /* ---------------- Stretch Start ---------------- */
  const onStretchStart = (
    e: React.MouseEvent,
    dir: 'left' | 'right' | 'top' | 'bottom'
  ) => {
    e.stopPropagation()
    setStretchDir(dir)
    start.current.x = e.clientX
    start.current.y = e.clientY

    if (dir === 'left') start.current.range = leftRange
    if (dir === 'right') start.current.range = rightRange
    if (dir === 'top') start.current.range = topRange
    if (dir === 'bottom') start.current.range = bottomRange
  }

  /* ---------------- Mouse Move ---------------- */
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - start.current.x,
        y: e.clientY - start.current.y
      })
      return
    }

    if (!stretchDir) return

    if (stretchDir === 'right') {
      const delta = e.clientX - start.current.x
      setRightRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchDir === 'left') {
      const delta = start.current.x - e.clientX
      setLeftRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchDir === 'top') {
      const delta = start.current.y - e.clientY
      setTopRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchDir === 'bottom') {
      const delta = e.clientY - start.current.y
      setBottomRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }
  }

  const stopAll = () => {
    setDragging(false)
    setStretchDir(null)
  }

  const totalWidth = (leftRange + rightRange) * UNIT_PX
  const totalHeight = (topRange + bottomRange) * UNIT_PX

  return (
    <div
      className='fixed inset-0 z-50'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      style={{ pointerEvents: dragging || stretchDir ? 'auto' : 'none' }}
    >
      <div
        ref={ref}
        onMouseDown={onDragStart}
        className='absolute cursor-move select-none'
        style={{ left: position.x, top: position.y, pointerEvents: 'auto' }}
      >
        {/* ========== X AXIS ========== */}
        <div
          className='relative h-[2px] bg-black'
          style={{ width: totalWidth, left: -leftRange * UNIT_PX }}
        >
          {/* Numbers + ticks */}
          {Array.from({ length: leftRange + rightRange + 1 }).map((_, i) => {
            const value = i - leftRange
            return (
              <div
                key={i}
                className='absolute flex flex-col items-center'
                style={{ left: i * UNIT_PX, transform: 'translateX(-50%)' }}
              >
                {/* Tick */}
                <div className='w-[1px] h-2 bg-black -mt-1' />
                {/* Number */}
                {value !== 0 && (
                  <span className='text-xs font-bold mt-1'>{value}</span>
                )}
              </div>
            )
          })}

          {/* Left handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'left')}
            className='absolute left-0 top-1/2 w-4 h-4 bg-gray-800 text-white
                       rounded-full cursor-ew-resize flex items-center justify-center
                       text-xs leading-none'
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            ←
          </div>

          {/* Right handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'right')}
            className='absolute right-0 top-1/2 w-4 h-4 bg-gray-800 text-white
                       rounded-full cursor-ew-resize flex items-center justify-center
                       text-xs leading-none'
            style={{ transform: 'translate(50%, -50%)' }}
          >
            →
          </div>

          {/* Close button – locked to right tip */}
          <button
            className='absolute w-6 h-6 rounded-full bg-gray-800 text-white font-bold
                       flex items-center justify-center shadow-md
                       hover:scale-110 active:scale-95'
            style={{
              right: 0,
              top: -40,
              transform: 'translateX(50%)'
            }}
            onClick={() => setShowNumberLine(false)}
          >
            ×
          </button>
        </div>

        {/* ========== Y AXIS ========== */}
        <div
          className='absolute left-0 bg-black w-[2px]'
          style={{ height: totalHeight, top: -topRange * UNIT_PX }}
        >
          {/* Numbers + ticks */}
          {Array.from({ length: topRange + bottomRange + 1 }).map((_, i) => {
            const value = topRange - i
            return (
              <div
                key={i}
                className='absolute flex items-center'
                style={{ top: i * UNIT_PX, transform: 'translateY(-50%)' }}
              >
                {/* Tick */}
                <div className='h-[1px] w-2 bg-black -ml-1' />
                {/* Number */}
                {value !== 0 && (
                  <span className='text-xs font-bold ml-2'>{value}</span>
                )}
              </div>
            )
          })}

          {/* Top handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'top')}
            className='absolute top-0 left-1/2 w-4 h-4 bg-gray-800 text-white
                       rounded-full cursor-ns-resize flex items-center justify-center
                       text-xs leading-none'
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            ↑
          </div>

          {/* Bottom handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'bottom')}
            className='absolute bottom-0 left-1/2 w-4 h-4 bg-gray-800 text-white
                       rounded-full cursor-ns-resize flex items-center justify-center
                       text-xs leading-none'
            style={{ transform: 'translate(-50%, 50%)' }}
          >
            ↓
          </div>
        </div>

        {/* Origin */}
        <div
          className='absolute w-3 h-3 bg-red-600 rounded-full
                        -translate-x-1/2 -translate-y-1/2'
        />
        <span className='absolute text-xs font-bold text-red-600 translate-x-2 translate-y-2'>
          0
        </span>
      </div>
    </div>
  )
}

export default NumberLine
