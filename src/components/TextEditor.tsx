// import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
// import { useWhiteboardStore } from '../store/useWhiteboardStore';
// import type { TextObject } from '../types/index';
// import { Bold, Italic, Underline, Trash2, Move, Minus, Plus } from 'lucide-react';
// import { FONTS } from './TextToolbar';

// interface TextEditorProps {
//   item: TextObject;
//   stageScale: number;
//   stagePos: { x: number; y: number };
//   isActive: boolean;
//   tool: string;
//   onActivate: (id: string) => void;
//   onUpdate: (id: string, updates: Partial<TextObject>) => void;
//   onDelete: (id: string) => void;
//   onDragStart: (e: React.PointerEvent | React.MouseEvent, id: string) => void;
// }

// export const TextEditor: React.FC<TextEditorProps> = ({
//   item,
//   stageScale,
//   stagePos,
//   isActive,
//   tool,
//   onActivate,
//   onUpdate,
//   onDelete,
//   onDragStart,
// }) => {
//   const { size } = useWhiteboardStore();
//   const contentRef = useRef<HTMLDivElement>(null);
//   const prevActiveRef = useRef(isActive);
//   const [resizing, setResizing] = useState<string | null>(null);
//   const [isEditing, setIsEditing] = useState(false);
//   const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, initialX: 0, initialY: 0 });
//   const [textImageData, setTextImageData] = useState<string | null>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);

//   // Handle pixel-based erasing
//   const handleErase = (e: React.PointerEvent) => {
//     if (tool !== 'eraser' || !canvasRef.current) return;
    
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
    
//     const rect = canvas.getBoundingClientRect();
//     const x = (e.clientX - rect.left) * (canvas.width / rect.width);
//     const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
//     ctx.globalCompositeOperation = 'destination-out';
//     ctx.beginPath();
//     ctx.arc(x, y, (size || 10) / 2, 0, Math.PI * 2);
//     ctx.fill();
//     ctx.globalCompositeOperation = 'source-over'; // Reset to default
//   };

//   // Render text to canvas when not editing
//   useEffect(() => {
//     if (!canvasRef.current) return;
    
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
    
//     // Clear canvas
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
    
//     // Get text content - from contentRef if editing, otherwise from item.text
//     let textContent = item.text;
//     if (isEditing && contentRef.current) {
//       textContent = contentRef.current.innerText || contentRef.current.textContent || '';
//     }
    
//     if (!textContent.trim()) return;
    
//     // Set font properties
//     ctx.font = `${item.fontStyle || ''} ${item.fontSize}px ${item.fontFamily}`;
//     ctx.fillStyle = item.fill;
//     ctx.textBaseline = 'top';
    
//     // Draw text lines
//     const lines = textContent.split('\n');
//     lines.forEach((line, index) => {
//       ctx.fillText(line, 10, 10 + index * (item.fontSize * (item.lineHeight || 1.5)));
//     });
//   }, [item.text, item.fontSize, item.fontFamily, item.fill, item.fontStyle, item.lineHeight, isEditing]);

//   // Calculate screen position
//   const screenX = item.x * stageScale + stagePos.x;
//   const screenY = item.y * stageScale + stagePos.y;
//   const applyFormat = (command: string, value?: string) => {
//     document.execCommand('styleWithCSS', false, 'true');
//     document.execCommand(command, false, value);
//     if (contentRef.current) {
//         contentRef.current.focus();
//     }
//   };

//   const updateFontSize = (delta: number) => {
//       const newSize = Math.max(12, Math.min(72, item.fontSize + delta));
//       onUpdate(item.id, { fontSize: newSize });
//   };

//   const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
//     const text = e.clipboardData.getData('text/plain');
//     if (text) {
//       e.preventDefault();
//       document.execCommand('insertText', false, text);
//     }
//   };

//   const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
//     if (!contentRef.current) return;
    
