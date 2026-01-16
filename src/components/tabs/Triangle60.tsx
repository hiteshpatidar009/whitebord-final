import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { useTouchAndMouse } from '../../hooks/useTouchAndMouse'

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
  const { getPointerEvent } = useTouchAndMouse()

  /* --------- Generate scale --------- */
  useEffect(() => {
    const totalCm = Math.floor(size / CM_IN_PX)
    setTicks(Array.from({ length: totalCm * 10 + 1 }, (_, i) => i))
  }, [size])

  /* --------- Drag --------- */
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    setDragging(true)
    startRef.current.x = pointer.clientX - position.x
    startRef.current.y = pointer.clientY - position.y
  }

  /* --------- Resize --------- */
  const onResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setResizing(true)
    startRef.current.size = size
    startRef.current.x = pointer.clientX
  }

  /* --------- Rotate --------- */
  const onRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.stopPropagation()
    setRotating(true)

    const rect = triangleRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    startRef.current.mouseAngle =
      Math.atan2(pointer.clientY - cy, pointer.clientX - cx) * (180 / Math.PI)

    startRef.current.rotation = rotation
  }

  /* --------- Mouse Move --------- */
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
      setSize(Math.max(200, Math.min(700, startRef.current.size + delta)))
    }

    if (rotating) {
      const rect = triangleRef.current!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const currentMouseAngle =
        Math.atan2(pointer.clientY - cy, pointer.clientX - cx) * (180 / Math.PI)

      const deltaAngle = currentMouseAngle - startRef.current.mouseAngle

      const newRotation = startRef.current.rotation + deltaAngle
      setRotation(newRotation)
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  // Calculate display rotation (0° to 360° range) with 0° at the current position
  const displayRotation = (((rotation + 330) % 360) + 360) % 360

  const tickHeight = (i: number) => (i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 7)

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
        ref={triangleRef}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        style={{
          left: position.x,
          top: position.y,
          width: size,
          height: size * Math.tan((30 * Math.PI) / 180), // Height for 30-60-
          //  triangle
          transform: `rotate(${rotation}deg)`, // Apply actual rotation
          pointerEvents: 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Triangle body - 30-60-90 triangle */}
        <div
          className='relative w-full h-full 
             bg-[#05FF29]/10
             backdrop-blur-sm
             border-[2.5px] border-black 
             shadow-2xl'
          style={{
            clipPath: 'polygon(0 0, 100% 0, 0 100%)'
          }}
        >
          {/* Base scale (horizontal) - Top Edge */}
          {ticks.map(i => (
            <div
              key={`base-${i}`}
              className='absolute top-0 bg-gray-900'
              style={{
                left: `${(i * CM_IN_PX) / 10}px`,
                width: '1px',
                height: tickHeight(i)
              }}
            />
          ))}

          {/* Height scale (vertical) - Left Edge */}
          {ticks
            .filter(
              i => (i * CM_IN_PX) / 10 <= size * Math.tan((30 * Math.PI) / 180)
            )
            .map(i => (
              <div
                key={`height-${i}`}
                className='absolute left-0 bg-gray-900'
                style={{
                  top: `${(i * CM_IN_PX) / 10}px`,
                  height: '1px',
                  width: tickHeight(i)
                }}
              />
            ))}

          {/* CM Numbers (base) - Horizontal Edge (Top) */}
          {ticks
            .filter(i => i % 10 === 0 && i !== 0)
            .map(i => (
              <span
                key={`num-base-${i}`}
                className='absolute top-6 text-xs font-bold text-gray-900 origin-center'
                style={{
                  left: `${(i * CM_IN_PX) / 10}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                {i / 10}
              </span>
            ))}
          <span className='absolute top-6 left-2 text-[10px] font-bold text-gray-900'>
            cm
          </span>

          {/* CM Numbers (height) - Vertical Edge (Left) */}
          {ticks
            .filter(
              i =>
                i % 10 === 0 &&
                i !== 0 &&
                (i * CM_IN_PX) / 10 <= size * Math.tan((30 * Math.PI) / 180)
            )
            .map(i => (
              <span
                key={`num-height-${i}`}
                className='absolute left-6 text-xs font-bold text-gray-900 origin-center'
                style={{
                  top: `${(i * CM_IN_PX) / 10}px`,
                  transform: 'translateY(-50%) rotate(-90deg)'
                }}
              >
                {i / 10}
              </span>
            ))}
          <span
            className='absolute left-6 text-[10px] font-bold text-gray-900 origin-center'
            style={{ top: '10px', transform: 'rotate(-90deg)' }}
          >
            cm
          </span>

          {/* Angle badge - Show display rotation (0° initially) */}
          <div className='absolute left-1/3 top-1/3 bg-gray-900/90 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-lg transform -translate-x-1/2 -translate-y-1/2'>
            {Math.round(displayRotation)}°
          </div>

          {/* 60° marking (at bottom-left corner) */}
          <div className='absolute left-2 bottom-8 text-sm font-bold text-gray-900'>
            60°
          </div>

          {/* 30° marking (at top-right) */}
          <div className='absolute right-12 top-2 text-sm font-bold text-gray-900'>
            30°
          </div>

          {/* Square angle indicator */}
          <div className='absolute left-0 top-0 w-4 h-4 border-2 border-gray-900 border-t-0 border-l-0' />

          {/* Close */}
          <button
            onClick={() => setShowTriangle60(false)}
            className='absolute left-12 bottom-24 h-7 w-7 rounded-full
             bg-gray-800 text-white flex items-center justify-center
             border border-gray-700 shadow-md
             hover:bg-gray-900 hover:scale-110 active:scale-95'
            title='Close'
          >
            ×
          </button>

          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className='absolute right-12 top-[-10px] w-4 h-14 cursor-ew-resize rounded bg-gray-900/80 shadow-inner origin-center'
            style={{ transform: 'rotate(90deg)' }}
            title='Resize'
          />

          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            onTouchStart={onRotateStart}
            className='absolute left-12 bottom-12 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-gray-800'
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
