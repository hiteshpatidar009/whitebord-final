import React from 'react'

interface ArmProps {
  rotation: number
  length: number
  side: 'left' | 'right'
  onMouseDown?: (e: React.MouseEvent | React.TouchEvent) => void
  isDrawing?: boolean
}

const DividerArm: React.FC<ArmProps> = ({
  rotation,
  length,
  side,
  onMouseDown,
  // isDrawing = false
}) => {
  return (
    <div
      className='absolute origin-top'
      style={{
        height: length,
        width: 12,
        background: 'linear-gradient(to right, #9ca3af, #d1d5db, #9ca3af)',
        borderRadius: 6,
        transform: `rotate(${rotation}deg)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      {side === 'right' && (
        <div
          className='absolute -bottom-1 left-1/2 w-3 h-3 bg-gray-700 transform -translate-x-1/2'
          style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }}
        />
      )}

      {side === 'left' && (
        <>
          <div
            onMouseDown={onMouseDown}
            onTouchStart={onMouseDown}
            className='absolute -bottom-4 left-1/2 w-8 h-8 z-99 rounded-full border-3 border-white shadow-lg cursor-crosshair'
            style={{
              transform: 'translateX(-50%)',
              backgroundColor: '#a855f7'
            }}
          >
            {/* Pencil tip at exact bottom center */}
            <div className='absolute -bottom-1 left-1/2 w-1 h-2 bg-gray-900 transform -translate-x-1/2' 
                 style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }} />
          </div>
        </>
      )}
    </div>
  )
}

export default DividerArm