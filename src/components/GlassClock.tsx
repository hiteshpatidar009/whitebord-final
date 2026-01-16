import React, { useEffect, useState, useRef } from "react";
import { Moon, Sun, X } from "lucide-react";
import { useWhiteboardStore } from "../store/useWhiteboardStore";

const GlassClock: React.FC = () => {
  const { showTimer, setShowTimer } = useWhiteboardStore();
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(true);
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 150, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX - position.x, startY: e.clientY - position.y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragRef.current = { startX: touch.clientX - position.x, startY: touch.clientY - position.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      setPosition({ x: touch.clientX - dragRef.current.startX, y: touch.clientY - dragRef.current.startY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging]);

  if (!showTimer) return null;

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ left: position.x, top: position.y,  }}
      className={`fixed z-50 
      rounded-2xl px-6 py-3 backdrop-blur-xl
      shadow-lg transition-all duration-300 cursor-pointer
      ${dark
        ? "bg-black/40 text-white border border-white/20"
        : "bg-white/60 text-black border border-black/10"
      }`}
    >
      {/* CLOSE BUTTON */}
      <button
        onClick={() => setShowTimer(false)}
        className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center 
        rounded-full bg-red-400 text-white shadow hover:bg-red-600 transition-colors"
      >
        <X size={16} />
      </button>

      {/* TOGGLE */}
      <button
        onClick={() => setDark(!dark)}
        className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center 
        rounded-full bg-white/70 shadow"
      >
        {dark ? <Sun className="text-black" size={16} /> : <Moon size={16} />}
      </button>

      {/* TIME */}
      <div className="text-3xl font-semibold tracking-wide text-center">
        {time}
      </div>

      {/* DATE */}
      <div className="mt-1 text-sm font-medium text-center opacity-90">
        {date}
      </div>
    </div>
  );
};

export default GlassClock;
