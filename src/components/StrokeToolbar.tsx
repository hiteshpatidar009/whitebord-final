import { Trash2, ScanText, Eye, EyeOff, Zap, ZapOff } from 'lucide-react';

interface StrokeToolbarProps {
  onClear: () => void;
  onRecognize: () => void;
  isRecognizing: boolean;
  showText: boolean;
  onToggleView: () => void;
  hasContent: boolean;
  isAutoRecognize: boolean;
  onToggleAutoRecognize: () => void;
}

export function StrokeToolbar({ 
  onClear, 
  onRecognize, 
  isRecognizing, 
  showText, 
  onToggleView,
  hasContent,
  isAutoRecognize,
  onToggleAutoRecognize
}: StrokeToolbarProps) {
  return (
    <div className="flex gap-2 p-2 bg-white rounded-lg shadow-md border border-gray-200">
      <button
        onClick={onClear}
        className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
        title="Clear Canvas"
      >
        <Trash2 size={20} />
      </button>
      
      <div className="w-px bg-gray-200 mx-1" />
      
      <button
        onClick={onRecognize}
        disabled={isRecognizing || !hasContent}
        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
          isRecognizing || !hasContent
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        <ScanText size={20} />
        <span>{isRecognizing ? 'Recognizing...' : 'Recognize'}</span>
      </button>

      <button
        onClick={onToggleAutoRecognize}
        className={`p-2 rounded-md transition-colors ${
          isAutoRecognize ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-700'
        }`}
        title={isAutoRecognize ? "Auto-Recognize On" : "Auto-Recognize Off"}
      >
        {isAutoRecognize ? <Zap size={20} /> : <ZapOff size={20} />}
      </button>

      <div className="w-px bg-gray-200 mx-1" />

      <button
        onClick={onToggleView}
        className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
        title={showText ? "Show Handwriting" : "Show Text"}
      >
        {showText ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
