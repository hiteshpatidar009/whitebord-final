import React from "react";
import {
  Chrome,
  Monitor,
  Smartphone,
  LayoutGrid,
  Camera,
  Ruler,
  Compass,
  Divide,
  Circle,
  Move,
  Globe,
  Dice3,
  Box,
  Plus,
  TriangleRight
} from "lucide-react";
import { useWhiteboardStore } from '../store/useWhiteboardStore';

type ExpandableToolbarProps = {
  visible: boolean;
  onClose: () => void;
  onChromeClick?: () => void;
  onPcClick?: (file: File) => void;
  onBeforePcClick?: () => void;
};

const ExpandableToolbar: React.FC<ExpandableToolbarProps> = ({ visible, onClose, onChromeClick, onPcClick, onBeforePcClick }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { setShowRuler, setShowTriangle45, setShowTriangle60, setShowProtractor } = useWhiteboardStore();

  const handlePcButtonClick = () => {
    if (onBeforePcClick) {
      onBeforePcClick();
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPcClick) {
      onPcClick(file);
    }
    // Reset input so same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!visible) return null;

  return (
    <div className="fixed -top-0  left-1/2 -translate-x-1/2 z-[999]">
      {/* VERTICAL SCROLL CONTAINER */}
      <div className="w-[90vw] max-w-[1360px] max-h-[64px] overflow-y-auto bg-white rounded-full shadow-lg border px-4 py-2 space-y-6">

        {/* ================= SECTION 1 ================= */}
          <div className="flex items-center gap-5 overflow-x-auto ">
            <button onClick={onClose} className="text-gray-500">
              <Plus size={20} className="rotate-45" />
            </button>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black text-white text-lg font-semibold">
            Chrome | PC | App
          </div>
            <Pill icon={<Chrome size={18} />} label="Chrome" onClick={onChromeClick} />
            <Pill icon={<Monitor size={18} />} label="PC" onClick={handlePcButtonClick} />
            <input
              type="file"
              ref={fileInputRef}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileChange}
            />
            <Pill icon={<Smartphone size={18} />} label="App" />
            <Pill icon={<LayoutGrid size={18} />} label="Widget" />
            <Pill icon={<Camera size={18} />} label="Webcam" />
          </div>

        {/* ================= SECTION 2 (GEOMETRY) ================= */}
          <div className="flex items-center gap-3 hide-scrollbar overflow-x-auto ">
            <button onClick={onClose} className="text-gray-500">
              <Plus size={20} className="rotate-45" />
            </button>
            <div className="inline whitespace-nowrap items-center gap-3 px-4  py-2 rounded-full bg-black text-white text-lg font-semibold">
            GEOMETRY TOOLS
          </div>
            <Pill icon={<Ruler size={18} />} label="Ruler" onClick={() => setShowRuler(true)} />
            <Pill icon={<Compass size={18} />} label="Compass" />
            <Pill icon={<Divide size={18} />} label="Divider" />
            <Pill icon={<TriangleRight size={18} />} label="Set Square 60°" onClick={() => setShowTriangle60(true)} />
            <Pill icon={<TriangleRight size={18} />} label="Set Square 45°" onClick={() => setShowTriangle45(true)} />
            <Pill icon={<Circle size={18} />} label="Protactor" onClick={() => setShowProtractor(true)} />
            <Pill icon={<Move size={18} />} label="Number Line" />
          </div>

        {/* ================= SECTION 3 (3D) ================= */}
          <div className="flex items-center gap-3 overflow-x-auto">
            <button onClick={onClose} className="text-gray-500">
              <Plus size={20} className="rotate-45" />
            </button>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black text-white text-lg font-semibold">
            3D & OTHER TOOLS
          </div>
            <Pill icon={<Dice3 size={18} />} label="3D Dice" />
            <Pill icon={<Globe size={18} />} label="3D Globe" />
            <Pill icon={<Box size={18} />} label="3D Box" />
          </div>
        </div>
      </div>
  
  );
};

export default ExpandableToolbar;

/* ================= PILL COMPONENT ================= */

const Pill = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600 transition whitespace-nowrap"
  >
    {icon}
    <span className="text-lg font-medium">{label}</span>
  </button>
);
