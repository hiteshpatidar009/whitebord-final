// DividerArm.tsx
import React from 'react'

interface ArmProps {
  rotation: number
  length: number
  side: 'left' | 'right'
  onMouseDown?: (e: React.MouseEvent) => void
  onDrawStart?: (e: React.MouseEvent) => void
  isAdjusting?: boolean
  isDrawing?: boolean
}

const DividerArm: React.FC<ArmProps> = ({
  rotation,
  length,
  side,
  onMouseDown,
  onDrawStart,
  isAdjusting = false,
  isDrawing = false
}) => {
  const handleTipMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click for adjustment
      onMouseDown?.(e)
    } else if (e.button === 2 && side === 'right' && onDrawStart) {
      // Right click for drawing
      e.preventDefault()
      onDrawStart(e)
    }
  }

  return (
    <div
      className='absolute origin-top'
      style={{
        height: length,
        width: 10,
        background: side === 'right' ? '#f3f4f6' : '#e5e7eb',
        borderRadius: 8,
        transform: `rotate(${rotation}deg)`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: side === 'right' ? '1px solid #d1d5db' : 'none'
      }}
    >
      {/* Base tip */}
      <div
        className='absolute bottom-0 left-1/2 w-2 h-4 bg-gray-800 rounded-b-sm'
        style={{ transform: 'translateX(-50%)' }}
      />

      {/* Tip handle */}
      <div
        onMouseDown={handleTipMouseDown}
        onContextMenu={e => e.preventDefault()}
        className={`absolute -bottom-3 left-1/2 w-6 h-6 rounded-full z-30 transition-all duration-150 ${
          side === 'right' ? 'hover:scale-110 active:scale-95' : ''
        }`}
        style={{
          transform: 'translateX(-50%)',
          backgroundColor: isAdjusting
            ? '#3b82f6'
            : side === 'right'
            ? isDrawing
              ? '#10b981'
              : '#ef4444'
            : '#6b7280',
          border: '3px solid white',
          boxShadow: isAdjusting
            ? '0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 8px rgba(0,0,0,0.4)'
            : isDrawing
            ? '0 0 0 3px rgba(16, 185, 129, 0.3), 0 4px 8px rgba(0,0,0,0.4)'
            : '0 4px 8px rgba(0,0,0,0.4)',
          cursor: side === 'right' ? 'context-menu' : 'pointer'
        }}
        title={
          side === 'right'
            ? 'Left-click: adjust tip • Right-click: draw circle'
            : 'Drag to adjust tip position'
        }
      >
        {/* Inner dot */}
        <div
          className='absolute inset-1 bg-white rounded-full'
          style={{
            animation: isAdjusting || isDrawing ? 'pulse 1.5s infinite' : 'none'
          }}
        />

        {/* Tip indicator */}
        <div className='absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-gray-700 bg-white/90 px-2 py-0.5 rounded shadow-sm pointer-events-none'>
          {side === 'right' ? 'Draw tip' : 'Pivot tip'}
        </div>
      </div>

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
