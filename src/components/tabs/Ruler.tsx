import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { useTouchAndMouse } from '../../hooks/useTouchAndMouse'

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
  const [inchMarks, setInchMarks] = useState<number[]>([])

  const startRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    pivotX: 0,
    pivotY: 0
  })
  const { getPointerEvent } = useTouchAndMouse()

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
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    setDragging(true)
    startRef.current.x = pointer.clientX - position.x
    startRef.current.y = pointer.clientY - position.y
  }

  /* ---------------- Resize ---------------- */
  const onResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setResizing(true)
    startRef.current.width = width
    startRef.current.x = pointer.clientX
  }

  /* ---------------- Rotate ---------------- */
  const onRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setRotating(true)
    const rect = rulerRef.current!.getBoundingClientRect()
    const pivotX = rect.left
    const pivotY = rect.top
    const initialAngle = Math.atan2(pointer.clientY - pivotY, pointer.clientX - pivotX)
    startRef.current.angle = initialAngle - rotation * (Math.PI / 180)
    startRef.current.pivotX = pivotX
    startRef.current.pivotY = pivotY
  }

  /* ---------------- Mouse Move ---------------- */
  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    if (dragging) {
      setPosition({
        x: pointer.clientX - startRef.current.x,
        y: pointer.clientY - startRef.current.y
      })
    }

    if (resizing) {
      const delta = pointer.clientX - startRef.current.x
      setWidth(Math.max(250, Math.min(1400, startRef.current.width + delta)))
    }

    if (rotating) {
      const currentAngle = Math.atan2(
        pointer.clientY - startRef.current.pivotY,
        pointer.clientX - startRef.current.pivotX
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
  const getTickColor = (i: number) =>
    i % 10 === 0 ? 'bg-gray-900' : i % 5 === 0 ? 'bg-gray-800' : 'bg-gray-700'

  const getInchTickHeight = (i: number) =>
    i % 4 === 0 ? 16 : i % 2 === 0 ? 11 : 7
  const getInchTickColor = (i: number) =>
    i % 4 === 0 ? 'bg-gray-900' : i % 2 === 0 ? 'bg-gray-700' : 'bg-gray-600'

  return (
    <div
      className='fixed inset-0 z-50'
      onMouseMove={onMouseMove}
      onMouseUp={stopAll}
      onMouseLeave={stopAll}
      onTouchMove={onMouseMove}
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
        <div className='relative h-28 rounded-xl bg-[#05FF29]/10 backdrop-blur-sm border-[2.5px] border-black shadow-2xl flex items-center overflow-hidden'>
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
                    <div className='text-xs font-bold text-gray-900'>
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
                    <div className='text-[11px] font-semibold text-gray-800'>
                      {tick / 4}"
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Center Line */}
          <div className='absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-600/80 -translate-x-1/2' />

          {/* Angle Display */}
          <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/90 px-4 py-2 rounded-lg border border-gray-800 text-white font-bold'>
            {Math.round(rotation)}°
          </div>

          {/* Close */}
          <button
            onClick={() => setShowRuler(false)}
            className='absolute left-6 top-1/2 -translate-y-1/2
             w-7 h-7 rounded-full
             bg-gray-900/80 backdrop-blur-sm
             border border-black
             text-white text-sm font-bold
             flex items-center justify-center
             shadow-lg hover:bg-gray-900'
          >
            ×
          </button>

          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className='absolute right-8 top-1/2 -translate-y-1/2 w-3 h-16 bg-gray-800 border border-black cursor-ew-resize'
          />

          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            onTouchStart={onRotateStart}
            className='absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-900 border border-black flex items-center justify-center text-white cursor-pointer'
          >
            ⟳
          </div>
        </div>
      </div>
    </div>
  )
}

export default Ruler
