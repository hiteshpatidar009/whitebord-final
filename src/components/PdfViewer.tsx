import React, { useRef, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export const PdfViewer: React.FC = () => {
  const { 
    pdfPages, 
    currentPdfPage, 
    setCurrentPdfPage,
    addItem,
    stagePos,
    stageScale,
    saveHistory
  } = useWhiteboardStore();
  const [searchInput, setSearchInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef<HTMLDivElement>(null);

  // Automatically open sidebar when PDF is loaded
  useEffect(() => {
    if (pdfPages.length > 0) {
      setIsOpen(true);
    }
  }, [pdfPages]);

  // if (pdfPages.length === 0) return null;

  const addPageToCanvas = (index: number) => {
    const pageUrl = pdfPages[index];
    if (!pageUrl) return;

    // Calculate center of viewport in stage coordinates
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const x = (viewportCenterX - stagePos.x) / stageScale;
    const y = (viewportCenterY - stagePos.y) / stageScale;

    const defaultWidth = 600;
    const defaultHeight = 800;

    addItem({
      type: 'image',
      id: uuidv4(),
      x: x - defaultWidth / 2,
      y: y - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
      src: pageUrl,
      rotation: 0,
      opacity: 1,
    } as any);
    
    saveHistory();
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (value === '') return;
    
    const pageNum = parseInt(value, 10);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum <= pdfPages.length) {
      const pageIndex = pageNum - 1;
      setCurrentPdfPage(pageIndex);
      addPageToCanvas(pageIndex);
      setTimeout(() => {
        const pageElement = containerRef.current?.querySelector(`[data-page-index="${pageIndex}"]`) as HTMLElement;
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  const handlePageClick = (index: number) => {
    setCurrentPdfPage(index);
    setSearchInput((index + 1).toString());
    addPageToCanvas(index);
  };

  return (
    <>
      {/* PDF Viewer Panel - Vertical Left Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 shadow-xl z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 sm:w-56 flex flex-col border-r border-gray-200 dark:border-gray-700`}
      >
        {/* Close Button (Mobile Only) */}
        <div className="sm:hidden absolute top-2 right-2 z-50">
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Header */}
        <div className="relative p-4 border-b border-gray-200 dark:border-gray-700 mt-6 sm:mt-0">
          {/* Toggle Arrow Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="absolute top-1/2 -right-5 -translate-y-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full shadow-md p-1 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all z-50"
            title={isOpen ? "Hide Preview" : "Show Preview"}
          >
            {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            PDF Pages ({pdfPages.length})
          </h3>
          <input
            type="text"
            inputMode="numeric"
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d+$/.test(val)) {
                handleSearch(val);
              }
            }}
            placeholder="Go to page..."
            className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>

        {/* Pages Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-800"
        >
          {pdfPages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-xs">
              <p>No PDF Loaded</p>
            </div>
          )}
          {pdfPages.map((pageUrl, index) => (
            <div
              key={index}
              ref={currentPdfPage === index ? currentPageRef : null}
              data-page-index={index}
              onClick={() => handlePageClick(index)}
              className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                currentPdfPage === index
                  ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } hover:shadow-md`}
            >
              <div className="relative bg-white dark:bg-gray-700 aspect-[3/4] overflow-hidden">
                <img
                  src={pageUrl}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1">
                  <span className="text-xs font-semibold text-white">{index + 1}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay (Mobile Only) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="sm:hidden fixed inset-0 bg-black/30 z-30"
        />
      )}
    </>
  );
};
