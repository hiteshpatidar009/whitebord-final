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
  const { setShowRuler } = useWhiteboardStore();
  
  if (!visible) return null;

  return (
    <div>
      {/* VERTICAL SCROLL CONTAINER */}

        {/* ================= SECTION 1 ================= */}
                 
          <div className="flex items-center gap-5 overflow-x-auto ">

            <button onClick={onClose} className="text-gray-500">
              <Plus size={20} className="rotate-45" />
            </button>

            <div className="inline-flex items-center gap-3 px-4 py-1 rounded-full bg-black text-white text-sm font-semibold">
            Chrome | PC | App
          </div>
            <Pill icon={<Chrome size={18} />} label="Chrome" />
            <Pill icon={<Monitor size={18} />} label="PC" />
            <Pill icon={<Smartphone size={18} />} label="App" />
            <Pill icon={<LayoutGrid size={18} />} label="Widget" />
            <Pill icon={<Camera size={18} />} label="Webcam" />
          </div>
        

        {/* ================= SECTION 2 (GEOMETRY) ================= */}
        
          <div className="flex items-center gap-3 overflow-x-auto ">
            <button onClick={onClose} className="text-gray-500">
              <Plus size={20} className="rotate-45" />
            </button>
            <div className="inline-flex items-center gap-3 px-4 py-1 rounded-full bg-black text-white text-sm font-semibold">
            GEOMETRY TOOLS
          </div>
            <Pill icon={<Ruler size={18} />} label="Ruler" onClick={() => setShowRuler(true)} />
            <Pill icon={<Compass size={18} />} label="Compass" />
            <Pill icon={<Divide size={18} />} label="Divider" />
            <Pill icon={<Square size={18} />} label="Set Square 60°" />
            <Pill icon={<Square size={18} />} label="Set Square 45°" />
          </div>
        

        {/* ================= SECTION 3 (3D) ================= */}
      
          <div className="flex items-center gap-3 overflow-x-auto">
            <button onClick={onClose} className="text-gray-500">
              <Plus size={20} className="rotate-45" />
            </button>
            <div className="inline-flex items-center gap-3 px-4 py-1 rounded-full bg-black text-white text-sm font-semibold">
            3D & OTHER TOOLS
          </div>
            <Pill icon={<Dice3 size={18} />} label="3D Dice" />
            <Pill icon={<Globe size={18} />} label="3D Globe" />
            <Pill icon={<Box size={18} />} label="3D Box" />
          </div>



      </div>
    
  );
};

export default ExpandableToolbar;

/* ================= PILL COMPONENT ================= */

const Pill = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) => (
  <button 
    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600 transition whitespace-nowrap"
    onClick={onClick}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </button>
);
