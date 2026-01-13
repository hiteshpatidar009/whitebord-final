// DividerArm.tsx
import React from 'react'

interface ArmProps {
  angle: number
  length: number
  side: 'left' | 'right'
  onMouseDown?: (e: React.MouseEvent) => void
}

const DividerArm: React.FC<ArmProps> = ({
  angle,
  length,
  side,
  onMouseDown
}) => {
  return (
    <div
      onMouseDown={onMouseDown}
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
    </div>
  )
}

export default DividerArm
