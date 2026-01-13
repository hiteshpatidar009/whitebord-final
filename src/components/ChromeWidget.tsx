import React, { useState, useEffect } from "react";
import { RotateCcw, Home, Lock, Unlock , CircleX as Cross } from "lucide-react";

interface ChromeWidgetProps {
  id: string;
  x: number;
  y: number;
  locked: boolean;
  onClose: () => void;
  onMove: (x: number, y: number) => void;
  onToggleLock: () => void;
  isDrawing?: boolean;
}

const HOME_URL = "https://www.chrome.com";

const ChromeWidget: React.FC<ChromeWidgetProps> = ({
  x,
  y,
  locked,
  onClose,
  onMove,
  onToggleLock,
  isDrawing = false,
}) => {
  const [url, setUrl] = useState(HOME_URL);
  const [currentUrl, setCurrentUrl] = useState(HOME_URL);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  /* ================= DRAG LOGIC ================= */

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      onMove(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, onMove]);

  /* ================= NAVIGATION ================= */

  const navigate = (value: string) => {
    let finalUrl = value.trim();
    if (!finalUrl.startsWith("http")) {
      finalUrl = `https://www.chrome.com/search?q=${encodeURIComponent(finalUrl)}`;
    }
    setCurrentUrl(finalUrl);
  };

  /* ================= RENDER ================= */

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden"
      style={{
        left: x,
        top: y,
        width: 720,
        height: 420,
        zIndex: locked ? 5 : 50,
        pointerEvents: locked ? 'none' : 'auto',
      }}
    >
      {/* HEADER */}
      <div
        className="bg-gray-100 border-b border-gray-300 px-3 py-2 flex items-center gap-2 cursor-move"
        onMouseDown={handleMouseDown}
      >
        {/* Window controls */}
        <div className="flex gap-1">
          <Cross size={20}  onClick={onClose} className="text-red-500 cursor-pointer" />
          {/* <span className="w-3 h-3 bg-yellow-500 rounded-full" />
          <span className="w-3 h-3 bg-green-500 rounded-full" /> */}
        </div>

        {/* Navigation */}
        <button
          onClick={() => setCurrentUrl(currentUrl + '?t=' + Date.now())}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <RotateCcw size={14} />
        </button>

        <button
          onClick={() => setCurrentUrl(HOME_URL)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <Home size={14} />
        </button>

        {/* Lock/Unlock Button */}
        <button
          onClick={onToggleLock}
          className="p-1 hover:bg-gray-200 rounded"
          style={{ pointerEvents: 'auto' }}
        >
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

        {/* Address Bar */}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate(url)}
          className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-full outline-none"
          placeholder="Search or enter URL"
        />
      </div>

      {/* IFRAME */}
      <iframe
        key={currentUrl}
        src={currentUrl}
        className="w-full"
        style={{ 
          height: "calc(100% - 44px)",
          pointerEvents: isDrawing ? 'none' : 'auto'
        }}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
        title="Chrome Widget"
      />
    </div>
  );
};

export default ChromeWidget;
