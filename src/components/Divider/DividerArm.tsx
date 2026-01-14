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
      className='absolute origin-top cursor-pointer'
      style={{
        height: length,
        width: 12,
        background: '#d9d9d9',
        borderRadius: 10,
        transform: `
          rotate(${side === 'left' ? -angle : angle}deg)
        `,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
      }}
    >
      {/* Tip */}
      <div
        className='absolute bottom-0 left-1/2 w-2 h-6 bg-black'
        style={{ transform: 'translateX(-50%)' }}
      />

      {/* Marker tip for right arm only */}
      {side === 'right' && (
        <div
          onMouseDown={onMouseDown}
          className='absolute -bottom-2 left-1/2 w-5 h-5 rounded-full cursor-pointer z-20'
          style={{
            transform: 'translateX(-50%)',
            backgroundColor: isDrawing ? '#dc2626' : '#ef4444',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
        />
      )}
    </div>
  )
}

export default DividerArm
