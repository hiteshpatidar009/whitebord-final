import React, { useRef, useState, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/useWhiteboardStore'
import { useTouchAndMouse } from '../../hooks/useTouchAndMouse'

const Protractor: React.FC = () => {
  const { setShowProtractor, addItem, saveHistory } = useWhiteboardStore()
  const ref = useRef<HTMLDivElement>(null)

  // -- Window/Tool State --
  const [position, setPosition] = useState({ x: 300, y: 300 })
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState(400) // Width of the base
  const rOuter = size / 2
  const pivotX = size / 2
  const pivotY = size / 2

  // -- Interaction State --
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  // -- Measurement Arms State --
  // Angles in degrees, 0 is pointing right (3 o'clock), 90 is up, 180 is left.
  const [angle1, setAngle1] = useState(45)
  const [angle2, setAngle2] = useState(135)
  const [draggingArm, setDraggingArm] = useState<1 | 2 | null>(null)
  const [measurementLines, setMeasurementLines] = useState<{
    arm1: { startX: number, startY: number, endX: number, endY: number, angle: number } | null
    arm2: { startX: number, startY: number, endX: number, endY: number, angle: number } | null
  }>({ arm1: null, arm2: null })
  const [isArcDrawingMode, setIsArcDrawingMode] = useState(false)
  const [isDarkTheme, setIsDarkTheme] = useState(false)

  const dragStart = useRef({ x: 0, y: 0, initialSize: 0, initialRotation: 0 })
  const lastAngleUpdate = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const { getPointerEvent } = useTouchAndMouse()
  const drawingPoints = useRef<{ [key: number]: number[] }>({ 1: [], 2: [] })
  const currentStrokeId = useRef<{ [key: number]: string | null }>({ 1: null, 2: null })

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  const themeColors = {
    light: {
      protractorBg: 'rgba(5, 255, 41, 0.1)',
      protractorBorder: '#000',
      tickMajor: '#000',
      tickMinor: '#666',
      textOuter: '#333',
      textInner: '#DC2626',
      centerBg: '#FFD700',
      centerText: '#333'
    },
    dark: {
      protractorBg: 'rgba(255, 255, 255, 0.1)',
      protractorBorder: '#FFF',
      tickMajor: '#FFF',
      tickMinor: '#CCC',
      textOuter: '#FFF',
      textInner: '#FFF',
      centerBg: '#4A5568',
      centerText: '#FFF'
    }
  }

  const colors = isDarkTheme ? themeColors.dark : themeColors.light

  /* ================= TOOL TRANSFORM HANDLERS ================= */

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as Element).closest('.protractor-control')) return
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setIsDragging(true)
    dragStart.current = {
      x: pointer.clientX - position.x,
      y: pointer.clientY - position.y,
      initialSize: 0,
      initialRotation: 0
    }
  }

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setIsResizing(true)
    dragStart.current = {
      ...dragStart.current,
      x: pointer.clientX,
      initialSize: size
    }
  }

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setIsRotating(true)
    const cx = position.x + size / 2
    const cy = position.y + size / 2
    const currentAngle =
      Math.atan2(pointer.clientY - cy, pointer.clientX - cx) * (180 / Math.PI)
    dragStart.current = {
      ...dragStart.current,
      initialRotation: rotation - currentAngle
    }
  }

  const handleArmDoubleClick = (armIndex: 1 | 2) => {
    const cx = position.x + size / 2
    const cy = position.y + size / 2
    const currentAngle = armIndex === 1 ? angle1 : angle2
    const rad = (currentAngle * Math.PI) / 180
    const rotRad = (rotation * Math.PI) / 180
    const armLen = rOuter + 100 // Extended line length
    
    // Calculate line endpoints in screen coordinates
    const localX = armLen * Math.cos(-rad)
    const localY = armLen * Math.sin(-rad)
    const endX = cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
    const endY = cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)
    
    const lineData = {
      startX: cx,
      startY: cy,
      endX,
      endY,
      angle: currentAngle
    }
    
    if (armIndex === 1) {
      setMeasurementLines(prev => ({ ...prev, arm1: lineData }))
    } else {
      setMeasurementLines(prev => ({ ...prev, arm2: lineData }))
    }
    
    // Create persistent line item
    const lineColor = armIndex === 1 ? '#2563EB' : '#DC2626'
    addItem({
      type: 'stroke',
      id: `measurement-line-${armIndex}-${Date.now()}`,
      tool: 'pen',
      points: [cx, cy, endX, endY],
      color: lineColor,
      size: 3,
      isEraser: false,
      isHighlighter: false
    } as any)
    saveHistory()
    
    // Check if both arms have measurement lines to enable arc drawing
    if (armIndex === 1 && measurementLines.arm2) {
      setIsArcDrawingMode(true)
    } else if (armIndex === 2 && measurementLines.arm1) {
      setIsArcDrawingMode(true)
    }
  }

  const handleCenterClick = (e: React.MouseEvent) => {
    if (!isArcDrawingMode || !measurementLines.arm1 || !measurementLines.arm2) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const cx = position.x + size / 2
    const cy = position.y + size / 2
    const radius = 60
    
    // Calculate arc between the two angles
    const startAngle = Math.min(measurementLines.arm1.angle, measurementLines.arm2.angle)
    const endAngle = Math.max(measurementLines.arm1.angle, measurementLines.arm2.angle)
    const angleDiff = endAngle - startAngle
    
    // Create arc points
    const arcPoints: number[] = []
    const steps = Math.max(20, Math.floor(angleDiff * 2))
    
    for (let i = 0; i <= steps; i++) {
      const currentAngle = startAngle + (angleDiff * i / steps)
      const rad = (currentAngle * Math.PI) / 180
      const rotRad = (rotation * Math.PI) / 180
      
      const localX = radius * Math.cos(-rad)
      const localY = radius * Math.sin(-rad)
      const x = cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
      const y = cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)
      
      arcPoints.push(x, y)
    }
    
    // Add the arc as a stroke
    addItem({
      type: 'stroke',
      id: `angle-arc-${Date.now()}`,
      tool: 'pen',
      points: arcPoints,
      color: '#10B981',
      size: 3,
      isEraser: false,
      isHighlighter: false
    } as any)
    
    // Add angle text at the middle of the arc
    const midAngle = (startAngle + endAngle) / 2
    const textRadius = radius + 15
    const textRad = (midAngle * Math.PI) / 180
    const rotRad = (rotation * Math.PI) / 180
    
    const textLocalX = textRadius * Math.cos(-textRad)
    const textLocalY = textRadius * Math.sin(-textRad)
    const textX = cx + textLocalX * Math.cos(rotRad) - textLocalY * Math.sin(rotRad)
    const textY = cy + textLocalX * Math.sin(rotRad) + textLocalY * Math.cos(rotRad)
    
    addItem({
      type: 'text',
      id: `angle-text-${Date.now()}`,
      x: textX,
      y: textY,
      text: `${Math.round(angleDiff)}°`,
      fontSize: 14,
      fontFamily: 'Arial',
      color: '#10B981',
      isBold: true,
      isItalic: false,
      textAlign: 'center',
      
    } as any)
    
    saveHistory()
  }

  const handleArmMouseDown = (e: React.MouseEvent | React.TouchEvent, armIndex: 1 | 2) => {
    const pointer = getPointerEvent(e)
    pointer.preventDefault()
    pointer.stopPropagation()
    setDraggingArm(armIndex)
    lastAngleUpdate.current = Date.now()
    
    // Initialize drawing
    const id = `protractor-${armIndex}-${Date.now()}`
    currentStrokeId.current[armIndex] = id
    drawingPoints.current[armIndex] = []
    
    // Get current arm tip position in screen coordinates
    
  }

  /* ================= CALCULATE ANGLE FOR ARM ================= */

  const calculateAngle = (clientX: number, clientY: number): number => {
    const cx = position.x + size / 2
    const cy = position.y + size / 2

    // Calculate vector from pivot to mouse
    const dx = clientX - cx
    const dy = clientY - cy

    // Rotate vector by -rotation to align with protractor
    const rad = -rotation * (Math.PI / 180)
    const localDx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const localDy = dx * Math.sin(rad) + dy * Math.cos(rad)

    // Calculate angle with smoothing
    let deg = Math.atan2(-localDy, localDx) * (180 / Math.PI)
    if (deg < 0) deg += 360

    // Clamp to protractor range (0-180)
    if (deg > 180) {
      // If dragging below, snap to nearest side with some hysteresis
      if (deg > 270) deg = 0
      else deg = 180
    }

    // Apply rounding to reduce jitter
    return Math.round(deg / 0.5) * 0.5 // Round to nearest 0.5 degree
  }

  /* ================= GLOBAL MOUSE HANDLERS ================= */

  // Update measurement lines when protractor moves
  useEffect(() => {
    if (measurementLines.arm1 || measurementLines.arm2) {
      const cx = position.x + size / 2
      const cy = position.y + size / 2
      const rotRad = (rotation * Math.PI) / 180
      const armLen = rOuter + 200
      
      const updatedLines = { ...measurementLines }
      
      if (measurementLines.arm1) {
        const rad = (measurementLines.arm1.angle * Math.PI) / 180
        const localX = armLen * Math.cos(-rad)
        const localY = armLen * Math.sin(-rad)
        const endX = cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
        const endY = cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)
        
        updatedLines.arm1 = {
          ...measurementLines.arm1,
          startX: cx,
          startY: cy,
          endX,
          endY
        }
      }
      
      if (measurementLines.arm2) {
        const rad = (measurementLines.arm2.angle * Math.PI) / 180
        const localX = armLen * Math.cos(-rad)
        const localY = armLen * Math.sin(-rad)
        const endX = cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
        const endY = cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)
        
        updatedLines.arm2 = {
          ...measurementLines.arm2,
          startX: cx,
          startY: cy,
          endX,
          endY
        }
      }
      
      setMeasurementLines(updatedLines)
    }
  }, [position, rotation, size, rOuter])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const touch = 'touches' in e ? e.touches[0] : null
      const clientX = touch ? touch.clientX : (e as MouseEvent).clientX
      const clientY = touch ? touch.clientY : (e as MouseEvent).clientY
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Use requestAnimationFrame for smooth updates
      animationFrameRef.current = requestAnimationFrame(() => {
        if (isDragging) {
          setPosition({
            x: clientX - dragStart.current.x,
            y: clientY - dragStart.current.y
          })
        } else if (isResizing) {
          const delta = clientX - dragStart.current.x
          // Limit size
          const newSize = Math.max(
            200,
            Math.min(800, dragStart.current.initialSize + delta * 2)
          )
          setSize(newSize)
        } else if (isRotating) {
          // Pivot is stable at position + size/2
          const cx = position.x + size / 2
          const cy = position.y + size / 2
          const angle =
            Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI)
          setRotation(angle + dragStart.current.initialRotation)
        } else if (draggingArm) {
          // Throttle angle updates to reduce jitter
          const now = Date.now()
          if (now - lastAngleUpdate.current < 16) {
            // ~60fps
            return
          }
          lastAngleUpdate.current = now

          const newAngle = calculateAngle(clientX, clientY)

          if (draggingArm === 1) {
            setAngle1(newAngle)
          } else {
            setAngle2(newAngle)
          }
          
          // Add drawing point
          const cx = position.x + size / 2
          const cy = position.y + size / 2
          const rad = (newAngle * Math.PI) / 180
          const rotRad = (rotation * Math.PI) / 180
          const armLen = rOuter + 20
          
          const localX = armLen * Math.cos(-rad)
          const localY = armLen * Math.sin(-rad)
          const screenX = cx + localX * Math.cos(rotRad) - localY * Math.sin(rotRad)
          const screenY = cy + localX * Math.sin(rotRad) + localY * Math.cos(rotRad)
          
          drawingPoints.current[draggingArm].push(screenX, screenY)
          
          if (currentStrokeId.current[draggingArm] && drawingPoints.current[draggingArm].length >= 4) {
            const armColor = draggingArm === 1 ? '#2563EB' : '#DC2626'
            addItem({
              type: 'stroke',
              id: currentStrokeId.current[draggingArm]!,
              tool: 'pen',
              points: [...drawingPoints.current[draggingArm]],
              color: armColor,
              size: 2,
              isEraser: false,
              isHighlighter: true
            })
          }
        }
      })
    }

    const handleMouseUp = () => {
      if (draggingArm && currentStrokeId.current[draggingArm] && drawingPoints.current[draggingArm].length >= 4) {
        saveHistory()
      }
      setIsDragging(false)
      setIsResizing(false)
      setIsRotating(false)
      setDraggingArm(null)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [
    isDragging,
    isResizing,
    isRotating,
    draggingArm,
    size,
    rotation,
    position
  ])

  // -- Rendering Helpers --

  // Convert degrees to SVG coordinates (0 at right, 180 at left, counter-clockwise)

  const degToSvg = (deg: number, radius: number) => {
    const rad = (deg * Math.PI) / 180
    return {
      x: pivotX + radius * Math.cos(-rad),
      y: pivotY + radius * Math.sin(-rad)
    }
  }

  // Generate ticks with memoization to prevent unnecessary re-renders
  const renderTicks = React.useMemo(() => {
    const ticks = []
    // Outer scale 0 to 180
    for (let i = 0; i <= 180; i++) {
      const isMajor = i % 10 === 0
      const isMid = i % 5 === 0
      const len = isMajor ? 15 : isMid ? 10 : 5
      const rStart = rOuter - 5
      const rEnd = rStart - len

      const p1 = degToSvg(i, rStart)
      const p2 = degToSvg(i, rEnd)

      ticks.push(
        <line
          key={`tick-${i}`}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={isMajor ? colors.tickMajor : colors.tickMinor}
          strokeWidth={isMajor ? 1.5 : 1}
        />
      )

      // Labels for Outer (0-180 increasing CCW)
      if (isMajor) {
        const pText = degToSvg(i, rEnd - 12)
        ticks.push(
          <text
            key={`label-outer-${i}`}
            x={pText.x}
            y={pText.y}
            fontSize={i === 90 ? 14 : 10}
            fontWeight={i === 90 ? '700' : '600'}
            textAnchor='middle'
            dominantBaseline='middle'
            fill={colors.textOuter}
            transform={`rotate(${90 - i} ${pText.x} ${pText.y})`}
          >
            {i}°
          </text>
        )
      }
    }

    // Inner scale
    const innerRadius = rOuter - 50
    for (let i = 0; i <= 180; i += 10) {
      const val = 180 - i
      if (val !== 90) { // Exclude 90 from inner labels
        const pText = degToSvg(i, innerRadius)
        ticks.push(
          <text
            key={`label-inner-${i}`}
            x={pText.x}
            y={pText.y}
            fontSize={9}
            textAnchor='middle'
            dominantBaseline='middle'
            fill={colors.textInner}
            transform={`rotate(${90 - i} ${pText.x} ${pText.y})`}
          >
            {val}°
          </text>
        )
      }
    }

    return ticks
  }, [rOuter, colors])

  const armLength = rOuter + 40 // Visual arm length
  const pArm1 = degToSvg(angle1, armLength)
  const pArm2 = degToSvg(angle2, armLength)

  const angleDiff = Math.abs(angle1 - angle2)
  const displayAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff

  return (
    <div
      ref={ref}
      className='fixed z-[1000] select-none'
      style={{
        left: position.x,
        top: position.y,
        width: size,
        height: size / 2,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'bottom center',
        pointerEvents: 'none'
      }}
    >
      {/* Main Body */}
      <div
        className='absolute inset-0 cursor-grab active:cursor-grabbing'
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        style={{ pointerEvents: 'auto' }}
      >
        <svg
          width='100%'
          height='100%'
          viewBox={`0 0 ${size} ${size / 2}`}
          style={{ overflow: 'visible' }}
        >
          {/* Background Glass Semicircle */}
          <path
            d={`M 0,${size / 2} A ${size / 2},${size / 2} 0 0,1 ${size},${
              size / 2
            } Z`}
            fill={colors.protractorBg}
            stroke={colors.protractorBorder}
            strokeWidth='2.5'
            className='backdrop-blur-sm'
          />

          {/* Scales */}
          {renderTicks}

          {/* Center 90° Label */}
          <rect
            x={size / 2 - 12}
            y={size / 2 - 25}
            width={24}
            height={16}
            fill={colors.centerBg}
            rx={3}
          />
          <text
            x={size / 2}
            y={size / 2 - 15}
            fontSize={12}
            fontWeight='700'
            textAnchor='middle'
            dominantBaseline='middle'
            fill={colors.centerText}
          >
            90°
          </text>

          {/* Pivot Point */}
          <circle 
            cx={size / 2} 
            cy={size / 2} 
            r={isArcDrawingMode ? 8 : 5} 
            fill={isArcDrawingMode ? '#10B981' : '#000'}
            className={isArcDrawingMode ? 'cursor-pointer protractor-control' : ''}
            onClick={isArcDrawingMode ? handleCenterClick : undefined}
            stroke={isArcDrawingMode ? '#FFF' : 'none'}
            strokeWidth={isArcDrawingMode ? 2 : 0}
          />

          {/* Arm 1 (Blue) */}
          <line
            x1={size / 2}
            y1={size / 2}
            x2={pArm1.x}
            y2={pArm1.y}
            stroke='#2563EB'
            strokeWidth='3'
            strokeLinecap='round'
          />
          {/* Arm 1 Handle - Reduced hover effect to prevent visual noise */}
          <circle
            cx={pArm1.x}
            cy={pArm1.y}
            r={10}
            fill='#2563EB'
            className='cursor-pointer protractor-control transition-opacity duration-100'
            onMouseDown={e => handleArmMouseDown(e, 1)}
            onTouchStart={e => handleArmMouseDown(e, 1)}
            onDoubleClick={() => handleArmDoubleClick(1)}
            stroke='#FFF'
            strokeWidth='2'
          />

          {/* Arm 2 (Red) */}
          <line
            x1={size / 2}
            y1={size / 2}
            x2={pArm2.x}
            y2={pArm2.y}
            stroke='#DC2626'
            strokeWidth='3'
            strokeLinecap='round'
          />
          {/* Arm 2 Handle - Reduced hover effect to prevent visual noise */}
          <circle
            cx={pArm2.x}
            cy={pArm2.y}
            r={10}
            fill='#DC2626'
            className='cursor-pointer protractor-control transition-opacity duration-100'
            onMouseDown={e => handleArmMouseDown(e, 2)}
            onTouchStart={e => handleArmMouseDown(e, 2)}
            onDoubleClick={() => handleArmDoubleClick(2)}
            stroke='#FFF'
            strokeWidth='2'
          />
        </svg>

        {/* Live Angle Display Box */}
        <div className='absolute left-1/2 bottom-2 -translate-x-1/2 bg-gray-900/90 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg pointer-events-none'>
          {displayAngle}°
        </div>
        
        {/* Arc Drawing Mode Indicator */}
        {isArcDrawingMode && (
          <div 
            className='absolute left-1/2 bottom-12 -translate-x-1/2 bg-green-600/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg cursor-pointer animate-pulse'
            onClick={handleCenterClick}
          >
           {` Click center to draw arc ${displayAngle}°`} 
          </div>
        )}
      </div>

      {/* Controls */}

      {/* Theme Toggle Button */}
      <button
        className='absolute -top-4 left-1/4 -translate-x-1/2 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-gray-900 border border-gray-700 protractor-control pointer-events-auto'
        onClick={toggleTheme}
        title={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDarkTheme ? (
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <circle cx='12' cy='12' r='4' />
            <line x1='12' y1='2' x2='12' y2='4' />
            <line x1='12' y1='20' x2='12' y2='22' />
            <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
            <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
            <line x1='2' y1='12' x2='4' y2='12' />
            <line x1='20' y1='12' x2='22' y2='12' />
            <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
            <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
          </svg>
        ) : (
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
          </svg>
        )}
      </button>

      {/* Close Button */}
      <button
        className='absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-gray-900 border border-gray-700 protractor-control pointer-events-auto'
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setShowProtractor(false)
        }}
      >
        ×
      </button>

      {/* Resize Handle */}
      <div
        className='absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-8 h-8 bg-gray-800/80 border-2 border-gray-700 rounded-full cursor-se-resize flex items-center justify-center shadow-lg protractor-control pointer-events-auto hover:bg-gray-900'
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
      >
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke='white'
          strokeWidth='3'
        >
          <path d='M15 3h6v6M9 21H3v-6' />
        </svg>
      </div>

      {/* Rotate Handle */}
      <div
        className='absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-gray-800/80 border-2 border-gray-700 rounded-full cursor-move flex items-center justify-center shadow-lg protractor-control pointer-events-auto hover:bg-gray-900'
        onMouseDown={handleRotateStart}
        onTouchStart={handleRotateStart}
      >
        <svg
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='white'
          strokeWidth='2.5'
        >
          <path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' />
          <path d='M3 3v5h5' />
        </svg>
      </div>
    </div>
  )
}

export default Protractor
