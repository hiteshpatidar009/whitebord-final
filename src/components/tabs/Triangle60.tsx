import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const CM_IN_PX = 37.8

const Triangle60: React.FC = () => {
  const { setShowTriangle60 } = useWhiteboardStore()
  const triangleRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 300, y: 250 })
  const [rotation, setRotation] = useState(-330) // Default -330° rotation
  const [size, setSize] = useState(320)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)

  const startRef = useRef({ x: 0, y: 0, size: 0, rotation: 0, mouseAngle: 0 })
  const [ticks, setTicks] = useState<number[]>([])

  /* --------- Generate scale --------- */
  useEffect(() => {
    const totalCm = Math.floor(size / CM_IN_PX)
    setTicks(Array.from({ length: totalCm * 10 + 1 }, (_, i) => i))
  }, [size])

  /* --------- Drag --------- */
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    startRef.current.x = e.clientX - position.x
    startRef.current.y = e.clientY - position.y
  }

  /* --------- Resize --------- */
  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setResizing(true)
    startRef.current.size = size
    startRef.current.x = e.clientX
  }

  /* --------- Rotate --------- */
  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRotating(true)

    const rect = triangleRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    // Calculate initial mouse angle relative to center
    startRef.current.mouseAngle =
      Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)

    // Store current rotation
    startRef.current.rotation = rotation
  }

  /* --------- Mouse Move --------- */
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - startRef.current.x,
        y: e.clientY - startRef.current.y
      })
    }

    if (resizing) {
      const delta = e.clientX - startRef.current.x
      setSize(Math.max(200, Math.min(700, startRef.current.size + delta)))
    }

    if (rotating) {
      const rect = triangleRef.current!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      // Calculate current mouse angle
      const currentMouseAngle =
        Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)

      // Calculate delta from initial mouse angle
      const deltaAngle = currentMouseAngle - startRef.current.mouseAngle

      // Apply delta to the stored initial rotation
      const newRotation = startRef.current.rotation + deltaAngle
      setRotation(newRotation)
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  // Calculate display rotation (0° to 360° range)
  const displayRotation = ((rotation % 360) + 360) % 360

  const tickHeight = (i: number) => (i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 7)

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
        ref={triangleRef}
        onMouseDown={onDragStart}
        style={{
          left: position.x,
          top: position.y,
          width: size,
          height: size * Math.tan((30 * Math.PI) / 180), // Height for 30-60-90 triangle
          transform: `rotate(${rotation}deg)`, // Apply actual rotation
          pointerEvents: 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Triangle body - 30-60-90 triangle */}
        <div
          className='relative w-full h-full bg-[#B9DEA5]/80 backdrop-blur-sm border-2 border-gray-800 shadow-2xl'
          style={{
            clipPath: 'polygon(0 0, 100% 0, 0 100%)' // Right triangle with 30-60-90 angles
          }}
        >
          {/* Base scale (horizontal) */}
          {ticks.map(i => (
            <div
              key={`base-${i}`}
              className='absolute bottom-0 bg-gray-900'
              style={{
                left: `${(i * CM_IN_PX) / 10}px`,
                width: '1px',
                height: tickHeight(i)
              }}
            />
          ))}

          {/* Height scale (vertical) */}
          {ticks.map(i => (
            <div
              key={`height-${i}`}
              className='absolute left-0 bg-gray-900'
              style={{
                bottom: `${(i * CM_IN_PX) / 10}px`,
                height: '1px',
                width: tickHeight(i)
              }}
            />
          ))}

          {/* CM Numbers (base) */}
          {ticks
            .filter(i => i % 10 === 0)
            .map(i => (
              <span
                key={`num-${i}`}
                className='absolute bottom-4 text-xs font-bold text-gray-900'
                style={{ left: `${i * CM_IN_PX}px` }}
              >
                {i / 10}
              </span>
            ))}

          {/* Angle badge - Show display rotation (0° initially) */}
          <div className='absolute left-16 top-7 bg-gray-900/90 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-lg'>
            {Math.round(displayRotation)}°
          </div>

          {/* 30° marking (at top-left corner) */}
          <div className='absolute left-3 top-3 text-sm font-bold text-gray-900'>
            30°
          </div>

          {/* 60° marking (at bottom-left corner) */}
          <div className='absolute left-3 bottom-3 text-sm font-bold text-gray-900'>
            30°
          </div>

          {/* 90° marking (at right angle) */}
          <div className='absolute right-3 top-3 text-sm font-bold text-gray-900'>
            90°
          </div>

          {/* Square angle indicator */}
          <div className='absolute right-4 top-4 w-4 h-4 border-2 border-gray-900 border-t-0 border-l-0' />

          {/* Close */}
          <button
            onClick={() => setShowTriangle60(false)}
            className='absolute left-8 top-7 w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center border border-gray-700 hover:bg-gray-900'
          >
            ×
          </button>

          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            className='absolute left-7 bottom-10 w-4 h-14 bg-gray-900/80 cursor-ew-resize rounded shadow-inner origin-center'
            style={{ transform: 'rotate(0deg)' }}
            title='Resize'
          />

          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            className='absolute left-12 bottom-11 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-gray-800'
            title='Rotate'
          >
            ⟳
          </div>
        </div>
      </div>
    </div>
  )
}

export default Triangle60