//     // If the new focus target is within the toolbar, do NOT deactivate
//     if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.text-editor-toolbar')) {
//         return;
//     }

//     const html = contentRef.current.innerHTML;
    
//     // If empty on blur, remove the item
//     if (!html.trim()) {
//         onDelete(item.id);
//         return;
//     }

//     if (html !== item.text) {
//       onUpdate(item.id, { text: html });
//     }
//   };

//   // Sync content logic
//   useLayoutEffect(() => {
//     if (!contentRef.current) return;

//     // 1. Transition from Active -> Inactive: Save changes
//     if (prevActiveRef.current && !isActive) {
//         const html = contentRef.current.innerHTML;
//         if (html.trim() === '') {
//             onDelete(item.id);
//         } else if (html !== item.text) {
//             onUpdate(item.id, { text: html });
//         }
//         // Clear selection when exiting edit mode
//         window.getSelection()?.removeAllRanges();
//     } 
//     // 2. Steady Inactive State: Sync from prop if different (External change)
//     else if (!isActive && contentRef.current.innerHTML !== item.text) {
//         contentRef.current.innerHTML = item.text;
//     }

//     prevActiveRef.current = isActive;
//   }, [item.text, isActive, onDelete, onUpdate, item.id]);

//   // Reset editing state when inactive or tool changes
//   useEffect(() => {
//     if (!isActive || tool !== 'text') {
//         setIsEditing(false);
//     }
//   }, [isActive, tool]);

//   // Focus when active and editing
//   useEffect(() => {
//       if (isActive && isEditing && contentRef.current) {
//           contentRef.current.focus();
          
//           // Add input listener for real-time canvas updates
//           const handleInput = () => {
//             // Trigger canvas re-render by updating a state or forcing re-render
//             if (canvasRef.current && contentRef.current) {
//               const canvas = canvasRef.current;
//               const ctx = canvas.getContext('2d');
//               if (!ctx) return;
              
//               // Clear canvas
//               ctx.clearRect(0, 0, canvas.width, canvas.height);
              
//               const textContent = contentRef.current.innerText || contentRef.current.textContent || '';
//               if (!textContent.trim()) return;
              
//               // Set font properties
//               ctx.font = `${item.fontStyle || ''} ${item.fontSize}px ${item.fontFamily}`;
//               ctx.fillStyle = item.fill;
//               ctx.textBaseline = 'top';
              
//               // Draw text lines
//               const lines = textContent.split('\n');
//               lines.forEach((line, index) => {
//                 ctx.fillText(line, 10, 10 + index * (item.fontSize * (item.lineHeight || 1.5)));
//               });
//             }
//           };
          
//           contentRef.current.addEventListener('input', handleInput);
          
//           return () => {
//             if (contentRef.current) {
//               contentRef.current.removeEventListener('input', handleInput);
//             }
//           };
//       }
//   }, [isActive, isEditing, item.fontSize, item.fontFamily, item.fill, item.fontStyle, item.lineHeight]);

//   const handlePointerDown = (e: React.PointerEvent) => {
//       // If clicking on canvas, let canvas handle it
//       if (e.target === canvasRef.current) {
//           return;
//       }
      
//       // Eraser: Delete entire text object immediately and block canvas
//       if (tool === 'eraser') {
//           e.stopPropagation();
//           e.preventDefault();
//           onDelete(item.id);
//           return;
//       }
      
//       const drawingTools = ['pen', 'highlighter', 'selection', 'eyedropper', 'highlighter-eraser'];
//       const panTools = ['hand', 'move'];
      
//       // Drawing tools: Pass through to canvas (don't interfere with text)
//       if (drawingTools.includes(tool)) {
//           return;
//       }
      
//       // Pan tools: Enable dragging ONLY for text objects, not canvas pan
//       if (panTools.includes(tool) || tool === 'select') {
//           if (e.buttons === 1) {
//               e.stopPropagation();
//               e.preventDefault();
//               onDragStart(e, item.id);
//           }
//           return;
//       }
      
