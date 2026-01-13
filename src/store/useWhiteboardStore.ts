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
  showStopwatch: boolean;
  showRuler: boolean;
  showTriangle45: boolean;
  showTriangle60: boolean;
  showProtractor: boolean;
  showNumberLine: boolean;
  
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
  setShowStopwatch: (show: boolean) => void;
  setShowRuler: (show: boolean) => void;
  setShowTriangle45: (show: boolean) => void;
  setShowTriangle60: (show: boolean) => void;
  setShowProtractor: (show: boolean) => void;
  setShowNumberLine: (show: boolean) => void;
  
  addItem: (item: WhiteboardItem) => void;
  updateItem: (id: string, updates: Partial<WhiteboardItem>) => void;
  removeItem: (id: string) => void;
  groupItems: (ids: string[]) => void;
  ungroupItems: (groupId: string) => void;
  
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
  size: 44,
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
  showStopwatch: false,
  showRuler: false,
  showTriangle45: false,
  showTriangle60: false,
  showProtractor: false,
  showNumberLine: false,

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
  setShowStopwatch: (showStopwatch) => set({ showStopwatch }),
  setShowRuler: (showRuler) => set({ showRuler }),
  setShowTriangle45: (showTriangle45) => set({ showTriangle45 }),
  setShowTriangle60: (showTriangle60) => set({ showTriangle60 }),
  setShowProtractor: (showProtractor) => set({ showProtractor }),
  setShowNumberLine: (showNumberLine) => set({ showNumberLine }),

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
    // If removing a group, also remove all its items
    const itemToRemove = items.find(i => i.id === id);
    if (itemToRemove && itemToRemove.type === 'group') {
      const groupItem = itemToRemove as any;
      const childIds = groupItem.items?.map((item: WhiteboardItem) => item.id) || [];
      set({ items: items.filter(i => i.id !== id && !childIds.includes(i.id)) });
    } else {
      set({ items: items.filter((i) => i.id !== id) });
    }
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

  groupItems: (ids: string[]) => {
    const { items } = get();
    if (ids.length < 2) return; // Need at least 2 items to group
    
    // Get the items to group
    const itemsToGroup = items.filter(i => ids.includes(i.id));
    if (itemsToGroup.length === 0) return;
    
    // Calculate bounding box for the group
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    itemsToGroup.forEach(item => {
      if (item.type === 'stroke') {
        const points = item.points;
        for (let i = 0; i < points.length; i += 2) {
          minX = Math.min(minX, points[i]);
          maxX = Math.max(maxX, points[i]);
          minY = Math.min(minY, points[i + 1]);
          maxY = Math.max(maxY, points[i + 1]);
        }
      } else if (item.type === 'shape') {
        if (item.shapeType === 'line' || item.shapeType === 'polygon') {
          const points = item.points || [];
          for (let i = 0; i < points.length; i += 2) {
            minX = Math.min(minX, points[i]);
            maxX = Math.max(maxX, points[i]);
            minY = Math.min(minY, points[i + 1]);
            maxY = Math.max(maxY, points[i + 1]);
          }
        } else {
          minX = Math.min(minX, item.x);
          minY = Math.min(minY, item.y);
          maxX = Math.max(maxX, item.x + (item.width || 0));
          maxY = Math.max(maxY, item.y + (item.height || 0));
        }
      } else {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + (item.width || 0));
        maxY = Math.max(maxY, item.y + (item.height || 0));
      }
    });
    
    const groupId = uuidv4();
    const groupItem: WhiteboardItem = {
      type: 'group',
      id: groupId,
      items: itemsToGroup,  // Store actual items
      x: minX === Infinity ? 0 : minX,
      y: minY === Infinity ? 0 : minY,
      width: maxX === -Infinity ? 0 : maxX - minX,
      height: maxY === -Infinity ? 0 : maxY - minY,
      rotation: 0,
    };
    
    // Remove individual items and add group
    const newItems = items.filter(item => !ids.includes(item.id));
    newItems.push(groupItem);
    
    set({ items: newItems, selectedId: groupId });
  },

  ungroupItems: (groupId: string) => {
    const { items } = get();
    const groupItem = items.find(i => i.id === groupId && i.type === 'group') as any;
    
    if (!groupItem || !groupItem.items) return;
    
    // Get the offset applied to the group
    const groupX = groupItem.x;
    const groupY = groupItem.y;
    const originalGroupX = groupItem.items.length > 0 ? 
      Math.min(...groupItem.items.map((item: any) => item.x || 0)) : 0;
    const originalGroupY = groupItem.items.length > 0 ? 
      Math.min(...groupItem.items.map((item: any) => item.y || 0)) : 0;
    
    // Restore individual items with updated positions based on group transformation
    const restoredItems: WhiteboardItem[] = groupItem.items.map((item: WhiteboardItem) => {
      if (item.type === 'text' || item.type === 'image' || (item.type === 'shape' && item.shapeType !== 'line' && item.shapeType !== 'polygon')) {
        return {
          ...item,
          x: (item.x || 0) - originalGroupX + groupX,
          y: (item.y || 0) - originalGroupY + groupY,
        };
      } else if (item.type === 'stroke' || (item.type === 'shape' && (item.shapeType === 'line' || item.shapeType === 'polygon'))) {
        const newPoints = (item.points || []).map((p: number, i: number) => {
          if (i % 2 === 0) return p - originalGroupX + groupX;
          return p - originalGroupY + groupY;
        });
        return {
          ...item,
          points: newPoints,
        };
      }
      return item;
    });
    
    // Remove group and add back individual items
    const newItems = items.filter(item => item.id !== groupId);
    newItems.push(...restoredItems);
    
    set({ items: newItems, selectedId: null });
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