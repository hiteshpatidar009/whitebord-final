import React, { useState, useEffect } from "react";
import { RotateCcw, RotateCw, Home, Lock, Unlock } from "lucide-react";

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
    if (locked) return;
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
        className={`border-b border-gray-300 px-3 py-2 flex items-center gap-3 ${locked ? 'bg-gray-200 cursor-default' : 'bg-gray-100 cursor-move'}`}
        onMouseDown={handleMouseDown}
      >
        {/* Window controls */}
        <div className="flex gap-1.5 mr-1">
          <button
            onClick={onClose}
            className="w-3.5 h-3.5 bg-red-500 rounded-full hover:bg-red-600 transition-colors shadow-sm"
            title="Close Widget"
          />
        </div>

        {/* Lock/Unlock Toggle */}
        <button
          onClick={onToggleLock}
          className={`p-1.5 rounded-md flex items-center justify-center transition-all duration-200 border ${locked
            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          title={locked ? "Widget is Locked (Click to Unlock)" : "Widget is Unlocked (Click to Lock)"}
        >
          {locked ? <Lock size={16} strokeWidth={2.5} /> : <Unlock size={16} strokeWidth={2.5} />}
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1"></div>

        {/* Navigation */}
        <button
          onClick={() => setCurrentUrl(currentUrl)}
          className="p-1.5 hover:bg-white rounded-md text-gray-700 transition-colors"
          title="Refresh"
          disabled={locked}
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={() => setCurrentUrl(HOME_URL)}
          className="p-1.5 hover:bg-white rounded-md text-gray-700 transition-colors"
          title="Home"
          disabled={locked}
        >
          <Home size={16} />
        </button>

        {/* Address Bar */}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate(url)}
          className={`flex-1 px-3 py-1.5 text-sm border rounded-full outline-none transition-all ${locked
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
            }`}
          placeholder="Search or enter URL"
          readOnly={locked}
        />
      </div>

      {/* IFRAME */}
      <iframe
        key={currentUrl}
        src={currentUrl}
        className="w-full"
        style={{
          height: "calc(100% - 44px)",
          pointerEvents: (isDrawing || locked) ? 'none' : 'auto'
        }}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
        title="Chrome Widget"
      />
    </div>
  );
};

export default ChromeWidget;