//       e.stopPropagation();
      
//       // Text tool: Enable editing
//       if (tool === 'text') {
//           setIsEditing(true);
//       } else {
//           setIsEditing(false);
//       }
      
//       onActivate(item.id);
//   };

//   const handleMouseEnter = (e: React.MouseEvent) => {
//       // Only delete on mouse enter if actively dragging (button pressed)
//       if (tool === 'eraser' && e.buttons === 1) {
//           e.stopPropagation();
//           e.preventDefault();
//           onDelete(item.id);
//       }
//   };

//   const handleDoubleClick = (e: React.MouseEvent) => {
//       e.stopPropagation();
//       setIsEditing(true);
//       onActivate(item.id);
//   };

//   const handleResizeStart = (e: React.PointerEvent, direction: string) => {
//       e.preventDefault();
//       e.stopPropagation();
//       setResizing(direction);
//       setResizeStart({
//           x: e.clientX,
//           y: e.clientY,
//           width: item.width || 500,
//           height: item.height || 150,
//           initialX: item.x,
//           initialY: item.y,
//       });
//   };

//   useEffect(() => {
//       if (!resizing) return;

//       const handlePointerMove = (e: PointerEvent) => {
//           const deltaX = (e.clientX - resizeStart.x) / stageScale;
//           const deltaY = (e.clientY - resizeStart.y) / stageScale;

//           const payload: any = {};

//           if (resizing.includes('w')) {
//             const newWidth = Math.max(100, resizeStart.width - deltaX);
//             payload.width = newWidth;
//             payload.x = resizeStart.initialX + (resizeStart.width - newWidth);
//           } else if (resizing.includes('e')) {
//             const newWidth = Math.max(100, resizeStart.width + deltaX);
//             payload.width = newWidth;
//           }

//           if (resizing.includes('n')) {
//             const newHeight = Math.max(50, resizeStart.height - deltaY);
//             payload.height = newHeight;
//             payload.y = resizeStart.initialY + (resizeStart.height - newHeight);
//           } else if (resizing.includes('s')) {
//             const newHeight = Math.max(50, resizeStart.height + deltaY);
//             payload.height = newHeight;
//           }

//           onUpdate(item.id, payload);
//       };

//       const handlePointerUp = () => {
//           setResizing(null);
//       };

//       document.addEventListener('pointermove', handlePointerMove);
//       document.addEventListener('pointerup', handlePointerUp);

//       return () => {
//           document.removeEventListener('pointermove', handlePointerMove);
//           document.removeEventListener('pointerup', handlePointerUp);
//       };
//   }, [resizing, resizeStart, stageScale, onUpdate, item.id]);

//   const toolsToPass = ['pen', 'highlighter', 'selection', 'eyedropper', 'highlighter-eraser'];
//   const panTools = ['hand', 'move'];
//   const shouldPassThrough = toolsToPass.includes(tool);
//   const isPanTool = panTools.includes(tool);

