import React, { useEffect, useRef, useState } from "react";
import { Settings, Play, Pause, Square, Move, X } from "lucide-react";
import { useWhiteboardStore } from "../store/useWhiteboardStore";

const FloatingStopwatch: React.FC = () => {
  const { showStopwatch, setShowStopwatch } = useWhiteboardStore();

  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState(false);
  const [countdown, setCountdown] = useState(false);
  const [time, setTime] = useState(0);

  const intervalRef = useRef<number | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);

  const pos = useRef({
    x: window.innerWidth / 2 - 160,
    y: window.innerHeight / 2 - 100,
    dx: 0,
    dy: 0,
    dragging: false,
  });

  /* ================= DRAG ================= */
  useEffect(() => {
    if (dragRef.current) {
      dragRef.current.style.left = `${pos.current.x}px`;
      dragRef.current.style.top = `${pos.current.y}px`;
    }
  }, []);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    pos.current.dx = e.clientX - pos.current.x;
    pos.current.dy = e.clientY - pos.current.y;
    pos.current.dragging = true;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!pos.current.dragging) return;
    pos.current.x = e.clientX - pos.current.dx;
    pos.current.y = e.clientY - pos.current.dy;
    if (dragRef.current) {
      dragRef.current.style.left = `${pos.current.x}px`;
      dragRef.current.style.top = `${pos.current.y}px`;
    }
  };

  const onMouseUp = () => {
    pos.current.dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, countdown]);

  const reset = () => {
    setRunning(false);
    setCountdown(false);
    setTime(0);
  };

  /* ================= TIME DIGITS ================= */
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

    const values = [...digits];
    values[index] = (values[index] + delta + 10) % 10;

    const newH = values[0] * 10 + values[1];
    const newM = values[2] * 10 + values[3];
    const newS = values[4] * 10 + values[5];

    setTime(newH * 3600 + newM * 60 + newS);
  };

  if (!showStopwatch) return null;

  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className="fixed z-[100] w-[320px] cursor-grab select-none rounded-2xl  "
      style={{ left: pos.current.x, top: pos.current.y }}
    >
      {/* TOP BAR */}
      <div className="flex justify-center gap-2 py-2">
        <Move className="h-7 w-7 rounded-lg bg-white p-1 text-gray-500 active:cursor-grabbing" />
        <button onClick={() => setShowStopwatch(false)}>
          <X className="h-7 w-7 rounded-lg bg-white p-1 text-gray-500" />
        </button>
      </div>

      {/* BODY */}
      <div className="rounded-b-2xl bg-white px-4 pb-4 pt-3">
        {/* DISPLAY */}
        <div className="flex justify-center gap-1 my-3">
          {digits.map((d, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center">
                {settings && (
                  <button
                    onClick={() => updateDigit(i, 1)}
                    className="mb-1 h-5 w-5 rounded-full bg-lime-500 text-xs text-white"
                  >
                    ▲
                  </button>
                )}

                <div className="flex h-[56px] w-[38px] items-center justify-center rounded-md bg-black text-3xl font-bold text-yellow-300">
                  {d}
                </div>

                {settings && (
                  <button
                    onClick={() => updateDigit(i, -1)}
                    className="mt-1 h-5 w-5 rounded-full bg-lime-500 text-xs text-white"
                  >
                    ▼
                  </button>
                )}
              </div>

              {(i === 1 || i === 3) && (
                <span className="mx-1 flex items-center text-xl font-bold text-black">
                  :
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* CONTROLS */}
        <div className="flex items-center justify-center gap-4 rounded-xl bg-gray-200 py-2">
          <button onClick={reset}>
            <Square size={18} fill="black" stroke="none" />
          </button>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300"
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
              <Pause size={20} fill="black" stroke="none" />
            ) : (
              <Play size={20} fill="black" stroke="none" />
            )}
          </button>

          <button
            onClick={() => {
              setRunning(false);
              setCountdown(false);
              setSettings((s) => !s);
            }}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingStopwatch;
