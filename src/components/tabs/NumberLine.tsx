import React, { useRef, useState } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { useTouchAndMouse } from '../../hooks/useTouchAndMouse'

const UNIT_PX = 35
const MIN_RANGE = 3

const NumberLine: React.FC = () => {
  const { tool, setShowNumberLine } = useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 400, y: 300 })
  const [isDarkTheme, setIsDarkTheme] = useState(false)

  const [leftRange, setLeftRange] = useState(5)
  const [rightRange, setRightRange] = useState(5)
  const [topRange, setTopRange] = useState(5)
  const [bottomRange, setBottomRange] = useState(5)

  const [dragging, setDragging] = useState(false)
  const [stretchDir, setStretchDir] = useState<
    null | 'left' | 'right' | 'top' | 'bottom'
  >(null)

  const start = useRef({ x: 0, y: 0, range: 0 })
  const { getPointerEvent } = useTouchAndMouse()

  /* ---------------- Theme Toggle ---------------- */
  const toggleTheme = () => {
    setIsDarkTheme(prev => !prev)
  }

  /* ---------------- Drag (ONLY via drag button) ---------------- */
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    setDragging(true)
    start.current.x = pointer.clientX - position.x
    start.current.y = pointer.clientY - position.y
  }

  /* ---------------- Stretch Start ---------------- */
  const onStretchStart = (
    e: React.MouseEvent | React.TouchEvent,
    dir: 'left' | 'right' | 'top' | 'bottom'
  ) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setStretchDir(dir)
    start.current.x = pointer.clientX
    start.current.y = pointer.clientY

    if (dir === 'left') start.current.range = leftRange
    if (dir === 'right') start.current.range = rightRange
    if (dir === 'top') start.current.range = topRange
    if (dir === 'bottom') start.current.range = bottomRange
  }

  /* ---------------- Mouse / Touch Move ---------------- */
  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)

    if (dragging) {
      setPosition({
        x: pointer.clientX - start.current.x,
        y: pointer.clientY - start.current.y
      })
      return
    }

    if (!stretchDir) return

    if (stretchDir === 'right') {
      const delta = pointer.clientX - start.current.x
      setRightRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchDir === 'left') {
      const delta = start.current.x - pointer.clientX
      setLeftRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchDir === 'top') {
      const delta = start.current.y - pointer.clientY
      setTopRange(
        Math.max(MIN_RANGE, start.current.range + Math.round(delta / UNIT_PX))
      )
    }

    if (stretchDir === 'bottom') {
      const delta = pointer.clientY - start.current.y
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

  /* ---------------- Theme Colors ---------------- */
  const axisColor = isDarkTheme ? 'bg-white' : 'bg-black'
  const tickColor = isDarkTheme ? 'bg-white' : 'bg-black'
  const textColor = isDarkTheme ? 'text-white' : 'text-black'
  const handleBg = isDarkTheme ? 'bg-white/30' : 'bg-gray-800'
  const handleText = 'text-white'
  const closeBtnBg = isDarkTheme ? 'bg-white/30' : 'bg-gray-800'
  const closeBtnHover = isDarkTheme ? 'hover:bg-white/50' : 'hover:bg-gray-900'
  const originColor = 'bg-red-600'

  return (
    <div
      className="fixed inset-0 z-50"
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      onTouchMove={onMouseMove}
      onTouchEnd={stopAll}
      style={{ 
        pointerEvents: dragging || stretchDir ? 'auto' : 'none',
        touchAction: 'none'
      }}
    >
      <div
        ref={ref}
        className="absolute select-none"
        style={{ 
          left: position.x, 
          top: position.y, 
          pointerEvents: 'auto',
          touchAction: 'none'
        }}
      >
        {/* ========== X AXIS ========== */}
        <div
          className={`relative h-[2px] ${axisColor}`}
          style={{ width: totalWidth, left: -leftRange * UNIT_PX }}
        >
          {/* Numbers + ticks */}
          {Array.from({ length: leftRange + rightRange + 1 }).map((_, i) => {
            const value = i - leftRange
            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: i * UNIT_PX, transform: 'translateX(-50%)' }}
              >
                <div className={`w-[1px] h-2 ${tickColor} -mt-1`} />
                {value !== 0 && (
                  <span className={`text-xs font-bold mt-1 ${textColor}`}>
                    {value}
                  </span>
                )}
              </div>
            )
          })}

          {/* Left handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'left')}
            onTouchStart={e => onStretchStart(e, 'left')}
            className={`absolute left-0 top-1/2 w-4 h-4 ${handleBg} ${handleText}
              rounded-full cursor-ew-resize flex items-center justify-center text-xs`}
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            ←
          </div>

          {/* Right handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'right')}
            onTouchStart={e => onStretchStart(e, 'right')}
            className={`absolute right-0 top-1/2 w-4 h-4 ${handleBg} ${handleText}
              rounded-full cursor-ew-resize flex items-center justify-center text-xs`}
            style={{ transform: 'translate(50%, -50%)' }}
          >
            →
          </div>

          {/* Close button */}
          <button
            className={`absolute w-6 h-6 rounded-full ${closeBtnBg} text-white font-bold
              flex items-center justify-center shadow-md
              hover:scale-110 active:scale-95 ${closeBtnHover}`}
            style={{ right: 0, top: -40, transform: 'translateX(50%)' }}
            onClick={() => setShowNumberLine(false)}
          >
            ×
          </button>

          {/* Drag handle (ONLY way to drag) */}
          <button
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
            className={`absolute w-6 h-6 rounded-full 
              ${isDarkTheme ? 'bg-white/30' : 'bg-gray-900/80'} backdrop-blur-sm
              border ${isDarkTheme ? 'border-white/30' : 'border-black'}
              text-white flex items-center justify-center
              shadow-md hover:scale-110 active:scale-95`}
            style={{
              right: 0,
              top: -100,
              transform: 'translateX(50%)',
              cursor: 'grab'
            }}
            title="Drag number line"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="9" cy="5" r="1.5" />
              <circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" />
              <circle cx="15" cy="19" r="1.5" />
            </svg>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`absolute w-6 h-6 rounded-full 
              ${isDarkTheme ? 'bg-white/30' : 'bg-gray-900/80'}
              border ${isDarkTheme ? 'border-white/30' : 'border-black'}
              text-white text-xs font-bold flex items-center justify-center
              shadow-md hover:scale-110 active:scale-95`}
            style={{ right: 0, top: -70, transform: 'translateX(50%)' }}
          >
            {isDarkTheme ? (
              // Sun icon for dark mode (switch to light)
              <svg
                width='12'
                height='12'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <circle cx='12' cy='12' r='4' />
                <line x1='12' y1='2' x2='12' y2='4' />
                <line x1='12' y1='20' x2='12' y2='22' />
                <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
                <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
                <line x1='2' y1='12' x2='4' y2='12' />
                <line x1='20' y1='12' x2='22' y2='12' />
                <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
                <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
              </svg>
            ) : (
              // Moon icon for light mode (switch to dark)
              <svg
                width='12'
                height='12'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
              </svg>
            )}
          </button>
        </div>

        {/* ========== Y AXIS ========== */}
        <div
          className={`absolute left-0 ${axisColor} w-[2px]`}
          style={{ height: totalHeight, top: -topRange * UNIT_PX }}
        >
          {Array.from({ length: topRange + bottomRange + 1 }).map((_, i) => {
            const value = topRange - i
            return (
              <div
                key={i}
                className="absolute flex items-center"
                style={{ top: i * UNIT_PX, transform: 'translateY(-50%)' }}
              >
                <div className={`h-[1px] w-2 ${tickColor} -ml-1`} />
                {value !== 0 && (
                  <span className={`text-xs font-bold ml-2 ${textColor}`}>
                    {value}
                  </span>
                )}
              </div>
            )
          })}

          {/* Top handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'top')}
            onTouchStart={e => onStretchStart(e, 'top')}
            className={`absolute top-0 left-1/2 w-4 h-4 ${handleBg} ${handleText}
              rounded-full cursor-ns-resize flex items-center justify-center text-xs`}
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            ↑
          </div>

          {/* Bottom handle */}
          <div
            onMouseDown={e => onStretchStart(e, 'bottom')}
            onTouchStart={e => onStretchStart(e, 'bottom')}
            className={`absolute bottom-0 left-1/2 w-4 h-4 ${handleBg} ${handleText}
              rounded-full cursor-ns-resize flex items-center justify-center text-xs`}
            style={{ transform: 'translate(-50%, 50%)' }}
          >
            ↓
          </div>
        </div>

        {/* Origin */}
        <div
          className={`absolute w-3 h-3 ${originColor} rounded-full
            -translate-x-1/2 -translate-y-1/2`}
        />
        <span className="absolute text-xs font-bold text-red-600 translate-x-2 translate-y-2">
          0
        </span>
      </div>
    </div>
  )
}

export default NumberLine
