import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun, X } from "lucide-react";
import { useWhiteboardStore } from "../store/useWhiteboardStore";

const GlassClock: React.FC = () => {
  const { showTimer, setShowTimer } = useWhiteboardStore();
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(true);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const position = useRef({
    x: window.innerWidth / 2 - 150,
    y: 24,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true;
    offset.current = {
      x: clientX - position.current.x,
      y: clientY - position.current.y,
    };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragging.current || !boxRef.current) return;

    position.current = {
      x: clientX - offset.current.x,
      y: clientY - offset.current.y,
    };

    boxRef.current.style.transform = `translate3d(${position.current.x}px, ${position.current.y}px, 0)`;
  };

  const stopDrag = () => {
    dragging.current = false;
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) =>
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", stopDrag);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, []);

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
      ref={boxRef}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        startDrag(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }}
      className={`fixed z-50 rounded-2xl px-6 py-3 backdrop-blur-xl shadow-lg cursor-grab active:cursor-grabbing
        ${dark
          ? "bg-black/40 text-white border border-white/20"
          : "bg-white/60 text-black border border-black/10"
        }`}
      style={{
        transform: `translate3d(${position.current.x}px, ${position.current.y}px, 0)`,
      }}
    >
      {/* CLOSE */}
      <button
        onClick={() => setShowTimer(false)}
        className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-red-400 text-white shadow hover:bg-red-600"
      >
<X size={16} className=" mx-auto"  />
      </button>

      {/* THEME */}
      <button
        onClick={() => setDark(!dark)}
        className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white/70 shadow"
      >
        {dark ? <Sun size={16} className="text-black mx-auto" /> : <Moon size={16} className="mx-auto" />}
      </button>

      <div className="text-3xl font-semibold text-center">{time}</div>
      <div className="mt-1 text-sm text-center opacity-90">{date}</div>
    </div>
  );
};

export default GlassClock;
