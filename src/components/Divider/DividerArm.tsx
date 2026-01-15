// DividerArm.tsx
import React from 'react'

interface ArmProps {
  angle: number
  length: number
  side: 'left' | 'right'
  onMouseDown?: (e: React.MouseEvent) => void
  isDrawing?: boolean
}

const DividerArm: React.FC<ArmProps> = ({
  angle,
  length,
  side,
  onMouseDown,
  isDrawing = false
}) => {
  return (
    <div
      className='absolute origin-top'
      style={{
        height: length,
        width: 10,
        background: side === 'right' ? '#f3f4f6' : '#e5e7eb',
        borderRadius: 8,
        transform: `
          rotate(${side === 'left' ? -angle : angle}deg)
        `,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: side === 'right' ? '1px solid #d1d5db' : 'none'
      }}
    >
      {/* Base tip */}
      <div
        className='absolute bottom-0 left-1/2 w-2 h-4 bg-gray-800 rounded-b-sm'
        style={{ transform: 'translateX(-50%)' }}
      />

      {/* Right arm marker tip */}
      {side === 'right' && (
        <div
          onMouseDown={onMouseDown}
          className='absolute -bottom-3 left-1/2 w-6 h-6 rounded-full z-30 transition-all duration-150 hover:scale-110 active:scale-95'
          style={{
            transform: 'translateX(-50%)',
            backgroundColor: isDrawing ? '#10b981' : '#ef4444',
            border: '3px solid white',
            boxShadow: isDrawing
              ? '0 0 0 3px rgba(16, 185, 129, 0.3), 0 4px 8px rgba(0,0,0,0.4)'
              : '0 4px 8px rgba(0,0,0,0.4)',
            cursor: 'crosshair'
          }}
          title='Click and drag to draw arcs'
        >
          {/* Inner dot */}
          <div
            className='absolute inset-1 bg-white rounded-full'
            style={{
              animation: isDrawing ? 'pulse 1.5s infinite' : 'none'
            }}
          ></div>
        </div>
      )}

      {/* Left arm fixed indicator */}
      {side === 'left' && (
        <div
          className='absolute -bottom-2 left-1/2 w-4 h-4 bg-gray-600 rounded-full border-2 border-white'
          style={{ transform: 'translateX(-50%)' }}
          title='Fixed pivot'
        />
      )}

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.8;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  )
}

export default DividerArm