//   return (
//     <div
//       data-type="text"
//       className={`absolute ${resizing ? '' : 'transition-none'} rounded`}
//       style={{
//         left: screenX,
//         top: screenY,
//         width: item.width ? `${item.width}px` : (isActive ? '500px' : 'auto'),
//         maxWidth: (!item.width && !isActive) ? '500px' : 'none',
//         height: item.height ? `${item.height}px` : (isActive ? '150px' : 'auto'),
//         minWidth: '50px',
//         touchAction: 'none', // Prevent default touch behaviors
//         boxSizing: 'border-box',
//         pointerEvents: 'auto',
//         userSelect: isPanTool ? 'none' : 'auto',
//         transform: `scale(${stageScale})`,
//         transformOrigin: 'top left',
//         zIndex: shouldPassThrough ? 0 : (isActive ? 50 : 10),
//         willChange: 'transform', // Optimize for smooth movement
//       }}
//       onMouseEnter={handleMouseEnter}
//       onPointerDown={handlePointerDown}
//       onPointerMove={(e) => {
//         // Only delete on pointer move if actively dragging (button pressed) and NOT on canvas
//         if (tool === 'eraser' && e.buttons === 1 && e.target !== canvasRef.current) {
//           e.stopPropagation();
//           e.preventDefault();
//           onDelete(item.id);
//         }
//       }}
//       onDoubleClick={handleDoubleClick}
//     >
//       {/* Container Border/Background for Active State */}
//       <div
//         className={`relative p-2 rounded ${
//           isActive && isEditing
//             ? 'bg-white dark:bg-gray-800 shadow-lg border border-blue-500 ring-1 ring-blue-500' 
//             : isActive
//             ? 'border border-blue-500'
//             : 'border border-transparent hover:border-blue-200'
//         }`}
//         style={{
//           width: (item.width || isActive) ? '100%' : 'auto',
//           height: (item.height || isActive) ? '100%' : 'auto',
//           overflow: 'visible',
//           boxSizing: 'border-box',
//           pointerEvents: 'auto',
//         }}
//       >
//         {/* Drag Handle (Only when active) */}
//         {isActive && (
//           <div
//             className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-t flex items-center gap-1 cursor-move select-none"
//             onPointerDown={(e) => {
//               e.preventDefault();
//               e.stopPropagation();
//               onDragStart(e, item.id);
//             }}
//             data-drag-handle-id={item.id} 
//             style={{ touchAction: 'none' }}
//           >
//             <Move size={10} />
//             <span>Move</span>
//           </div>
//         )}

//         {/* Text Input for Editing or Canvas for Display */}
//         {isActive && isEditing ? (
//           <div
//             ref={contentRef}
//             contentEditable={true}
//             suppressContentEditableWarning={true}
//             className="outline-none break-words dark:text-white empty:before:content-['Click_to_type...'] empty:before:text-gray-400 cursor-text border border-dashed border-gray-300 dark:border-gray-600 min-h-[40px]"
//             style={{
//               fontFamily: item.fontFamily,
//               fontSize: `${item.fontSize}px`,
//               color: item.fill,
//               fontStyle: item.fontStyle,
//               textDecoration: item.textDecoration,
//               lineHeight: item.lineHeight || 1.5,
//               width: '100%',
//               height: '100%',
//               overflow: 'hidden',
//               boxSizing: 'border-box',
//               wordWrap: 'break-word',
//               overflowWrap: 'break-word',
//               wordBreak: 'break-word',
//               whiteSpace: 'pre-wrap',
//               display: 'block',
//               padding: 10,
//               margin: 0,
//               textAlign: 'left',
//               pointerEvents: 'auto',
//               borderRadius: '4px',
//             }}
//             onBlur={handleBlur}
//             onPaste={handlePaste}
//           />
//         ) : (
//           <canvas
//             ref={canvasRef}
//             width={item.width || 500}
//             height={item.height || 150}
//             className="border border-dashed border-gray-300 dark:border-gray-600 rounded"
//             style={{
//               width: '100%',
//               height: '100%',
//               display: 'block',
//               cursor: tool === 'eraser' ? 'crosshair' : 'pointer',
//             }}
//             onPointerDown={(e) => {
//               if (tool === 'eraser') {
//                 e.stopPropagation();
//                 handleErase(e);
//               } else {
//                 // Allow double-click to edit even when text exists
//                 handleDoubleClick(e);
//               }
//             }}
//             onPointerMove={(e) => {
//               if (tool === 'eraser' && e.buttons === 1) {
//                 e.stopPropagation();
//                 handleErase(e);
//               }
//             }}
//             onDoubleClick={handleDoubleClick}
//           />
//         )}

