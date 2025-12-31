import React from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { Bold, Italic, Underline } from 'lucide-react';

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

  const applyFormat = (command: string) => {
    const editableDiv = document.querySelector('[contentEditable="true"]') as HTMLDivElement;
    if (!editableDiv) return;

    const selection = window.getSelection();
    
    editableDiv.focus();
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    document.execCommand(command, false);
    
    editableDiv.focus();
  };

  // Helper: Update global defaults and current item
  const updateSelection = (updates: any) => {
    if (updates.fontSize) setSize(updates.fontSize);
    if (updates.fill) setColor(updates.fill);

    if (updates.fontFamily || updates.isBold !== undefined || updates.isItalic !== undefined || updates.isUnderline !== undefined) {
        setTextOptions(updates);
    }

    if (selectedId) {
        const item = items.find(i => i.id === selectedId);
        if (item && item.type === 'text') {
            const payload: any = {};
            if (updates.fontSize) payload.fontSize = updates.fontSize;
            if (updates.fill) payload.fill = updates.fill;
            if (updates.fontFamily) payload.fontFamily = FONT_STACKS[updates.fontFamily] || updates.fontFamily;
            
            if (updates.isBold !== undefined || updates.isItalic !== undefined) {
                const isBold = updates.isBold ?? textOptions.isBold;
                const isItalic = updates.isItalic ?? textOptions.isItalic;
                payload.fontStyle = `${isBold ? 'bold ' : ''}${isItalic ? 'italic' : ''}`.trim();
            }
            
            if (updates.isUnderline !== undefined) {
                payload.textDecoration = updates.isUnderline ? 'underline' : '';
            }

            updateItem(selectedId, payload);
        }
    }
  };

  const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="fixed top-9 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 shadow-md rounded-lg px-4 py-2 flex items-center gap-4 z-40 border border-gray-200 dark:border-gray-600 max-w-[95vw] overflow-x-auto">
      <select 
        value={textOptions.fontFamily} 
        onChange={(e) => updateSelection({ fontFamily: e.target.value })}
        className="wb-prevent-blur border rounded px-2 py-1 text-sm cursor-pointer dark:bg-gray-700 dark:text-white dark:border-gray-600"
      >
        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      <div className="flex items-center gap-2 border-r border-gray-200 pr-4 dark:border-gray-600">
        <input
            type="color"
            value={color}
            onChange={(e) => updateSelection({ fill: e.target.value })}
            className="wb-prevent-blur w-8 h-8 p-0 border-0 rounded cursor-pointer bg-transparent"
            title="Text Color"
        />
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-4 dark:border-gray-600">
        <button 
          onClick={() => applyFormat('bold')}
          className={`wb-prevent-blur p-1 rounded ${textOptions.isBold ? 'bg-gray-200 dark:bg-gray-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          onMouseDown={preventBlur}
        >
          <Bold size={16} />
        </button>
        <button 
          onClick={() => applyFormat('italic')}
          className={`wb-prevent-blur p-1 rounded ${textOptions.isItalic ? 'bg-gray-200 dark:bg-gray-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          onMouseDown={preventBlur}
        >
          <Italic size={16} />
        </button>
        <button 
          onClick={() => applyFormat('underline')}
          className={`wb-prevent-blur p-1 rounded ${textOptions.isUnderline ? 'bg-gray-200 dark:bg-gray-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          onMouseDown={preventBlur}
        >
          <Underline size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Size:</span>
        <input 
          type="range" 
          min="12" max="72" 
          value={size} 
          onChange={(e) => updateSelection({ fontSize: parseInt(e.target.value) })}
          className="wb-prevent-blur w-24 cursor-pointer dark:accent-blue-500"
        />
        <span className="text-xs w-6 dark:text-gray-300">{size}px</span>
      </div>
    </div>
  );
};