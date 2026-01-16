import { useCallback } from 'react'

export type PointerEvent = {
  clientX: number
  clientY: number
  preventDefault: () => void
  stopPropagation: () => void
}

export const useTouchAndMouse = () => {
  const getPointerEvent = useCallback(
    (e: React.MouseEvent | React.TouchEvent): PointerEvent => {
      const touch = 'touches' in e ? e.touches[0] : null
      return {
        clientX: touch ? touch.clientX : (e as React.MouseEvent).clientX,
        clientY: touch ? touch.clientY : (e as React.MouseEvent).clientY,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation()
      }
    },
    []
  )

  return { getPointerEvent }
}