//         {/* Resize Handles (Only when active) */}
//         {isActive && (
//           <>
//             {/* Corner Handles */}
//             <div
//               className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nwse-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'nw')}
//               title="Resize"
//             />
//             <div
//               className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nesw-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'ne')}
//               title="Resize"
//             />
//             <div
//               className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nesw-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'sw')}
//               title="Resize"
//             />
//             <div
//               className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nwse-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'se')}
//               title="Resize"
//             />

//             {/* Edge Handles */}
//             <div
//               className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-4 h-2.5 bg-blue-500 rounded-sm cursor-ns-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'n')}
//               title="Resize height"
//             />
//             <div
//               className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-2.5 bg-blue-500 rounded-sm cursor-ns-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 's')}
//               title="Resize height"
//             />
//             <div
//               className="absolute top-1/2 transform -translate-y-1/2 -left-1 w-2.5 h-4 bg-blue-500 rounded-sm cursor-ew-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'w')}
//               title="Resize width"
//             />
//             <div
//               className="absolute top-1/2 transform -translate-y-1/2 -right-1 w-2.5 h-4 bg-blue-500 rounded-sm cursor-ew-resize hover:bg-blue-600 z-50"
//               onPointerDown={(e) => handleResizeStart(e, 'e')}
//               title="Resize width"
//             />
//           </>
//         )}

//         {/* Contextual Toolbar (Only when active and editing) */}
//         {isActive && isEditing && (
//           <div 
//             className="text-editor-toolbar absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xl flex items-center gap-1 p-1 z-50 whitespace-nowrap max-w-[90vw] overflow-x-auto"
//             style={{
//               transform: `scale(${1 / stageScale})`,
//               transformOrigin: 'top left',
//             }}
//             onMouseDown={(e) => e.preventDefault()} // Prevent blur
//           >
//             {/* Font Family Selector */}
//             <select 
//                 defaultValue={item.fontFamily} 
//                 onChange={(e) => applyFormat('fontName', e.target.value)}
//                 className="wb-prevent-blur h-7 text-xs border rounded px-1 cursor-pointer bg-transparent dark:text-white dark:border-gray-600 focus:outline-none focus:border-blue-500 max-w-[100px]"
//                 onMouseDown={(e) => e.stopPropagation()}
//             >
//                 {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
//             </select>

//             {/* Color Picker */}
//             <div className="relative flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 overflow-hidden">
//                 <input
//                     type="color"
//                     defaultValue={item.fill}
//                     onChange={(e) => applyFormat('foreColor', e.target.value)}
//                     className="absolute -top-1 -left-1 w-9 h-9 p-0 border-0 cursor-pointer bg-transparent"
//                     title="Text Color"
//                 />
//                 <div 
//                     className="w-4 h-4 rounded-full border border-gray-300 shadow-sm pointer-events-none"
//                     style={{ backgroundColor: item.fill }}
//                 />
//             </div>

//             <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>

//             <button 
//                 onClick={() => applyFormat('bold')}
//                 className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
//                 title="Bold"
//             >
//                 <Bold size={16} />
//             </button>
//             <button 
//                 onClick={() => applyFormat('italic')}
//                 className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
//                 title="Italic"
//             >
//                 <Italic size={16} />
//             </button>
//             <button 
//                 onClick={() => applyFormat('underline')}
//                 className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
//                 title="Underline"
//             >
//                 <Underline size={16} />
//             </button>
            
//             <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>

//              {/* Size Buttons */}
//             <button 
//                 className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200 flex items-center justify-center w-8" 
//                 title="Decrease Size" 
//                 onClick={() => updateFontSize(-2)}
//             >
//                 <Minus size={14} />
//             </button>
//             <span className="text-xs text-gray-400 w-6 text-center select-none">{item.fontSize}</span>
//             <button 
//                 className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200 flex items-center justify-center w-8" 
//                 title="Increase Size" 
//                 onClick={() => updateFontSize(2)}
//             >
//                 <Plus size={14} />
//             </button>

//             <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>
            
