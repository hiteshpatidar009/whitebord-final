import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const Ruler: React.FC = () => {
  const { setShowRuler } = useWhiteboardStore()
  const rulerRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 200, y: 200 })
  const [rotation, setRotation] = useState(0)
  const [width, setWidth] = useState(420)
  const [isDarkTheme, setIsDarkTheme] = useState(true) // New state for theme

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)

  const [tickMarks, setTickMarks] = useState<number[]>([])
  const [inchMarks, setInchMarks] = useState<number[]>([])

  const startRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    pivotX: 0,
    pivotY: 0
  })

  /* ---------------- Theme Toggle ---------------- */
  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  /* ---------------- Theme Colors ---------------- */
  const themeColors = {
    dark: {
      rulerBg: 'bg-[#05FF29]/10',
      rulerBorder: 'border-black',
      tickColors: {
        10: 'bg-gray-900',
        5: 'bg-gray-800',
        default: 'bg-gray-700'
      },
      inchTickColors: {
        4: 'bg-gray-900',
        2: 'bg-gray-700',
        default: 'bg-gray-600'
      },
      text: {
        cm: 'text-gray-900',
        inch: 'text-gray-800'
      },
      closeBtn: {
        bg: 'bg-gray-900/80',
        hover: 'hover:bg-gray-900',
        text: 'text-white'
      },
      resizeHandle: 'bg-gray-800 border-black',
      rotateBtn: 'bg-gray-900 border-black text-white',
      angleDisplay: 'bg-gray-900/90 border-gray-800 text-white',
      centerLine: 'bg-red-600/80'
    },
    light: {
      rulerBg: 'bg-[#05FF29]/10', // Same as dark theme
      rulerBorder: 'border-black',
      tickColors: {
        10: 'bg-gray-100',
        5: 'bg-gray-200',
        default: 'bg-gray-300'
      },
      inchTickColors: {
        4: 'bg-gray-100',
        2: 'bg-gray-300',
        default: 'bg-gray-400'
      },
      text: {
        cm: 'text-gray-100',
        inch: 'text-gray-200'
      },
      closeBtn: {
        bg: 'bg-gray-100/80',
        hover: 'hover:bg-gray-100',
        text: 'text-gray-900'
      },
      resizeHandle: 'bg-gray-200 border-gray-400',
      rotateBtn: 'bg-gray-100 border-gray-400 text-gray-900',
      angleDisplay: 'bg-gray-100/90 border-gray-300 text-gray-900',
      centerLine: 'bg-red-600/80' // Same as dark theme
    }
  }

  const colors = isDarkTheme ? themeColors.dark : themeColors.light

  /* ---------------- CM/MM Ticks ---------------- */
  useEffect(() => {
    const cmInPixels = 37.8
    const totalCm = Math.floor(width / cmInPixels)
    const totalTicks = totalCm * 10
    setTickMarks(Array.from({ length: totalTicks + 1 }, (_, i) => i))
  }, [width])

  /* ---------------- Inch Ticks ---------------- */
  useEffect(() => {
    const inchInPixels = 96
    const totalInches = Math.floor(width / inchInPixels)
    setInchMarks(Array.from({ length: totalInches * 4 + 1 }, (_, i) => i))
  }, [width])

  /* ---------------- Drag ---------------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    startRef.current.x = e.clientX - position.x
    startRef.current.y = e.clientY - position.y
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
    const pivotX = rect.left
    const pivotY = rect.top
    const initialAngle = Math.atan2(e.clientY - pivotY, e.clientX - pivotX)
    startRef.current.angle = initialAngle - rotation * (Math.PI / 180)
    startRef.current.pivotX = pivotX
    startRef.current.pivotY = pivotY
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
      setWidth(Math.max(250, Math.min(1400, startRef.current.width + delta)))
    }

    if (rotating) {
      const currentAngle = Math.atan2(
        e.clientY - startRef.current.pivotY,
        e.clientX - startRef.current.pivotX
      )
      setRotation((currentAngle - startRef.current.angle) * (180 / Math.PI))
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  /* ---------------- Helpers ---------------- */
  const getTickHeight = (i: number) =>
    i % 10 === 0 ? 20 : i % 5 === 0 ? 14 : 8
  const getTickColor = (i: number) => {
    if (i % 10 === 0) return colors.tickColors[10]
    if (i % 5 === 0) return colors.tickColors[5]
    return colors.tickColors.default
  }

  const getInchTickHeight = (i: number) =>
    i % 4 === 0 ? 16 : i % 2 === 0 ? 11 : 7
  const getInchTickColor = (i: number) => {
    if (i % 4 === 0) return colors.inchTickColors[4]
    if (i % 2 === 0) return colors.inchTickColors[2]
    return colors.inchTickColors.default
  }

  return (
    <div
      className='fixed inset-0 z-50'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      style={{
        pointerEvents: dragging || resizing || rotating ? 'auto' : 'none'
      }}
    >
      <div
        ref={rulerRef}
        onMouseDown={onDragStart}
        style={{
          left: position.x,
          top: position.y,
          width,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'left top',
          pointerEvents: 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Ruler Body */}
        <div
          className={`relative h-28 rounded-xl ${colors.rulerBg} backdrop-blur-sm border-[2.5px] ${colors.rulerBorder} shadow-2xl flex items-center overflow-hidden`}
        >
          {/* CM / MM Scale (Top) */}
          <div className='absolute top-0 left-0 h-full w-full'>
            {tickMarks.map(tick => {
              const left = (tick * 37.8) / 10 + 20
              return (
                <div
                  key={tick}
                  className='absolute flex flex-col items-center'
                  style={{ left, transform: 'translateX(-50%)' }}
                >
                  <div
                    className={`w-[1.2px] ${getTickColor(tick)}`}
                    style={{ height: getTickHeight(tick) }}
                  />
                  {tick % 10 === 0 && (
                    <div className={`text-xs font-bold ${colors.text.cm}`}>
                      {tick / 10}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Inches Scale (Bottom) */}
          <div className='absolute bottom-0 left-0 h-full w-full'>
            {inchMarks.map(tick => {
              const left = (tick * 96) / 4 + 20
              return (
                <div
                  key={tick}
                  className='absolute flex flex-col items-center'
                  style={{ left, bottom: 8, transform: 'translateX(-50%)' }}
                >
                  <div
                    className={`w-[1.2px] ${getInchTickColor(tick)}`}
                    style={{ height: getInchTickHeight(tick) }}
                  />
                  {tick % 4 === 0 && (
                    <div
                      className={`text-[11px] font-semibold ${colors.text.inch}`}
                    >
                      {tick / 4}"
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Center Line */}
          <div
            className={`absolute left-1/2 top-0 bottom-0 w-0.5 ${colors.centerLine} -translate-x-1/2`}
          />

          {/* Angle Display */}
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
              colors.angleDisplay
            } px-4 py-2 rounded-lg border ${
              colors.angleDisplay.includes('gray-900')
                ? 'border-gray-800'
                : 'border-gray-300'
            } font-bold`}
          >
            {Math.round(rotation)}°
          </div>

          {/* Close */}
          <button
            onClick={() => setShowRuler(false)}
            className={`absolute left-6 top-1/2 -translate-y-1/2
             w-7 h-7 rounded-full
             ${colors.closeBtn.bg} backdrop-blur-sm
             border ${colors.rulerBorder}
             ${colors.closeBtn.text} text-sm font-bold
             flex items-center justify-center
             shadow-lg ${colors.closeBtn.hover}`}
          >
            ×
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`absolute left-16 top-1/2 -translate-y-1/2
             w-7 h-7 rounded-full
             ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-200'} backdrop-blur-sm
             border ${colors.rulerBorder}
             ${isDarkTheme ? 'text-white' : 'text-gray-900'} text-sm font-bold
             flex items-center justify-center
             shadow-lg ${
               isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-300'
             }`}
            title={
              isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'
            }
          >
            {isDarkTheme ? '☀' : '☾'}
          </button>

          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            className={`absolute right-8 top-1/2 -translate-y-1/2 w-3 h-16 ${colors.resizeHandle} cursor-ew-resize`}
          />

          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${colors.rotateBtn} flex items-center justify-center cursor-pointer`}
          >
            ⟳
          </div>
        </div>
      </div>
    </div>
  )
}

export default Ruler
