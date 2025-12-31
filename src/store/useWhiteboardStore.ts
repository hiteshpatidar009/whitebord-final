import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { type ToolType, type WhiteboardItem, COLORS } from '../types';

interface WhiteboardState {
  tool: ToolType;
  color: string;
  size: number;
  items: WhiteboardItem[];
  history: WhiteboardItem[][];
  historyStep: number;
  stagePos: { x: number; y: number };
  stageScale: number;
  selectedId: string | null;
  clipboard: WhiteboardItem | null;
  backgroundImage: string;
  textOptions: {
    fontFamily: string;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
  };
  pdfPages: string[];
  currentPdfPage: number | null;
  textSelection: { start: number; end: number } | null;
  
  setTool: (tool: ToolType) => void;
  setSelectedId: (id: string | null) => void;
  setTextOptions: (options: Partial<{ fontFamily: string; isBold: boolean; isItalic: boolean; isUnderline: boolean }>) => void;
  setTextSelection: (selection: { start: number; end: number } | null) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  setStageScale: (scale: number) => void;
  setBackgroundImage: (image: string) => void;
  setPdfPages: (pages: string[]) => void;
  setCurrentPdfPage: (page: number | null) => void;
  
  addItem: (item: WhiteboardItem) => void;
  updateItem: (id: string, updates: Partial<WhiteboardItem>) => void;
  removeItem: (id: string) => void;
  
  undo: () => void;
  redo: () => void;
  copy: () => void;
  paste: () => void;
  saveHistory: () => void;
  reset: () => void;
  clear: () => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  tool: 'pen',
  color: COLORS.red,
  size: 32,
  items: [],
  history: [[]],
  historyStep: 0,
  stagePos: { x: 0, y: 0 },
  stageScale: 1,
  selectedId: null,
  clipboard: null,
  backgroundImage: '/default.png',
  textOptions: {
    fontFamily: 'Arial',
    isBold: false,
    isItalic: false,
    isUnderline: false,
  },
  pdfPages: [],
  currentPdfPage: null,
  textSelection: null,

  setTool: (tool) => set({ tool }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setTextOptions: (options) => set((state) => ({ textOptions: { ...state.textOptions, ...options } })),
  setTextSelection: (textSelection) => set({ textSelection }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),
  setStagePos: (stagePos) => set({ stagePos }),
  setStageScale: (stageScale) => set({ stageScale }),
  setPdfPages: (pdfPages) => set({ pdfPages }),
  setCurrentPdfPage: (currentPdfPage) => set({ currentPdfPage }),

  // --- UPDATED: Cache Busting Logic ---
  setBackgroundImage: (image) => {
    // Append a unique timestamp query string to the URL.
    // This forces the browser to ignore the cache and fetch the file fresh from the server.
    const uniquePath = image.includes('?') 
      ? image 
      : `${image}?t=${new Date().getTime()}`;
      
    set({ backgroundImage: uniquePath });
  },

  addItem: (item) => {
    const { items } = get();
    const newItems = [...items, item];
    // When adding item, we don't immediately save history to allow for continuous drawing updates.
    // History save should be triggered on mouse up.
    set({ items: newItems });
  },

  updateItem: (id, updates) => {
    const { items } = get();
    const newItems = items.map((item) => 
      item.id === id ? { ...item, ...updates } : item
    ) as WhiteboardItem[];
    set({ items: newItems });
  },

  removeItem: (id) => {
    const { items } = get();
    set({ items: items.filter((i) => i.id !== id) });
  },

  copy: () => {
    const { items, selectedId } = get();
    if (!selectedId) return;
    const item = items.find(i => i.id === selectedId);
    if (item) {
      set({ clipboard: { ...item } });
    }
  },

  paste: () => {
    const { clipboard, items } = get();
    if (!clipboard) return;

    let newItem: WhiteboardItem;

    // Check if the item relies on points for positioning (Stroke, Line, Polygon)
    const isPointBased = clipboard.type === 'stroke' || 
                         (clipboard.type === 'shape' && (clipboard.shapeType === 'line' || clipboard.shapeType === 'polygon'));

    if (isPointBased) {
      // For point-based items, we shift the points
      // We need to cast to access points safely or trust the logic
      const points = (clipboard as any).points || [];
      const newPoints = points.map((p: number) => p + 20);
      
      newItem = {
        ...clipboard,
        id: uuidv4(),
        points: newPoints,
      } as WhiteboardItem;
    } else {
      // For x/y based items (Text, Rect, Circle, Image, etc.)
      newItem = {
        ...clipboard,
        id: uuidv4(),
        x: clipboard.x + 20,
        y: clipboard.y + 20,
      } as WhiteboardItem;
    }

    set({ 
      items: [...items, newItem],
      selectedId: newItem.id,
      clipboard: newItem 
    });
    
    get().saveHistory();
  },

  saveHistory: () => {
    const { items, history, historyStep } = get();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...items]);
    set({ history: newHistory, historyStep: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyStep } = get();
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      set({
        items: [...history[newStep]],
        historyStep: newStep,
      });
    }
  },

  redo: () => {
    const { history, historyStep } = get();
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      set({
        items: [...history[newStep]],
        historyStep: newStep,
      });
    }
  },

  reset: () => set({ items: [], history: [[]], historyStep: 0 }),
  
  clear: () => {
    const { items, history, historyStep } = get();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...items]);
    set({ 
      items: [], 
      history: newHistory, 
      historyStep: newHistory.length - 1,
      selectedId: null,
      pdfPages: [],
      currentPdfPage: null
    });
  },
}));