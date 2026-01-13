import React, { useState } from 'react'

const STEP = 1
const PIXELS_PER_UNIT = 40
const INITIAL_RANGE = 10

const NumberLine: React.FC = () => {
  const [xRange, setXRange] = useState(INITIAL_RANGE)
  const [yRange, setYRange] = useState(INITIAL_RANGE)

  return (
    <div className='absolute inset-0 flex items-center justify-center bg-transparent'>
      <div className='relative w-full h-full'>
        {/* ================= X AXIS ================= */}
        <div
          className='absolute left-1/2 top-1/2 h-[2px] bg-black'
          style={{
            width: `${xRange * 2 * PIXELS_PER_UNIT}px`,
            transform: 'translate(-50%, -50%)'
          }}
        />

        {/* X-axis numbers */}
        {Array.from({ length: xRange * 2 + 1 }).map((_, i) => {
          const value = i - xRange
          if (value === 0) return null

          return (
            <div
              key={`x-${value}`}
              className='absolute text-sm text-black'
              style={{
                left: `calc(50% + ${value * PIXELS_PER_UNIT}px)`,
                top: '50%',
                transform: 'translate(-50%, 6px)'
              }}
            >
              {value}
            </div>
          )
        })}

        {/* X-axis extend buttons */}
        <button
          className='absolute right-2 top-1/2 text-lg font-bold'
          style={{ transform: 'translateY(-50%)' }}
          onClick={() => setXRange(r => r + STEP)}
        >
          →
        </button>

        <button
          className='absolute left-2 top-1/2 text-lg font-bold'
          style={{ transform: 'translateY(-50%)' }}
          onClick={() => setXRange(r => r + STEP)}
        >
          ←
        </button>

        {/* ================= Y AXIS ================= */}
        <div
          className='absolute left-1/2 top-1/2 w-[2px] bg-black'
          style={{
            height: `${yRange * 2 * PIXELS_PER_UNIT}px`,
            transform: 'translate(-50%, -50%)'
          }}
        />

        {/* Y-axis numbers */}
        {Array.from({ length: yRange * 2 + 1 }).map((_, i) => {
          const value = yRange - i
          if (value === 0) return null

          return (
            <div
              key={`y-${value}`}
              className='absolute text-sm text-black'
              style={{
                left: '50%',
                top: `calc(50% - ${value * PIXELS_PER_UNIT}px)`,
                transform: 'translate(-6px, -50%)'
              }}
            >
              {value}
            </div>
          )
        })}

        {/* Y-axis extend buttons */}
        <button
          className='absolute left-1/2 top-2 text-lg font-bold'
          style={{ transform: 'translateX(-50%)' }}
          onClick={() => setYRange(r => r + STEP)}
        >
          ↑
        </button>

        <button
          className='absolute left-1/2 bottom-2 text-lg font-bold'
          style={{ transform: 'translateX(-50%)' }}
          onClick={() => setYRange(r => r + STEP)}
        >
          ↓
        </button>

        {/* Origin */}
        <div
          className='absolute w-2 h-2 bg-black rounded-full'
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
    </div>
  )
}

export default NumberLine
