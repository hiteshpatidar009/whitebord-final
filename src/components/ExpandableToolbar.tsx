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
  Square,
  Globe,
  Dice3,
  Box,
  Plus
} from "lucide-react";
import { useWhiteboardStore } from '../store/useWhiteboardStore';

type ExpandableToolbarProps = {
  visible: boolean;
  onClose: () => void;
};

const ExpandableToolbar: React.FC<ExpandableToolbarProps> = ({ visible, onClose }) => {
  const { setShowRuler, setShowTriangle45 } = useWhiteboardStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleRulerClick = () => {
    console.log('Ruler button clicked');
    setShowRuler(true);
    onClose();
  };

  const handleTriangle45Click = () => {
    console.log('Triangle45 button clicked');
    setShowTriangle45(true);
    onClose();
  };

  const handlePcButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle file upload logic here
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!visible) return null;

  return (
    <div className="fixed -top-0 left-1/2 -translate-x-1/2 z-[999]">
      <div className="w-[90vw] max-w-[1360px] max-h-[64px] overflow-y-auto bg-white rounded-full shadow-lg border px-4 py-2 space-y-6">
        <div className="flex items-center gap-5 overflow-x-auto">
          <button onClick={onClose} className="text-gray-500">
            <Plus size={20} className="rotate-45" />
          </button>
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black text-white text-lg font-semibold">
            Chrome | PC | App
          </div>
          <Pill icon={<Chrome size={18} />} label="Chrome" />
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
        <div className="flex items-center gap-3 overflow-x-auto">
          <button onClick={onClose} className="text-gray-500">
            <Plus size={20} className="rotate-45" />
          </button>
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black text-white text-lg font-semibold">
            GEOMETRY TOOLS
          </div>
          <Pill icon={<Ruler size={18} />} label="Ruler" onClick={handleRulerClick} />
          <Pill icon={<Compass size={18} />} label="Compass" />
          <Pill icon={<Divide size={18} />} label="Divider" />
          <Pill icon={<Square size={18} />} label="Set Square 60°" />
          <Pill icon={<Square size={18} />} label="Set Square 45°" onClick={handleTriangle45Click} />
        </div>
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
