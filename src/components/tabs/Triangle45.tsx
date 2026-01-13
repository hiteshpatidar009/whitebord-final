import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'

const CM_IN_PX = 37.8

const Triangle45: React.FC = () => {
  const { setShowTriangle45 } = useWhiteboardStore()
  const triangleRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 250, y: 250 })
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState(320)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)

  const startRef = useRef({ x: 0, y: 0, size: 0, angle: 0 })
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

    startRef.current.angle =
      Math.atan2(e.clientY - cy, e.clientX - cx) - rotation * (Math.PI / 180)
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

      const angle =
        Math.atan2(e.clientY - cy, e.clientX - cx) - startRef.current.angle

      setRotation((angle * 180) / Math.PI)
    }
  }

  const stopAll = () => {
    setDragging(false)
    setResizing(false)
    setRotating(false)
  }

  const tickHeight = (i: number) => (i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 7)

  return (
    <div
      className='absolute inset-0'
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
          height: size,
          transform: `rotate(${rotation}deg)`,
          pointerEvents: 'auto'
        }}
        className='absolute cursor-grab select-none'
      >
        {/* Triangle body */}
        <div
          className='relative w-full h-full bg-[#B9DEA5]/80 backdrop-blur-sm border-2 border-gray-800 shadow-2xl'
          style={{
            clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
          }}
        >
          {/* Base scale */}
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
          {/* Height scale */}
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
          {/* Angle badge */}
          <div className='absolute left-6 top-24 bg-gray-900/90 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-lg'>
            {Math.round(rotation)}°
          </div>
          {/* 45° marking */}
          <div className='absolute right-12 top-12 text-sm font-bold text-gray-900'>
            45°
          </div>
          {/* Close */}
          <button
            onClick={() => setShowTriangle45(false)}
            className='absolute left-6 top-14 w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center border border-gray-700 hover:bg-gray-900'
          >
            ×
          </button>
          {/* Resize */}
          <div
            onMouseDown={onResizeStart}
            className='absolute right-12 bottom-6 w-14 h-4 bg-gray-900/80 cursor-ew-resize rounded shadow-inner'
            title='Resize'
          />
          {/* Rotate */}
          <div
            onMouseDown={onRotateStart}
            className='absolute right-20 bottom-12 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-gray-800'
            title='Rotate'
          >
            ⟳
          </div>
        </div>
      </div>
    </div>
  )
}

export default Triangle45
