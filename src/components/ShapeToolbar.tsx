import React from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';

export const ShapeToolbar: React.FC = () => {
  const { items, selectedId, updateItem } = useWhiteboardStore();

  const selectedShape = items.find(i => i.id === selectedId && i.type === 'shape');

  if (!selectedShape || selectedShape.type !== 'shape') return null;

  const handleOpacityChange = (newOpacity: number) => {
    updateItem(selectedId!, { opacity: newOpacity });
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white shadow-md rounded-lg px-4 py-2 flex items-center gap-4 z-40 border border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Transparency</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={selectedShape.opacity ?? 1}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="w-32"
        />
        <span className="text-xs w-12 text-gray-600">{Math.round((selectedShape.opacity ?? 1) * 100)}%</span>
      </div>
    </div>
  );
};
