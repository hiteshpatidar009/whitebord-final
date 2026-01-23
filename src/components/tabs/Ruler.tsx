import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { Minus } from 'lucide-react'

// Ruler geometry interface
export interface RulerGeometry {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

// Ruler snapping utilities
export const RulerUtils = {
  // Check if point is near ruler edge
  isNearRulerEdge: (pointX: number, pointY: number, ruler: RulerGeometry, threshold = 15): boolean => {
    const cos = Math.cos(ruler.rotation * Math.PI / 180)
    const sin = Math.sin(ruler.rotation * Math.PI / 180)
    
    // Transform point to ruler's local coordinate system
    const localX = (pointX - ruler.x) * cos + (pointY - ruler.y) * sin
    const localY = -(pointX - ruler.x) * sin + (pointY - ruler.y) * cos
    
    // Check if within ruler bounds horizontally
    if (localX < 0 || localX > ruler.width) return false
    
    // Check if near top or bottom edge
    return Math.abs(localY) <= threshold || Math.abs(localY - ruler.height) <= threshold
  },

  // Snap point to ruler edge
  snapToRulerEdge: (pointX: number, pointY: number, ruler: RulerGeometry): { x: number, y: number } => {
    const cos = Math.cos(ruler.rotation * Math.PI / 180)
    const sin = Math.sin(ruler.rotation * Math.PI / 180)
    
    // Transform to local coordinates
    const localX = (pointX - ruler.x) * cos + (pointY - ruler.y) * sin
    const localY = -(pointX - ruler.x) * sin + (pointY - ruler.y) * cos
    
    // Snap to nearest edge (top or bottom)
    const snappedLocalY = Math.abs(localY) < Math.abs(localY - ruler.height) ? 0 : ruler.height
    
    // Transform back to global coordinates
    const globalX = ruler.x + localX * cos - snappedLocalY * sin
    const globalY = ruler.y + localX * sin + snappedLocalY * cos
    
    return { x: globalX, y: globalY }
  }
}

const Ruler: React.FC = () => {
  const { tool, setShowRuler, setRulerGeometry, setTool } = useWhiteboardStore()
  const rulerRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 200, y: 200 })
  const [rotation, setRotation] = useState(0)
  const [width, setWidth] = useState(420)
  const [isDarkTheme, setIsDarkTheme] = useState(false) // Changed to false - DEFAULT LIGHT MODE

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
    // LIGHT MODE (DEFAULT) - Original ruler style
    light: {
      rulerBg: 'bg-[#05FF29]/10',
      rulerBorder: 'border-black',
      toggleBtnBg: 'bg-gray-900/80',
      toggleBtnHover: 'hover:bg-gray-700',
      toggleBtnBorder: 'border-black',
      toggleIcon: 'text-white',
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

    // DARK MODE (AFTER TOGGLE) - Glass greyish-white style
    dark: {
      // Ruler background changed to greyish-white
      rulerBg: 'bg-white/20',
      rulerBorder: 'border-white/30',

      // Toggle button
      toggleBtnBg: 'bg-white/20',
      toggleBtnHover: 'hover:bg-white/30',
      toggleBtnBorder: 'border-white/30',
      toggleIcon: 'text-white',

      // Tick colors - changed to white variants
      tickColors: {
        10: 'bg-white/60',
        5: 'bg-white/50',
        default: 'bg-white/40'
      },
      inchTickColors: {
        4: 'bg-white/60',
        2: 'bg-white/50',
        default: 'bg-white/40'
      },

      // Text colors - changed to white
      text: {
        cm: 'text-white/80',
        inch: 'text-white/70'
      },

      // Close button
      closeBtn: {
        bg: 'bg-white/20',
        hover: 'hover:bg-white/30',
        text: 'text-white'
      },

      // Resize handle
      resizeHandle: 'bg-white/20 border-white/30',

      // Rotate button
      rotateBtn: 'bg-white/20 border-white/30 text-white',

      // Angle display
      angleDisplay: 'bg-white/20 border-white/30 text-white',

      // Center line (kept same for visibility)
      centerLine: 'bg-red-600/80'
    }
  }

  const colors = isDarkTheme ? themeColors.dark : themeColors.light

  /* ---------------- CM/MM Ticks ---------------- */
  useEffect(() => {
    const cmInPixels = 37.8 // 1 cm = 37.8 pixels
    const totalCm = Math.floor(width / cmInPixels)
    const totalTicks = totalCm * 10 // 10 ticks per cm (1 mm each)
    setTickMarks(Array.from({ length: totalTicks + 1 }, (_, i) => i))
  }, [width])

  /* ---------------- Inches Ticks ---------------- */
  useEffect(() => {
    const inchesInPixels = 96 // 1 inch = 96 pixels (standard screen DPI)
    const totalInches = Math.floor(width / inchesInPixels)
    const totalInchTicks = totalInches * 4 // 4 ticks per inch (1/4 inch each)
    setInchMarks(Array.from({ length: totalInchTicks + 1 }, (_, i) => i))
  }, [width])

  /* ---------------- Update Store with Ruler Geometry ---------------- */
  useEffect(() => {
    const rulerGeometry: RulerGeometry = {
      x: position.x,
      y: position.y,
      width,
      height: 112, // 28 * 4 (h-28 = 112px)
      rotation
    }
    setRulerGeometry(rulerGeometry)
  }, [position.x, position.y, width, rotation, setRulerGeometry])

  /* ---------------- Touch/Mouse Handlers ---------------- */
  const getEventCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
    }
    return { clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY }
  }

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoords(e)
    setDragging(true)
    startRef.current.x = coords.clientX - position.x
    startRef.current.y = coords.clientY - position.y
  }

  const onResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    const coords = getEventCoords(e)
    setResizing(true)
    startRef.current.width = width
    startRef.current.x = coords.clientX
  }

  const onRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    const coords = getEventCoords(e)
    setRotating(true)
    const rect = rulerRef.current!.getBoundingClientRect()
    const pivotX = rect.left
    const pivotY = rect.top
    const initialAngle = Math.atan2(coords.clientY - pivotY, coords.clientX - pivotX)
    startRef.current.angle = initialAngle - rotation * (Math.PI / 180)
    startRef.current.pivotX = pivotX
    startRef.current.pivotY = pivotY
  }

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoords(e)
    
    if (dragging) {
      setPosition({
        x: coords.clientX - startRef.current.x,
        y: coords.clientY - startRef.current.y
      })
    }

    if (resizing) {
      const delta = coords.clientX - startRef.current.x
      setWidth(Math.max(250, Math.min(1400, startRef.current.width + delta)))
    }

    if (rotating) {
      const currentAngle = Math.atan2(
        coords.clientY - startRef.current.pivotY,
        coords.clientX - startRef.current.pivotX
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
      onMouseMove={onMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      onTouchMove={onMove}
      onTouchEnd={stopAll}
      style={{
        pointerEvents: dragging || resizing || rotating ? 'auto' : 'none'
      }}
    >
      <div
        ref={rulerRef}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
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
          style={{ pointerEvents: 'auto' }} // Allow drawing through ruler
        >
          {/* CM / MM Scale (Top) */}
          <div className='absolute top-0 left-0 h-1/2 w-full'>
            {tickMarks.map(tick => {
              const left = (tick * 37.8) / 10 + 20
              return (
                <div
                  key={`cm-${tick}`}
                  className='absolute flex flex-col items-center'
                  style={{ left, transform: 'translateX(-50%)' }}
                >
                  <div
                    className={`w-[1.2px] ${getTickColor(tick)}`}
                    style={{ height: getTickHeight(tick) }}
                  />
                  {tick % 10 === 0 && (
                    <div 
                      className={`text-xs font-bold ${colors.text.cm} mt-1`}
                      style={{ marginTop: '2px' }}
                    >
                      {tick / 10}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Inches Scale (Bottom) */}
          <div className='absolute -bottom-5 left-0 h-1/2 w-full'>
  {inchMarks.map(tick => {
    const left = (tick * 96) / 4 + 20
    
    return (
      <div
        key={`inch-${tick}`}
        className='absolute flex flex-col items-center justify-end'
        style={{ 
          left, 
          transform: 'translateX(-50%)',
          height: '100%'
        }}
      >
        {/* Number at the top */}
        {tick % 4 === 0 && (
          <div 
            className={`text-[11px] font-semibold ${colors.text.inch}`}
            style={{ 
              marginBottom: '4px',
              position: 'absolute',
              top: 0
            }}
          >
            {tick / 4}
          </div>
        )}
        
        {/* Line extending downward from the bottom */}
        <div
          className={`w-[1.2px] ${getInchTickColor(tick)}`}
          style={{ 
            height: getInchTickHeight(tick),
            position: 'absolute',
            bottom: 20
          }}
        />
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
              isDarkTheme ? 'border-white/30' : 'border-gray-800'
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
          
          {/* Line Tool Button */}
          <button
            onClick={() => setTool(tool === 'line' ? 'pen' : 'line')}
            className={`absolute left-28 top-1/2 -translate-y-1/2
             w-7 h-7 rounded-full
             ${tool === 'line' 
               ? 'bg-blue-500 border-blue-500 text-white' 
               : 'bg-gray-700 border-gray-700 text-white hover:bg-gray-600'
             } backdrop-blur-sm
             border text-sm font-bold
             flex items-center justify-center
             shadow-lg transition-colors`}
            title={tool === 'line' ? 'Switch to Pen Tool' : 'Straight Line Tool'}
          >
            <Minus size={14} />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`absolute left-16 top-1/2 -translate-y-1/2
             w-7 h-7 rounded-full
             ${colors.toggleBtnBg} backdrop-blur-sm
             border ${colors.toggleBtnBorder}
             ${colors.toggleIcon} text-sm font-bold
             flex items-center justify-center
             shadow-lg ${colors.toggleBtnHover}`}
            title={
              isDarkTheme
                ? 'Switch to light theme (original)'
                : 'Switch to dark theme (glass)'
            }
          >
            {isDarkTheme ? (
              // Sun icon for dark mode (switch to light)
              <svg
                width='14'
                height='14'
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
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
              </svg>
            )}
          </button>

          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className={`absolute right-8 top-1/2 -translate-y-1/2 w-3 h-16 ${colors.resizeHandle} cursor-ew-resize`}
          />

          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            onTouchStart={onRotateStart}
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