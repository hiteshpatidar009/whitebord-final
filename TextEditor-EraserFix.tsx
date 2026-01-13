import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import type { TextObject } from '../types/index';
import { Bold, Italic, Underline, Trash2, Move, Minus, Plus } from 'lucide-react';
import { FONTS } from './TextToolbar';

interface TextEditorProps {
  item: TextObject;
  stageScale: number;
  stagePos: { x: number; y: number };
  isActive: boolean;
  tool: string;
  onActivate: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TextObject>) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.PointerEvent | React.MouseEvent, id: string) => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({
  item,
  stageScale,
  stagePos,
  isActive,
  tool,
  onActivate,
  onUpdate,
  onDelete,
  onDragStart,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevActiveRef = useRef(isActive);
  const [resizing, setResizing] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, initialX: 0, initialY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, itemX: 0, itemY: 0 });
  const deletedRef = useRef(false);

  // Calculate screen position
  const screenX = item.x * stageScale + stagePos.x;
  const screenY = item.y * stageScale + stagePos.y;

  // Memoized delete handler to prevent multiple calls
  const handleDelete = useCallback(() => {
    if (deletedRef.current) return;
    deletedRef.current = true;
    onDelete(item.id);
  }, [item.id, onDelete]);

  // Reset deleted flag when item changes
  useEffect(() => {
    deletedRef.current = false;
  }, [item.id]);

  // Apply format using execCommand
  const applyFormat = (command: string, value?: string) => {
    if (!contentRef.current) return;
    
    // Save current selection
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    
    // Focus the content first
    contentRef.current.focus();
    
    // Restore selection if it existed
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Apply formatting
    document.execCommand('styleWithCSS', false, 'true');
    const success = document.execCommand(command, false, value);
    
    // If execCommand failed, try alternative approach for bold/italic/underline
    if (!success && ['bold', 'italic', 'underline'].includes(command)) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const selectedText = range.toString();
        
        if (selectedText) {
          const span = document.createElement('span');
          if (command === 'bold') span.style.fontWeight = 'bold';
          if (command === 'italic') span.style.fontStyle = 'italic';
          if (command === 'underline') span.style.textDecoration = 'underline';
          
          try {
            range.surroundContents(span);
          } catch (e) {
            span.innerHTML = selectedText;
            range.deleteContents();
            range.insertNode(span);
          }
        }
      }
    }
    
    // Ensure focus remains
    contentRef.current.focus();
  };

  const updateFontSize = (delta: number) => {
      const newSize = Math.max(12, Math.min(72, item.fontSize + delta));
      onUpdate(item.id, { fontSize: newSize });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!contentRef.current || deletedRef.current) return;
    
    // If the new focus target is within the toolbar, do NOT deactivate
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.text-editor-toolbar')) {
        return;
    }

    const html = contentRef.current.innerHTML;
    
    // If empty on blur, remove the item
    if (!html.trim()) {
        handleDelete();
        return;
    }

    if (html !== item.text) {
      onUpdate(item.id, { text: html });
    }
  };

  // Sync content logic
  useLayoutEffect(() => {
    if (!contentRef.current || deletedRef.current) return;

    // 1. Transition from Active -> Inactive: Save changes
    if (prevActiveRef.current && !isActive) {
        const html = contentRef.current.innerHTML;
        if (html.trim() === '') {
            handleDelete();
        } else if (html !== item.text) {
            onUpdate(item.id, { text: html });
        }
        // Clear selection when exiting edit mode
        window.getSelection()?.removeAllRanges();
    } 
    // 2. Steady Inactive State: Sync from prop if different (External change)
    else if (!isActive && contentRef.current.innerHTML !== item.text) {
        contentRef.current.innerHTML = item.text;
    }

    prevActiveRef.current = isActive;
  }, [item.text, isActive, handleDelete, onUpdate, item.id]);

  // Reset editing state when inactive or tool changes
  useEffect(() => {
    if (!isActive || tool !== 'text') {
        setIsEditing(false);
    }
  }, [isActive, tool]);

  // Focus when active and editing
  useEffect(() => {
      if (isActive && isEditing && contentRef.current && !deletedRef.current) {
          contentRef.current.focus();
      }
  }, [isActive, isEditing]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (deletedRef.current) return;

      // Eraser: Delete entire text object immediately and block canvas
      if (tool === 'eraser') {
          e.stopPropagation();
          e.preventDefault();
          handleDelete();
          return;
      }
      
      const drawingTools = ['pen', 'highlighter', 'selection', 'eyedropper', 'highlighter-eraser'];
      const panTools = ['hand', 'move'];
      
      // Drawing tools: Pass through to canvas (don't interfere with text)
      if (drawingTools.includes(tool)) {
          return;
      }
      
      // Pan tools: Enable dragging ONLY for text objects, not canvas pan
      if (panTools.includes(tool) || tool === 'select') {
          if (e.buttons === 1) {
              e.stopPropagation();
              e.preventDefault();
              onDragStart(e, item.id);
          }
          return;
      }
      
      e.stopPropagation();
      
      // Text tool: Enable editing
      if (tool === 'text') {
          setIsEditing(true);
      } else {
          setIsEditing(false);
      }
      
      onActivate(item.id);
  }, [tool, handleDelete, onDragStart, item.id, onActivate]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
      if (deletedRef.current) return;
      
      // Eraser on mouse enter with button pressed: Delete entire object and block canvas
      if (tool === 'eraser' && e.buttons === 1) {
          e.stopPropagation();
          e.preventDefault();
          handleDelete();
      }
  }, [tool, handleDelete]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (deletedRef.current) return;
    
    if (tool === 'eraser') {
      e.stopPropagation();
      e.preventDefault();
      handleDelete();
    }
  }, [tool, handleDelete]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
      if (deletedRef.current) return;
      
      e.stopPropagation();
      setIsEditing(true);
      onActivate(item.id);
  }, [item.id, onActivate]);

  const handleResizeStart = useCallback((e: React.PointerEvent, direction: string) => {
      if (deletedRef.current) return;
      
      e.preventDefault();
      e.stopPropagation();
      setResizing(direction);
      setResizeStart({
          x: e.clientX,
          y: e.clientY,
          width: item.width || 500,
          height: item.height || 150,
          initialX: item.x,
          initialY: item.y,
      });
  }, [item.width, item.height, item.x, item.y]);

  useEffect(() => {
      if (!resizing || deletedRef.current) return;

      const handlePointerMove = (e: PointerEvent) => {
          if (deletedRef.current) return;
          
          const deltaX = (e.clientX - resizeStart.x) / stageScale;
          const deltaY = (e.clientY - resizeStart.y) / stageScale;

          const payload: any = {};

          if (resizing.includes('w')) {
            const newWidth = Math.max(100, resizeStart.width - deltaX);
            payload.width = newWidth;
            payload.x = resizeStart.initialX + (resizeStart.width - newWidth);
          } else if (resizing.includes('e')) {
            const newWidth = Math.max(100, resizeStart.width + deltaX);
            payload.width = newWidth;
          }

          if (resizing.includes('n')) {
            const newHeight = Math.max(50, resizeStart.height - deltaY);
            payload.height = newHeight;
            payload.y = resizeStart.initialY + (resizeStart.height - newHeight);
          } else if (resizing.includes('s')) {
            const newHeight = Math.max(50, resizeStart.height + deltaY);
            payload.height = newHeight;
          }

          onUpdate(item.id, payload);
      };

      const handlePointerUp = () => {
          setResizing(null);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);

      return () => {
          document.removeEventListener('pointermove', handlePointerMove);
          document.removeEventListener('pointerup', handlePointerUp);
      };
  }, [resizing, resizeStart, stageScale, onUpdate, item.id]);

  // Don't render if deleted
  if (deletedRef.current) {
    return null;
  }

  const toolsToPass = ['pen', 'highlighter', 'selection', 'eyedropper', 'highlighter-eraser'];
  const panTools = ['hand', 'move'];
  const shouldPassThrough = toolsToPass.includes(tool);
  const isPanTool = panTools.includes(tool);

  return (
    <div
      data-type="text"
      className={`absolute ${resizing ? '' : 'transition-none'} rounded`}
      style={{
        left: screenX,
        top: screenY,
        width: item.width ? `${item.width}px` : (isActive ? '500px' : 'auto'),
        maxWidth: (!item.width && !isActive) ? '500px' : 'none',
        height: item.height ? `${item.height}px` : (isActive ? '150px' : 'auto'),
        minWidth: '50px',
        touchAction: 'none',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        userSelect: isPanTool ? 'none' : 'auto',
        transform: `scale(${stageScale})`,
        transformOrigin: 'top left',
        zIndex: shouldPassThrough ? 0 : (isActive ? 50 : 10),
        willChange: 'transform',
      }}
      onMouseEnter={handleMouseEnter}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onDoubleClick={handleDoubleClick}
    >
      {/* Container Border/Background for Active State */}
      <div
        className={`relative p-2 rounded ${
          isActive && isEditing
            ? 'bg-white dark:bg-gray-800 shadow-lg border border-blue-500 ring-1 ring-blue-500' 
            : isActive
            ? 'border border-blue-500'
            : 'border border-transparent hover:border-blue-200'
        }`}
        style={{
          width: (item.width || isActive) ? '100%' : 'auto',
          height: (item.height || isActive) ? '100%' : 'auto',
          overflow: 'visible',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}
      >
        {/* Drag Handle (Only when active) */}
        {isActive && (
          <div
            className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-t flex items-center gap-1 cursor-move select-none"
            onPointerDown={(e) => {
              if (deletedRef.current) return;
              e.preventDefault();
              e.stopPropagation();
              onDragStart(e, item.id);
            }}
            data-drag-handle-id={item.id} 
            style={{ touchAction: 'none' }}
          >
            <Move size={10} />
            <span>Move</span>
          </div>
        )}

        {/* Editable Content */}
        <div
          ref={contentRef}
          contentEditable={isActive && isEditing}
          suppressContentEditableWarning={true}
          className={`outline-none break-words dark:text-white empty:before:content-['Type_here...'] empty:before:text-gray-400 ${isActive && isEditing ? 'cursor-text' : 'cursor-move'}`}
          style={{
            fontFamily: item.fontFamily,
            fontSize: `${item.fontSize}px`,
            color: item.fill,
            fontStyle: item.fontStyle,
            textDecoration: item.textDecoration,
            lineHeight: item.lineHeight || 1.5,
            width: (item.width || isActive) ? '100%' : 'auto',
            height: (item.height || isActive) ? '100%' : 'auto',
            overflow: 'visible',
            boxSizing: 'border-box',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            display: 'block',
            padding: 0,
            margin: 0,
            textAlign: 'left',
            userSelect: isPanTool && !isEditing ? 'none' : 'auto',
            pointerEvents: 'auto',
            position: 'relative',
          }}
          onPointerDown={(e) => {
            if (deletedRef.current) return;
            
            if (tool === 'eraser') {
              e.stopPropagation();
              e.preventDefault();
              handleDelete();
              return;
            }
            if (isPanTool && !isEditing) {
              e.preventDefault();
            }
          }}
          onPointerMove={(e) => {
            if (deletedRef.current) return;
            
            if (tool === 'eraser') {
              e.stopPropagation();
              e.preventDefault();
              handleDelete();
            }
          }}
          onBlur={handleBlur}
          onPaste={handlePaste}
        />

        {/* Resize Handles (Only when active) */}
        {isActive && (
          <>
            {/* Corner Handles */}
            <div
              className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nwse-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'nw')}
              title="Resize"
            />
            <div
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nesw-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'ne')}
              title="Resize"
            />
            <div
              className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nesw-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'sw')}
              title="Resize"
            />
            <div
              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nwse-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'se')}
              title="Resize"
            />

            {/* Edge Handles */}
            <div
              className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-4 h-2.5 bg-blue-500 rounded-sm cursor-ns-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'n')}
              title="Resize height"
            />
            <div
              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-2.5 bg-blue-500 rounded-sm cursor-ns-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 's')}
              title="Resize height"
            />
            <div
              className="absolute top-1/2 transform -translate-y-1/2 -left-1 w-2.5 h-4 bg-blue-500 rounded-sm cursor-ew-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'w')}
              title="Resize width"
            />
            <div
              className="absolute top-1/2 transform -translate-y-1/2 -right-1 w-2.5 h-4 bg-blue-500 rounded-sm cursor-ew-resize hover:bg-blue-600 z-50"
              onPointerDown={(e) => handleResizeStart(e, 'e')}
              title="Resize width"
            />
          </>
        )}

        {/* Contextual Toolbar (Only when active and editing) */}
        {isActive && isEditing && (
          <div 
            className="text-editor-toolbar absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xl flex items-center gap-1 p-1 z-50 whitespace-nowrap max-w-[90vw] overflow-x-auto"
            style={{
              transform: `scale(${1 / stageScale})`,
              transformOrigin: 'top left',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Font Family Selector */}
            <select 
                defaultValue={item.fontFamily} 
                onChange={(e) => applyFormat('fontName', e.target.value)}
                className="wb-prevent-blur h-7 text-xs border rounded px-1 cursor-pointer bg-transparent dark:text-white dark:border-gray-600 focus:outline-none focus:border-blue-500 max-w-[100px]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            {/* Color Picker */}
            <div className="relative flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 overflow-hidden">
                <input
                    type="color"
                    defaultValue={item.fill}
                    onChange={(e) => applyFormat('foreColor', e.target.value)}
                    className="absolute -top-1 -left-1 w-9 h-9 p-0 border-0 cursor-pointer bg-transparent"
                    title="Text Color"
                />
                <div 
                    className="w-4 h-4 rounded-full border border-gray-300 shadow-sm pointer-events-none"
                    style={{ backgroundColor: item.fill }}
                />
            </div>

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>

            <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyFormat('bold');
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
                title="Bold"
            >
                <Bold size={16} />
            </button>
            <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyFormat('italic');
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
                title="Italic"
            >
                <Italic size={16} />
            </button>
            <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyFormat('underline');
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
                title="Underline"
            >
                <Underline size={16} />
            </button>
            
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>

             {/* Size Buttons */}
            <button 
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200 flex items-center justify-center w-8" 
                title="Decrease Size" 
                onClick={() => updateFontSize(-2)}
            >
                <Minus size={14} />
            </button>
            <span className="text-xs text-gray-400 w-6 text-center select-none">{item.fontSize}</span>
            <button 
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200 flex items-center justify-center w-8" 
                title="Increase Size" 
                onClick={() => updateFontSize(2)}
            >
                <Plus size={14} />
            </button>

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>
            
            <button 
                onClick={handleDelete}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded" 
                title="Delete"
            >
                <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};