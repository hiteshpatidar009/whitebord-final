# Whiteboard Grouping Feature

## Overview

This document describes the new grouping feature added to the whiteboard application. It allows users to select multiple items and group them together as a single unit.

## Features

### 1. **Multi-Select** (existing, improved)

- Hold **Ctrl/Cmd** and click on items to select multiple items
- Selected items show selection handles

### 2. **Group Items** (NEW)

- **Shortcut**: `Ctrl+G` (or `Cmd+G` on Mac)
- Groups 2 or more selected items together
- Creates a visual boundary around the group (blue dashed rectangle)
- Group is treated as a single unit for movement and transformation

### 3. **Ungroup Items** (NEW)

- **Shortcut**: `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac)
- Ungroups a selected group back into individual items
- Individual items retain their original positions relative to the group

## How to Use

### Grouping Items:

1. Select the select tool (or any tool) from the toolbar
2. Hold `Ctrl` (or `Cmd` on Mac) and click on items you want to group
3. Press `Ctrl+G` to group them
4. A blue dashed rectangle will appear around the grouped items

### Moving a Group:

1. Click on any part of the group's boundary (blue dashed rectangle)
2. Drag to move all items in the group together

### Transforming a Group:

1. Select the group
2. Use the transformer handles to resize or rotate the group
3. All items in the group move and transform proportionally

### Ungrouping Items:

1. Select a grouped item
2. Press `Ctrl+Shift+G` to ungroup
3. Items return to their individual state

## Implementation Details

### Data Structure

A new `GroupObject` type was added to the types:

```typescript
export type GroupObject = {
  id: string;
  itemIds: string[]; // IDs of items in the group
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};
```

### Store Methods

#### `groupItems(ids: string[])`

- Takes an array of item IDs to group
- Calculates the bounding box of all items
- Creates a group item with the bounding box dimensions
- Removes individual items and adds the group item
- Requires at least 2 items to group

#### `ungroupItems(groupId: string)`

- Takes a group ID
- Restores individual items with their original properties
- Removes the group item
- Clears the selection

### UI Features

1. **Visual Indication**: Groups are shown with a blue dashed border rectangle
2. **Selection**: Groups can be selected like any other item
3. **Dragging**: Groups move all child items together
4. **Transformation**: Groups can be resized/rotated via transformer handles
5. **Keyboard Shortcuts**:
   - `Ctrl+G` / `Cmd+G`: Group selected items
   - `Ctrl+Shift+G` / `Cmd+Shift+G`: Ungroup selected group

## Modified Files

1. **src/types/index.ts**

   - Added `GroupObject` type
   - Added group type to `WhiteboardItem` union type

2. **src/store/useWhiteboardStore.ts**

   - Added `groupItems` method
   - Added `ungroupItems` method
   - Added type signatures for both methods

3. **src/components/Whiteboard.tsx**
   - Imported `groupItems` and `ungroupItems` from store
   - Added keyboard handlers for `Ctrl+G` and `Ctrl+Shift+G`
   - Added group item rendering in `renderLayer3Item`
   - Updated `handleItemDragEnd` to move all items when dragging a group

## Technical Notes

- Group items are automatically positioned at the minimum X,Y coordinates of all contained items
- The group's width and height represent the bounding box of all items
- When moving a group, the delta (dx, dy) is applied to all child items
- Stroke items with point-based positioning have their points adjusted
- Text, image, and shape items with x,y positioning are moved by updating their coordinates
- Groups maintain full undo/redo support through the history system

## Future Enhancements

- Nested groups (groups within groups)
- Right-click context menu for group operations
- Group properties panel (color, opacity, etc.)
- Lock/unlock groups to prevent accidental modifications
- Copy/paste groups
- Align/distribute options for grouped items
