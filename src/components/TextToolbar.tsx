import React from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';

export const FONTS = [
  'Arial',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Source Sans 3',
  'Raleway',
  'Merriweather',
  'Monotype Corsiva',
  'Dancing Script'
];

export const FONT_STACKS: { [key: string]: string } = {
  'Arial': 'Arial, sans-serif',
  'Roboto': '"Roboto", sans-serif',
  'Open Sans': '"Open Sans", sans-serif',
  'Lato': '"Lato", sans-serif',
  'Montserrat': '"Montserrat", sans-serif',
  'Oswald': '"Oswald", sans-serif',
  'Source Sans 3': '"Source Sans 3", sans-serif',
  'Raleway': '"Raleway", sans-serif',
  'Merriweather': '"Merriweather", serif',
  'Monotype Corsiva': '"Monotype Corsiva", "Brush Script MT", cursive',
  'Dancing Script': '"Dancing Script", cursive'
};

export const TextToolbar: React.FC = () => {
  const { 
    tool, size, setSize, textOptions, setTextOptions, 
    selectedId, items, updateItem, color, setColor
  } = useWhiteboardStore();

  if (tool !== 'text') return null;

  // Create reverse mapping from font stack to font name
  const FONT_STACK_REVERSE: { [key: string]: string } = {};
  Object.entries(FONT_STACKS).forEach(([key, value]) => {
    FONT_STACK_REVERSE[value] = key;
  });

  // Get the currently selected text item's properties
  const selectedItem = selectedId ? items.find(i => i.id === selectedId && i.type === 'text') : null;
  
  // Use selected item properties if available, otherwise use global defaults
  const rawFontFamily = selectedItem ? (selectedItem as any).fontFamily : textOptions.fontFamily;
  const currentFontFamily = FONT_STACK_REVERSE[rawFontFamily] || rawFontFamily;
  const currentSize = selectedItem ? (selectedItem as any).fontSize : size;
  const currentColor = selectedItem ? (selectedItem as any).fill : color;

  // Helper: Update global defaults and current item
  const updateSelection = (updates: any) => {
    if (updates.fontSize !== undefined) setSize(updates.fontSize);
    if (updates.fill !== undefined) setColor(updates.fill);

    if (updates.fontFamily || updates.fontSize !== undefined || updates.fill !== undefined) {
        setTextOptions(updates);
    }

    if (selectedId) {
        const item = items.find(i => i.id === selectedId);
        if (item && item.type === 'text') {
            const payload: any = {};
            if (updates.fontSize !== undefined) payload.fontSize = updates.fontSize;
            if (updates.fill !== undefined) payload.fill = updates.fill;
            if (updates.fontFamily) payload.fontFamily = FONT_STACKS[updates.fontFamily] || updates.fontFamily;

            updateItem(selectedId, payload);
        }
    }
  };

  return (
    <div className="fixed top-9 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 shadow-md rounded-lg px-4 py-2 flex items-center gap-4 z-40 border border-gray-200 dark:border-gray-600 max-w-[95vw] overflow-x-auto">
      <select 
        value={currentFontFamily} 
        onChange={(e) => updateSelection({ fontFamily: e.target.value })}
        className="wb-prevent-blur border rounded px-2 py-1 text-sm cursor-pointer dark:bg-gray-700 dark:text-white dark:border-gray-600"
      >
        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      <div className="flex items-center gap-2 border-r border-gray-200 pr-4 dark:border-gray-600">
        <input
            type="color"
            value={currentColor}
            onChange={(e) => updateSelection({ fill: e.target.value })}
            className="wb-prevent-blur w-8 h-8 p-0 border-0 rounded cursor-pointer bg-transparent"
            title="Text Color"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Size:</span>
        <input 
          type="range" 
          min="12" max="72" 
          value={currentSize} 
          onChange={(e) => updateSelection({ fontSize: parseInt(e.target.value) })}
          className="wb-prevent-blur w-24 cursor-pointer dark:accent-blue-500"
        />
        <span className="text-xs w-6 dark:text-gray-300">{currentSize}px</span>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Double-click text to edit
      </div>
    </div>
  );
};