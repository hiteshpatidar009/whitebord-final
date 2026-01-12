import React, { useEffect, useRef, useState } from "react";
import { Settings, Play, Pause , Square, Move, X} from "lucide-react";
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
    x: window.innerWidth / 2 - 180,
    y: window.innerHeight / 2 - 120,
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
      className="stopwatch-wrapper"
      style={{
        position: "fixed",
        zIndex: 100,
        left: pos.current.x,
        top: pos.current.y,
        background: "#b0d56f",
        borderRadius: 24,
        width: 400,
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
    >
      {/* TOP ICONS */}
      <div className="top-icons">
     <Move size={27} className="text-gray-500 cursor-grab h-8 bg-[#fff] p-1 rounded-lg  active:cursor-grabbing" />

        <span className="icon" onClick={() => setShowStopwatch(false)}><X size={24} className="text-gray-500 cursor-grab   bg-[#fff] mt-[0.8px]   active:cursor-grabbing" /></span>
      </div>

      {/* BODY */}
      <div style={{ background: "#fff", borderRadius: "0 0 32px 32px", padding: 24 }}>
        <div className="display">
          {digits.map((d, i) => (
            <React.Fragment key={i}>
              <div className="digit-block">
                {settings && <button onClick={() => updateDigit(i, 1)}>▲</button>}
                <div className="digit">{d}</div>
                {settings && <button onClick={() => updateDigit(i, -1)}>▼</button>}
              </div>
              {(i === 1 || i === 3) && <span className="colon flex justify-center items-center w-7 text-black">:</span>}
            </React.Fragment>
          ))}
        </div>

        {/* CONTROLS */}
        <div className="controls ">
          <button onClick={reset}> <Square size={20} fill="black" stroke="none"  /> </button>

         <button style={{backgroundColor: "#D3D3D3",
    borderRadius: "50%",
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
         }}

  onClick={() => {
    // PAUSE
    if (running) {
      setRunning(false);
      return;
    }

    // START FROM SETTINGS → COUNTDOWN
    if (settings) {
      setCountdown(true);
      setSettings(false);
    }

    // START TIMER
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
          >
              <Settings size={22} fill="black" stroke="lightgray"  />
          </button>

          {/* <button onClick={() => setShowStopwatch(false)}>—</button> */}
        </div>
      </div>
    </div>
  );
};

export default FloatingStopwatch;
