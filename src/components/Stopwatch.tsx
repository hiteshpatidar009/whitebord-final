import React, { useEffect, useRef, useState } from "react";
import { Settings, Play, Pause, Square, Move, X } from "lucide-react";
import { useWhiteboardStore } from "../store/useWhiteboardStore";

const FloatingStopwatch: React.FC = () => {
  const { showStopwatch, setShowStopwatch } = useWhiteboardStore();

  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState(false);
  const [countdown, setCountdown] = useState(false);
  const [time, setTime] = useState(0);
  const [scale, setScale] = useState(1);

  const intervalRef = useRef<number | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);

  const pos = useRef({
    x: window.innerWidth / 2 - 180,
    y: window.innerHeight / 2 - 150,
    dx: 0,
    dy: 0,
    dragging: false,
    resizing: false,
    startScale: 1,
    startX: 0,
    startY: 0,
  });

  /* ================= DRAG ================= */
  const startDrag = (x: number, y: number) => {
    pos.current.dx = x - pos.current.x;
    pos.current.dy = y - pos.current.y;
    pos.current.dragging = true;
  };

  const move = (x: number, y: number) => {
    if (pos.current.dragging && dragRef.current) {
      pos.current.x = x - pos.current.dx;
      pos.current.y = y - pos.current.dy;
      dragRef.current.style.left = `${pos.current.x}px`;
      dragRef.current.style.top = `${pos.current.y}px`;
    }

    if (pos.current.resizing) {
      const delta = (x - pos.current.startX) / 300;
      const next = Math.min(1.6, Math.max(0.7, pos.current.startScale + delta));
      setScale(next);
    }
  };

  const stopAll = () => {
    pos.current.dragging = false;
    pos.current.resizing = false;
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    const tm = (e: TouchEvent) =>
      move(e.touches[0].clientX, e.touches[0].clientY);

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", stopAll);
    window.addEventListener("touchmove", tm);
    window.addEventListener("touchend", stopAll);

    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", stopAll);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", stopAll);
    };
  }, []);

  /* ================= TIMER ================= */
  useEffect(() => {
    if (!running) return;

    intervalRef.current = window.setInterval(() => {
      setTime((t) => {
        if (countdown) {
          if (t <= 0) {
            setRunning(false);
            setCountdown(false);
            return 0;
          }
          return t - 1;
        }
        return t + 1;
      });
    }, 1000);

    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [running, countdown]);

  const reset = () => {
    setRunning(false);
    setCountdown(false);
    setTime(0);
  };

  /* ================= DIGITS ================= */
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = time % 60;

  const digits = [
    Math.floor(h / 10), h % 10,
    Math.floor(m / 10), m % 10,
    Math.floor(s / 10), s % 10,
  ];

  const updateDigit = (index: number, delta: number) => {
    if (!settings) return;

    const vals = [...digits];
    vals[index] = (vals[index] + delta + 10) % 10;

    const nh = vals[0] * 10 + vals[1];
    const nm = vals[2] * 10 + vals[3];
    const ns = vals[4] * 10 + vals[5];

    setTime(nh * 3600 + nm * 60 + ns);
  };

  const isLastSeconds = countdown && time <= 10 && time > 0 && running;

  if (!showStopwatch) return null;

  return (
    <div
      ref={dragRef}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        startDrag(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }}
      className="fixed z-[100] select-none cursor-grab"
      style={{
        left: pos.current.x,
        top: pos.current.y,
        transform: `scale(${scale})`,
      }}
    >
      <div className="w-[360px] rounded-[30px]  relative">

        {/* TOP BAR */}
        <div className="flex justify-center gap-2 py-3">
          <Move className="h-8 w-8 rounded-xl bg-white shadow-inner p-1 text-gray-500" />
          <button onClick={() => setShowStopwatch(false)}>
            <X className="h-8 w-8 rounded-xl bg-white shadow-inner p-1 text-gray-500" />
          </button>
        </div>

        {/* BODY */}
        <div className=" rounded-2xl bg-gray-100 px-4 pb-5 pt-4 shadow-[inset_0_5px_10px_rgba(0,0,0,0.25)]">

          {/* DISPLAY */}
          <div className="flex justify-center gap-1 my-4 ">
            {digits.map((d, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center ">
                  {settings && (
                    <button
                      onClick={() => updateDigit(i, 1)}
                      className="mb-1 h-5 w-5 rounded-full bg-yellow-300 text-xs text-white"
                    >
                      ▲
                    </button>
                  )}

                  <div
                    className={`flex h-[68px] w-[46px] items-center justify-center rounded-lg text-4xl font-bold shadow-[inset_0_0_14px_rgba(0,255,0,0.5)]
                    ${isLastSeconds ? "bg-red-600 text-white animate-pulse" : "bg-black text-yellow-300"}`}
                  >
                    {d}
                  </div>

                  {settings && (
                    <button
                      onClick={() => updateDigit(i, -1)}
                      className="mt-1 h-5 w-5 rounded-full bg-yellow-300 text-xs text-white"
                    >
                      ▼
                    </button>
                  )}
                </div>

                {(i === 1 || i === 3) && (
                  <span className="mx-1 flex items-center text-2xl font-bold">:</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* CONTROLS */}
          <div className="flex items-center justify-center gap-6 rounded-xl bg-gray-200 py-3 shadow-inner">
            <button onClick={reset} className="bg-white p-3 rounded-full shadow-md">
              <Square size={20} fill="black" stroke="none" />
            </button>

            <button
              className="h-14 w-14 bg-white rounded-full shadow-md flex items-center justify-center"
              onClick={() => {
                if (running) {
                  setRunning(false);
                  return;
                }
                if (settings) {
                  setCountdown(true);
                  setSettings(false);
                }
                setRunning(true);
              }}
            >
              {running ? (
                <Pause size={24} fill="black" stroke="none" />
              ) : (
                <Play size={24} fill="black" stroke="none" />
              )}
            </button>

            <button
              onClick={() => {
                setRunning(false);
                setCountdown(false);
                setSettings((s) => !s);
              }}
              className={`bg-white p-3 rounded-full shadow-md ${settings ? "ring-2 ring-yellow-400" : ""}`}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* RESIZE HANDLE */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            pos.current.resizing = true;
            pos.current.startScale = scale;
            pos.current.startX = e.clientX;
            pos.current.startY = e.clientY;
          }}
          className="absolute bottom-2 right-2 h-4 w-4 cursor-nwse-resize rounded-sm bg-gray-500 opacity-60"
        />
      </div>
    </div>
  );
};

export default FloatingStopwatch;
