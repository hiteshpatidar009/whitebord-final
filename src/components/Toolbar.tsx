import React, { useRef, useEffect } from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { v4 as uuidv4 } from 'uuid';
import { 
  Pen, Hand, Eraser, Shapes, Type, Undo, Redo, FileUp, MousePointer2, PenLine, Trash2, Image as ImageIcon, Highlighter, PaintBucket, Maximize2, Upload, X
} from 'lucide-react';
import { COLORS, type ToolType } from '../types';
import * as pdfjsLib from 'pdfjs-dist';


pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const Toolbar: React.FC = () => {
  const { 
    tool, setTool, color, setColor, size, setSize, undo, redo, saveHistory, clear, addItem, backgroundImage, setBackgroundImage, setPdfPages, setCurrentPdfPage, copy, paste,
    textOptions, setSelectedId
  } = useWhiteboardStore();
  
  const handleToolClick = (toolId: ToolType) => {
    setTool(toolId);
    
    if (toolId === 'text') {
      const newId = uuidv4();
      addItem({
        type: 'text',
        id: newId,
        x: window.innerWidth / 2 - 50,
        y: window.innerHeight / 2 - 20,
        text: 'Type here...',
        fontSize: size,
        fontFamily: textOptions.fontFamily,
        fontStyle: `${textOptions.isBold ? 'bold ' : ''}${textOptions.isItalic ? 'italic' : ''}`.trim(),
        textDecoration: textOptions.isUnderline ? 'underline' : '',
        fill: color,
        lineHeight: 1.5
      });
      setSelectedId(newId);
      saveHistory();
    }
  };
  
  const [showBackgroundPicker, setShowBackgroundPicker] = React.useState(false);
  const [uploadedBackgrounds, setUploadedBackgrounds] = React.useState<{id: number, url: string, name: string}[]>([]);
  const [pdfProgress, setPdfProgress] = React.useState<number | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = React.useState(false);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [passwordInput, setPasswordInput] = React.useState('');
  const [pendingAction, setPendingAction] = React.useState<{ type: 'upload' | 'delete', deleteId?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const wasInFullscreenRef = useRef(false);

  const ADMIN_PASSWORD = 'Wboard310193##';

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      setPasswordInput('');
      setShowPasswordModal(false);
      
      if (pendingAction?.type === 'upload') {
        setTimeout(() => bgUploadRef.current?.click(), 0);
      } else if (pendingAction?.type === 'delete' && pendingAction.deleteId) {
        proceedWithDelete(pendingAction.deleteId);
      }
      setPendingAction(null);
    } else {
      alert('Incorrect password');
      setPasswordInput('');
    }
  };

  const proceedWithDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this background?")) return;

    try {
      const res = await fetch('/api/delete_background.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      
      if (data.success) {
        const listRes = await fetch('/api/get_backgrounds.php');
        const listData = await listRes.json();
        if (listData.success) {
          setUploadedBackgrounds(listData.data);
        }
        if (backgroundImage.includes(`id=${id}`)) {
          setBackgroundImage('/default.png');
        }
      } else {
        alert("Delete failed: " + data.message);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed");
    }
  };

  // Initialize default background
  useEffect(() => {
    if (!backgroundImage) {
      setBackgroundImage('/default.png');
    }
  }, [backgroundImage, setBackgroundImage]);

  // Fetch uploaded backgrounds
  useEffect(() => {
    if (showBackgroundPicker) {
      fetch('/api/get_backgrounds.php')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUploadedBackgrounds(data.data);
          }
        })
        .catch(err => console.error("Failed to fetch backgrounds:", err));
    }
  }, [showBackgroundPicker]);



  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload_background.php', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        const listRes = await fetch('/api/get_backgrounds.php');
        const listData = await listRes.json();
        if (listData.success) {
          setUploadedBackgrounds(listData.data);
        }
        alert("Background uploaded successfully!");
      } else {
        alert("Upload failed: " + data.message);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed");
    }
    
    if (bgUploadRef.current) bgUploadRef.current.value = '';
  };

  const handleBackgroundDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAdminAuthenticated) {
      setPendingAction({ type: 'delete', deleteId: id });
      setShowPasswordModal(true);
      return;
    }

    proceedWithDelete(id);
  };

  const handleFullscreen = async () => {
    const element = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        // @ts-ignore - navigationUI is a valid option in newer browsers
        await element.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      } else {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  // Restore fullscreen when window regains focus (e.g. after file picker closes)
  useEffect(() => {
    const handleFocus = () => {
      if (wasInFullscreenRef.current && !document.fullscreenElement) {
        // @ts-ignore
        document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch((err) => {
           // console.log("Could not auto-restore fullscreen on focus (likely needs user gesture):", err);
        });
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (target.closest('[contenteditable="true"]')) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.shiftKey ? redo() : undo();
          e.preventDefault();
        } else if (e.key === 'y') {
          redo();
          e.preventDefault();
        } else if (e.key === 'c') {
          copy();
          e.preventDefault();
        } else if (e.key === 'v') {
          paste();
          e.preventDefault();
        }
      } else {
        switch (e.key.toLowerCase()) {
          case 'p': setTool('pen'); e.preventDefault(); break;
          case 'h': setTool('hand'); e.preventDefault(); break;
          case 'e': setTool('eraser'); e.preventDefault(); break;
          case 's': setTool('shape'); e.preventDefault(); break;
          case 't': handleToolClick('text'); e.preventDefault(); break;
          case 'i': setTool('highlighter'); e.preventDefault(); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo, copy, paste]);

  // --- PDF CONVERSION HELPER ---
  const convertPdfToImages = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const imageDataUrls: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (!context) throw new Error("Could not create canvas context");

      await page.render({ canvasContext: context, viewport: viewport, canvas: canvas }).promise;
      imageDataUrls.push(canvas.toDataURL('image/png'));
      
      const progress = Math.round((pageNum / pdf.numPages) * 100);
      setPdfProgress(progress);
    }
    setPdfProgress(null);
    setPdfPages(imageDataUrls);
    setCurrentPdfPage(0);
    return imageDataUrls;
  };

  // --- FILE IMPORT HANDLER ---
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Restore fullscreen if it was active before file picker
    if (wasInFullscreenRef.current && !document.fullscreenElement) {
      try {
        // @ts-ignore
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      } catch (err) {
        console.error("Failed to restore fullscreen", err);
      }
      wasInFullscreenRef.current = false;
    } else if (document.fullscreenElement) {
       wasInFullscreenRef.current = false;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so the same file can be selected again if needed
    // We do this early to ensure the UI is responsive
    if (fileInputRef.current) fileInputRef.current.value = '';

    let srcList: string[] = [];
    let isPdf = false;

    try {
      if (file.type === 'application/pdf') {
        // Handle PDF - get all pages
        srcList = await convertPdfToImages(file);
        isPdf = true;
      } else if (file.type.startsWith('image/')) {
        // Handle Image
        const src = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        srcList = [src];
      } else {
        alert('Unsupported file type');
        return;
      }

      // Add regular images to Whiteboard (not PDFs)
      if (!isPdf) {
        let yOffset = 50;
        
        srcList.forEach((src) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          // Scale logic
          const maxSize = 600;
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width *= ratio;
            height *= ratio;
          }

          addItem({
            type: 'image',
            id: uuidv4(),
            x: window.innerWidth / 2 - width / 2,
            y: yOffset,
            width: width,
            height: height,
            src: src
          });
          
          yOffset += height + 20;
          saveHistory();
        };
        });
      }
      
      // if (fileInputRef.current) fileInputRef.current.value = ''; // Moved up
    } catch (error) {
      console.error("Import failed:", error);
      setPdfProgress(null);
      alert("Failed to import file. If using PDF, ensure it is not password protected.");
    }
  };

  const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 size={20} />, label: 'Select' },
    { id: 'hand', icon: <Hand size={20} />, label: 'Pan' },
    { id: 'pen', icon: <Pen size={20} />, label: 'Pen' },
    { id: 'handwriting', icon: <PenLine size={20} />, label: 'Handwriting' },
    { id: 'highlighter', icon: <Highlighter size={20} />, label: 'Highlighter' },
    { id: 'highlighter-eraser', icon: <Eraser size={20} color="#ff00ff" />, label: 'Highlighter Eraser' },
    { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser' },
    { id: 'shape', icon: <Shapes size={20} />, label: 'Shape' },
    { id: 'text', icon: <Type size={20} />, label: 'Text' },
    { id: 'fill', icon: <PaintBucket size={20} />, label: 'Fill' },
    
  ];

  const colorOptions = [
    { color: COLORS.black, label: 'Black' },
    { color: COLORS.red, label: 'Red' },
    { color: COLORS.blue, label: 'Blue' },
    { color: COLORS.green, label: 'Green' },
    { color: COLORS.white, label: 'White' },
    { color: COLORS.yellow, label: 'Yellow' },
    { color: COLORS.orange, label: 'Orange' },
    { color: COLORS.purple, label: 'Purple' },
    { color: COLORS.pink, label: 'Pink' },
    { color: COLORS.gray, label: 'Gray' },
    { color: COLORS.brown, label: 'Brown' },
    { color: COLORS.cyan, label: 'Cyan' },
  ];

  return (
    <>
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Admin Authentication</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Enter password to proceed with this action</p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                  setPendingAction(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Loading Progress Bar */}
      {pdfProgress !== null && (
        <div className="fixed bottom-2 left-2 bg-white shadow-lg rounded-lg p-3 border border-gray-200 z-40 w-48">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Loading PDF</span>
            <span className="text-sm font-semibold text-blue-600">{pdfProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pdfProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Desktop: Horizontal toolbar at top */}
      <div className="hidden sm:flex fixed left-1/2 transform -translate-x-1/2 scale-75 origin-top bg-white shadow-lg rounded-full px-6 py-1 flex items-center gap-4 z-50 border border-gray-200">
        {/* Tools */}
        <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => handleToolClick(t.id)}
              className={`p-2 rounded-full transition-colors ${
                tool === t.id 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        {['pen', 'shape', 'text', 'handwriting', 'highlighter', 'fill'].includes(tool) && (
          <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
            {colorOptions.map((c) => (
              <button
                key={c.color}
                onClick={() => setColor(c.color)}
                className={`w-6 h-6 rounded-full border border-gray-300 transition-transform ${
                  color === c.color ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c.color }}
                title={c.label}
              />
            ))}
          </div>
        )}

        {/* Size Slider */}
        {['pen', 'eraser', 'shape', 'handwriting', 'highlighter', 'highlighter-eraser'].includes(tool) && (
          <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
            <span className="text-xs text-gray-500">Size</span>
            <input
              type="range"
              min="1"
              max={tool === 'eraser' ? 150 : tool === 'handwriting' ? 20 : 50}
              value={tool === 'handwriting' ? Math.min(size, 20) : size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={undo} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Undo">
            <Undo size={20} />
          </button>
          
          <button onClick={redo} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Redo">
            <Redo size={20} />
          </button>
          
          <button
            onClick={() => {
              if (document.fullscreenElement) wasInFullscreenRef.current = true;
              fileInputRef.current?.click();
            }}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Import Image or PDF"
          >
            <FileUp size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={handleFileImport}
          />

          <button onClick={clear} className="p-2 rounded-full hover:bg-red-100 text-red-600" title="Clear All">
            <Trash2 size={20} />
          </button>

          <div className="relative">
            <button 
              onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600" 
              title="Change Background"
            >
              <ImageIcon size={20} />
            </button>
            
            {showBackgroundPicker && (
              <div className="absolute top-full right-0 mt-2 bg-white shadow-lg rounded-lg p-2 border border-gray-200 flex flex-wrap gap-2 w-64 max-h-64 overflow-y-auto z-50">
                {/* Uploaded Backgrounds */}
                {uploadedBackgrounds.map((bg) => (
                  <div key={`uploaded-${bg.id}`} className="relative group">
                    <button
                      onClick={() => {
                        setBackgroundImage(bg.url);
                        setShowBackgroundPicker(false);
                      }}
                      className={`w-12 h-12 rounded border-2 overflow-hidden transition-all flex-shrink-0 ${
                        backgroundImage === bg.url ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      title={bg.name}
                    >
                      <img 
                        src={bg.url} 
                        alt={bg.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      onClick={(e) => handleBackgroundDelete(bg.id, e)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Delete Background"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}

                {/* Upload Button */}
                <button
                  onClick={() => {
                    if (!isAdminAuthenticated) {
                      setPendingAction({ type: 'upload' });
                      setShowPasswordModal(true);
                      setShowBackgroundPicker(false);
                    } else {
                      bgUploadRef.current?.click();
                    }
                  }}
                  className="w-12 h-12 rounded border-2 border-dashed border-gray-300 hover:border-blue-500 flex items-center justify-center text-gray-500 hover:text-blue-500 transition-all flex-shrink-0"
                  title="Upload Background"
                >
                  <Upload size={20} />
                </button>
                <input
                  type="file"
                  ref={bgUploadRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                />
              </div>
            )}
          </div>

          <button 
            onClick={handleFullscreen}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600" 
            title="Fullscreen"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      {/* Mobile: Vertical toolbar on left */}
      <div className="sm:hidden fixed left-2 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-lg p-2 flex flex-col items-center gap-2 z-50 border border-gray-200 max-h-[calc(100vh-1rem)] overflow-y-auto">
        {/* Tools */}
        <div className="flex flex-col items-center gap-1 border-b border-gray-200 pb-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => handleToolClick(t.id)}
              className={`p-2 rounded-full transition-colors ${
                tool === t.id 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        {['pen', 'shape', 'text', 'handwriting', 'highlighter'].includes(tool) && (
          <div className="flex flex-col items-center gap-1 border-b border-gray-200 pb-2">
            {colorOptions.map((c) => (
              <button
                key={c.color}
                onClick={() => setColor(c.color)}
                className={`w-6 h-6 rounded-full border border-gray-300 transition-transform ${
                  color === c.color ? 'ring-2 ring-blue-400' : ''
                }`}
                style={{ backgroundColor: c.color }}
                title={c.label}
              />
            ))}
          </div>
        )}

        {/* Size Slider */}
        {['pen', 'eraser', 'shape', 'handwriting', 'highlighter', 'highlighter-eraser'].includes(tool) && (
          <div className="flex flex-col items-center gap-1 border-b border-gray-200 pb-2">
            <span className="text-xs text-gray-500">Size</span>
            <input
              type="range"
              min="1"
              max={tool === 'handwriting' ? 20 : 50}
              value={tool === 'handwriting' ? Math.min(size, 20) : size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="w-8 h-20 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{ writingMode: 'vertical-rl' }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={undo} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Undo">
            <Undo size={20} />
          </button>
          
          <button onClick={redo} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Redo">
            <Redo size={20} />
          </button>
          
          <button
            onClick={() => {
              if (document.fullscreenElement) wasInFullscreenRef.current = true;
              fileInputRef.current?.click();
            }}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Import"
          >
            <FileUp size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={handleFileImport}
          />

          <button onClick={clear} className="p-2 rounded-full hover:bg-red-100 text-red-600" title="Clear">
            <Trash2 size={20} />
          </button>

          <div className="relative">
            <button 
              onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600" 
              title="Background"
            >
              <ImageIcon size={20} />
            </button>
            
            {showBackgroundPicker && (
              <div className="absolute left-full top-0 ml-2 bg-white shadow-lg rounded-lg p-2 border border-gray-200 flex flex-col gap-2 z-10 max-h-64 overflow-y-auto">
                {uploadedBackgrounds.map((bg) => (
                  <div key={`uploaded-mobile-${bg.id}`} className="relative group">
                    <button
                      onClick={() => {
                        setBackgroundImage(bg.url);
                        setShowBackgroundPicker(false);
                      }}
                      className={`w-12 h-12 rounded border-2 overflow-hidden transition-all flex-shrink-0 ${
                        backgroundImage === bg.url ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      title={bg.name}
                    >
                      <img 
                        src={bg.url} 
                        alt={bg.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      onClick={(e) => handleBackgroundDelete(bg.id, e)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Delete Background"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    if (!isAdminAuthenticated) {
                      setPendingAction({ type: 'upload' });
                      setShowPasswordModal(true);
                      setShowBackgroundPicker(false);
                    } else {
                      bgUploadRef.current?.click();
                    }
                  }}
                  className="w-12 h-12 rounded border-2 border-dashed border-gray-300 hover:border-blue-500 flex items-center justify-center text-gray-500 hover:text-blue-500 transition-all flex-shrink-0"
                  title="Upload Background"
                >
                  <Upload size={20} />
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleFullscreen}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600" 
            title="Fullscreen"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>
    </>
  );
};