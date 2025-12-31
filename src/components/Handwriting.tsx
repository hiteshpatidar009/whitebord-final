
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

export interface WhiteboardCanvasHandle {
  isEmpty: () => boolean;
  getImage: () => string;
  clear: () => void;
}

interface WhiteboardCanvasProps {
  onStrokeEnd?: () => void;
}

export const WhiteboardCanvas = forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasDrawn,
    getImage: () => {
      return canvasRef.current ? canvasRef.current.toDataURL('image/png') : '';
    },
    clear: () => {
      if (contextRef.current && canvasRef.current) {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasDrawn(false);
      }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const context = canvas.getContext('2d');
    if (context) {
      context.scale(dpr, dpr);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#0f172a';
      context.lineWidth = 3;
      contextRef.current = context;
    }

    const handleResize = () => {
        const newRect = canvas.getBoundingClientRect();
        canvas.width = newRect.width * dpr;
        canvas.height = newRect.height * dpr;
        if (context) {
            context.scale(dpr, dpr);
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#0f172a';
            context.lineWidth = 3;
        }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getPointerPos(e);
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getPointerPos(e);
    contextRef.current?.lineTo(x, y);
    contextRef.current?.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
    if (props.onStrokeEnd) {
      props.onStrokeEnd();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      className="w-full h-full cursor-text touch-none bg-transparent"
      style={{ display: 'block' }}
    />
  );
});

export default WhiteboardCanvas;