//             <button 
//                 onClick={() => onDelete(item.id)}
//                 className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded" 
//                 title="Delete"
//             >
//                 <Trash2 size={16} />
//             </button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const { size } = useWhiteboardStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevActiveRef = useRef(isActive);
  const [resizing, setResizing] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, initialX: 0, initialY: 0 });

  // Handle pixel-based erasing
  const handleErase = (e: React.PointerEvent) => {
    if (tool !== 'eraser' || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, (size || 10) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  // Render text to canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let textContent = item.text;
    if (isEditing && contentRef.current) {
      textContent = contentRef.current.innerText || contentRef.current.textContent || '';
    }
    
    if (!textContent.trim()) return;
    
    ctx.font = `${item.fontStyle || ''} ${item.fontSize}px ${item.fontFamily}`;
    ctx.fillStyle = item.fill;
    ctx.textBaseline = 'top';
    
    const lines = textContent.split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, 10, 10 + index * (item.fontSize * (item.lineHeight || 1.5)));
    });
  }, [item.text, item.fontSize, item.fontFamily, item.fill, item.fontStyle, item.lineHeight, isEditing]);

  // Calculate screen position
  const screenX = item.x * stageScale + stagePos.x;
  const screenY = item.y * stageScale + stagePos.y;

  // Apply format using execCommand
  const applyFormat = (command: string, value?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    if (contentRef.current) {
        contentRef.current.focus();
    }
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
    if (!contentRef.current) return;
    
    // If the new focus target is within the toolbar, do NOT deactivate
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.text-editor-toolbar')) {
        return;
    }

    const html = contentRef.current.innerHTML;
    const textContent = contentRef.current.textContent || contentRef.current.innerText || '';
    
    // Only delete if completely empty (no text content at all)
    if (!textContent.trim()) {
        onDelete(item.id);
        return;
    }

    // Save changes if content has changed
    if (html !== item.text) {
      onUpdate(item.id, { text: html });
    }
    
    // Exit editing mode but keep the text
    setIsEditing(false);
  };

  // Sync content logic
  useLayoutEffect(() => {
    if (!contentRef.current) return;

    // 1. Transition from Active -> Inactive: Save changes
    if (prevActiveRef.current && !isActive) {
        const html = contentRef.current.innerHTML;
        const textContent = contentRef.current.textContent || contentRef.current.innerText || '';
        
        // Only delete if completely empty
        if (!textContent.trim()) {
            onDelete(item.id);
        } else if (html !== item.text) {
            onUpdate(item.id, { text: html });
        }
        // Clear selection when exiting edit mode
        window.getSelection()?.removeAllRanges();
        setIsEditing(false);
    } 
    // 2. Steady Inactive State: Sync from prop if different (External change)
    else if (!isActive && contentRef.current.innerHTML !== item.text) {
        contentRef.current.innerHTML = item.text;
    }
    // 3. Initialize content when becoming active
    else if (!prevActiveRef.current && isActive && contentRef.current.innerHTML !== item.text) {
        contentRef.current.innerHTML = item.text;
    }

    prevActiveRef.current = isActive;
  }, [item.text, isActive, onDelete, onUpdate, item.id]);

  // Reset editing state when inactive or tool changes
  useEffect(() => {
    if (!isActive || tool !== 'text') {
        setIsEditing(false);
    }
  }, [isActive, tool]);

  // Focus when active and editing
  useEffect(() => {
      if (isActive && isEditing && contentRef.current) {
          contentRef.current.focus();
      }
  }, [isActive, isEditing]);

  const handleMouseEnter = (e: React.MouseEvent) => {
      if (tool === 'eraser' && e.buttons === 1) {
          e.stopPropagation();
          onDelete(item.id);
      }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      // If clicking on canvas, let canvas handle it
      if (e.target === canvasRef.current) {
          return;
      }
      
      const drawingTools = ['pen', 'highlighter', 'selection', 'eyedropper', 'highlighter-eraser'];
      const panTools = ['hand', 'move'];
      
      if (tool === 'eraser') {
          e.stopPropagation();
          // Don't delete entire text, let canvas handle pixel erasing
          return;
      }
      
      if (drawingTools.includes(tool)) {
          return;
      }
      
      if (panTools.includes(tool) || tool === 'select') {
          if (e.buttons === 1) {
              e.stopPropagation();
              onDragStart(e, item.id);
          }
          return;
      }
      
      e.stopPropagation();
      
      if (tool === 'text') {
          setIsEditing(true);
      } else {
          setIsEditing(false);
      }
      
      onActivate(item.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      onActivate(item.id);
  };

  const handleResizeStart = (e: React.PointerEvent, direction: string) => {
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
  };

  useEffect(() => {
      if (!resizing) return;

      const handlePointerMove = (e: PointerEvent) => {
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

  const toolsToPass = ['pen', 'highlighter', 'selection', 'eyedropper', 'highlighter-eraser'];
  const panTools = ['hand', 'move'];
  const shouldPassThrough = toolsToPass.includes(tool);
  const isPanTool = panTools.includes(tool);

  return (
    <div
      className={`absolute ${resizing ? '' : 'transition-all duration-200'} rounded`}
      style={{
        left: screenX,
        top: screenY,
        width: item.width ? `${item.width}px` : (isActive ? '500px' : 'auto'),
        maxWidth: (!item.width && !isActive) ? '500px' : 'none',
        height: item.height ? `${item.height}px` : (isActive ? '150px' : 'auto'),
        minWidth: '50px',
        touchAction: 'none',
        boxSizing: 'border-box',
        pointerEvents: shouldPassThrough ? 'none' : 'auto',
        userSelect: isPanTool ? 'none' : 'auto',
        transform: `scale(${stageScale})`,
        transformOrigin: 'top left',
        zIndex: shouldPassThrough ? 0 : (isActive ? 50 : 10), // Lower z-index when drawing
      }}
      onMouseEnter={handleMouseEnter}
      onPointerDown={handlePointerDown}
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
          pointerEvents: shouldPassThrough ? 'none' : 'auto',
        }}
      >
        {/* Drag Handle (Only when active) */}
        {isActive && (
          <div
            className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-t flex items-center gap-1 cursor-move select-none"
            onPointerDown={(e) => onDragStart(e, item.id)}
            data-drag-handle-id={item.id} 
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
          className={`outline-none break-words dark:text-white empty:before:content-['Type_here...'] empty:before:text-gray-400 ${isActive && isEditing ? 'cursor-text border border-dashed border-gray-300 dark:border-gray-600 min-h-[40px] p-2' : 'cursor-move'}`}
          style={{
            fontFamily: item.fontFamily,
            fontSize: `${item.fontSize}px`,
            color: item.fill,
            fontStyle: item.fontStyle,
            textDecoration: item.textDecoration,
            lineHeight: item.lineHeight || 1.5,
            width: (item.width || isActive) ? '100%' : 'auto',
            height: (item.height || isActive) ? '100%' : 'auto',
            overflow: 'hidden',
            boxSizing: 'border-box',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            display: 'block',
            margin: 0,
            textAlign: 'left',
            userSelect: isPanTool && !isEditing ? 'none' : 'auto',
            pointerEvents: (shouldPassThrough || (isPanTool && !isEditing)) ? 'none' : 'auto',
            borderRadius: isActive && isEditing ? '4px' : '0',
          }}
          onMouseDown={(e) => {
            if (isPanTool && !isEditing) {
              e.preventDefault();
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
            onMouseDown={(e) => e.preventDefault()} // Prevent blur
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
                onClick={() => applyFormat('bold')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
                title="Bold"
            >
                <Bold size={16} />
            </button>
            <button 
                onClick={() => applyFormat('italic')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200" 
                title="Italic"
            >
                <Italic size={16} />
            </button>
            <button 
                onClick={() => applyFormat('underline')}
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
                onClick={() => onDelete(item.id)}
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
