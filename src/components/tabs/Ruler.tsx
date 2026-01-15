import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const Ruler: React.FC = () => {
  const { setShowRuler } = useWhiteboardStore()
  const rulerRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 200, y: 200 })
  const [rotation, setRotation] = useState(0)
  const [width, setWidth] = useState(420)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [tickMarks, setTickMarks] = useState<number[]>([])

  const startRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    pivotX: 0,
    pivotY: 0
  })

  // Generate tick marks based on width
  useEffect(() => {
    const cmInPixels = 37.8 // 1cm = 37.8 pixels
    const totalCm = Math.floor(width / cmInPixels)
    const totalTicks = totalCm * 10 // 10 ticks per cm (mm)
    const marks = Array.from({ length: totalTicks + 1 }, (_, i) => i)
    setTickMarks(marks)
  }, [width])

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

    // Use left-top corner as pivot point
    const pivotX = rect.left
    const pivotY = rect.top

    // Calculate initial mouse angle relative to pivot point
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
      // Calculate current mouse angle relative to the original pivot point
      const currentAngle = Math.atan2(
        e.clientY - startRef.current.pivotY,
        e.clientX - startRef.current.pivotX
      )

      // Calculate new rotation based on the initial angle
      const newRotation =
        (currentAngle - startRef.current.angle) * (180 / Math.PI)
      setRotation(newRotation)
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  // Get tick height based on type
  const getTickHeight = (index: number) => {
    if (index % 10 === 0) return 20 // Centimeter marks (tallest)
    if (index % 5 === 0) return 14 // Half-centimeter marks
    return 8 // Millimeter marks (shortest)
  }

  // Get tick color based on type
  const getTickColor = (index: number) => {
    if (index % 10 === 0) return 'bg-gray-900' // Centimeter marks - darkest
    if (index % 5 === 0) return 'bg-gray-800' // Half-centimeter marks
    return 'bg-gray-700' // Millimeter marks
  }

  // Calculate position for each tick
  const getTickPosition = (index: number) => {
    const cmInPixels = 37.8
    return (index * cmInPixels) / 10
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
          // Apply transform-origin to rotate from left-top corner
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'left top',
          pointerEvents: 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Ruler Body with realistic look */}
        <div
          className='relative h-28 rounded-xl 
  bg-[#05FF29]/10 
  backdrop-blur-sm 
  border-[2.5px] border-black 
  shadow-2xl 
  flex items-center overflow-hidden'
        >
          {/* Top edge highlight */}
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent'></div>

          {/* Millimeter and Centimeter Tick Marks */}
          <div className='absolute top-0 left-0 h-full w-full flex'>
            {tickMarks.map(tick => {
              const isCm = tick % 10 === 0
              const isHalfCm = tick % 5 === 0
              const position = getTickPosition(tick)

              // Add 20px margin to the left for the first few ticks
              const RIGHT_PADDING = 30
              const adjustedPosition = position + 20

              return (
                <div
                  key={tick}
                  className='absolute flex flex-col items-center'
                  style={{
                    left: `${adjustedPosition}px`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {/* Top tick mark */}
                  <div
                    className={`w-[1.2px] ${getTickColor(tick)}`}
                    style={{ height: `${getTickHeight(tick)}px` }}
                  />

                  {/* Centimeter numbers */}
                  {isCm && (
                    <div className='mt-1 text-xs font-bold text-gray-900 tracking-tight'>
                      {tick / 10}
                    </div>
                  )}

                  {/* Bottom tick mark (mirrored) */}
                  <div
                    className={`absolute bottom-0 w-[1.2px] ${getTickColor(
                      tick
                    )}`}
                    style={{
                      height: `${getTickHeight(tick)}px`,
                      transform: 'translateY(100%)'
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Center line indicator */}
          <div className='absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-600/80 transform -translate-x-1/2'></div>

          {/* Angle display with professional look */}
          <div className='absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900/90 px-4 py-2 rounded-lg border border-gray-800 shadow-lg'>
            <div className='text-sm font-bold text-white flex items-center gap-2'>
              <span className='text-gray-300'>⟳</span>
              <span>{Math.round(rotation)}°</span>
            </div>
          </div>

          {/* Scale indicator */}
          <div className='absolute top-2 left-1/2 transform -translate-x-1/2 bg-gray-900/80 px-3 py-1 rounded text-xs font-medium text-white'>
            1:1 Scale
          </div>

          {/* Close Button with better styling */}
          <button
            className='absolute left-6 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-900 border-2 border-gray-700 text-white text-sm font-bold flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95'
            onClick={() => setShowRuler(false)}
          >
            ×
          </button>

          {/* Resize Handle - professional design */}
          <div
            onMouseDown={onResizeStart}
            className='absolute right-8 top-1/2 -translate-y-1/2 w-3 h-16 rounded bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 cursor-ew-resize hover:from-gray-700 hover:to-gray-800 transition-all shadow-inner flex items-center justify-center group'
            title='Resize'
          >
            <div className='w-0.5 h-10 bg-gray-600/50 rounded'></div>
            <div className='absolute -right-6 text-xs font-medium text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap'>
              {Math.round(width / 37.8)} cm
            </div>
          </div>

          {/* Rotate Handle - professional design */}
          <div
            onMouseDown={onRotateStart}
            className='absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 cursor-pointer flex items-center justify-center text-white hover:text-gray-200 hover:from-gray-700 hover:to-gray-800 transition-all shadow-lg group'
            title='Rotate'
          >
            <span className='text-lg'>⟳</span>
            <div className='absolute -right-10 text-xs font-medium text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap'>
              Rotate
            </div>
          </div>

          {/* Bottom edge shadow */}
          <div className='absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-900/20 to-transparent'></div>
        </div>
      </div>
    </div>
  )
}

export default Ruler
