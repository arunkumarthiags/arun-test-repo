/**
 * useKeyboardNavigation - Keyboard-first navigation for the Work Grid
 *
 * Features:
 * - CMD+K: Open command palette
 * - Arrow keys: Navigate rows
 * - Enter: Open detail panel / edit cell
 * - Escape: Close panel / cancel edit
 * - Space: Toggle selection
 * - CMD+A: Select all
 * - Delete/Backspace: Delete selected (with confirmation)
 * - R: Refresh
 * - F: Focus filter
 * - /: Focus search
 */
import { useEffect, useCallback, useRef } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { GridRowId } from '@mui/x-data-grid';

import {
  commandPaletteOpenAtom,
  selectedRowIdsAtom,
  focusedRowIdAtom,
  detailPanelWorkItemIdAtom,
  editingCellAtom,
  expandedRowIdsAtom,
} from '../stores/gridStore';

interface UseKeyboardNavigationOptions {
  /** All row IDs in order */
  rowIds?: GridRowId[];
  /** Callback when row should be focused */
  onFocusRow?: (rowId: GridRowId) => void;
  /** Callback when delete is triggered */
  onDelete?: (rowIds: GridRowId[]) => void;
  /** Callback when refresh is triggered */
  onRefresh?: () => void;
  /** Callback when search should be focused */
  onFocusSearch?: () => void;
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
}

/**
 * Hook for keyboard-first navigation in the Work Grid
 *
 * @example
 * ```tsx
 * useKeyboardNavigation({
 *   rowIds: workItems.map(w => w.id),
 *   onFocusRow: (id) => gridApiRef.current?.scrollToIndexes({ rowIndex }),
 *   onRefresh: () => refetch(),
 * });
 * ```
 */
export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions = {}
) {
  const {
    rowIds = [],
    onFocusRow,
    onDelete,
    onRefresh,
    onFocusSearch,
    enabled = true,
  } = options;

  const [commandPaletteOpen, setCommandPaletteOpen] = useAtom(
    commandPaletteOpenAtom
  );
  const [selectedRowIds, setSelectedRowIds] = useAtom(selectedRowIdsAtom);
  const [focusedRowId, setFocusedRowId] = useAtom(focusedRowIdAtom);
  const [detailPanelWorkItemId, setDetailPanelWorkItemId] = useAtom(
    detailPanelWorkItemIdAtom
  );
  const [editingCell, setEditingCell] = useAtom(editingCellAtom);
  const setExpandedRowIds = useSetAtom(expandedRowIdsAtom);

  // Track if we're in an input field
  const isInInputRef = useRef(false);

  /**
   * Get the index of the currently focused row
   */
  const getFocusedIndex = useCallback(() => {
    if (!focusedRowId || rowIds.length === 0) return -1;
    return rowIds.indexOf(focusedRowId);
  }, [focusedRowId, rowIds]);

  /**
   * Move focus to a different row
   */
  const moveFocus = useCallback(
    (direction: 'up' | 'down' | 'first' | 'last') => {
      if (rowIds.length === 0) return;

      const currentIndex = getFocusedIndex();
      let newIndex: number;

      switch (direction) {
        case 'up':
          newIndex = currentIndex <= 0 ? rowIds.length - 1 : currentIndex - 1;
          break;
        case 'down':
          newIndex = currentIndex >= rowIds.length - 1 ? 0 : currentIndex + 1;
          break;
        case 'first':
          newIndex = 0;
          break;
        case 'last':
          newIndex = rowIds.length - 1;
          break;
      }

      const newRowId = rowIds[newIndex];
      setFocusedRowId(newRowId);
      onFocusRow?.(newRowId);
    },
    [rowIds, getFocusedIndex, setFocusedRowId, onFocusRow]
  );

  /**
   * Toggle selection of the focused row
   */
  const toggleSelection = useCallback(
    (rowId?: GridRowId) => {
      const targetId = rowId ?? focusedRowId;
      if (!targetId) return;

      setSelectedRowIds((current) => {
        if (current.includes(targetId)) {
          return current.filter((id) => id !== targetId);
        }
        return [...current, targetId];
      });
    },
    [focusedRowId, setSelectedRowIds]
  );

  /**
   * Select all rows
   */
  const selectAll = useCallback(() => {
    setSelectedRowIds(rowIds);
  }, [rowIds, setSelectedRowIds]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedRowIds([]);
  }, [setSelectedRowIds]);

  /**
   * Open detail panel for focused row
   */
  const openDetailPanel = useCallback(() => {
    if (focusedRowId) {
      setDetailPanelWorkItemId(focusedRowId as string);
    }
  }, [focusedRowId, setDetailPanelWorkItemId]);

  /**
   * Close detail panel
   */
  const closeDetailPanel = useCallback(() => {
    setDetailPanelWorkItemId(null);
  }, [setDetailPanelWorkItemId]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if we're in an input field
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[role="textbox"]');

      // Allow CMD+K and Escape everywhere
      const isMeta = event.metaKey || event.ctrlKey;

      // CMD+K: Open command palette
      if (isMeta && event.key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Escape: Close things
      if (event.key === 'Escape') {
        event.preventDefault();
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (editingCell) {
          setEditingCell(null);
        } else if (detailPanelWorkItemId) {
          closeDetailPanel();
        } else if (selectedRowIds.length > 0) {
          clearSelection();
        }
        return;
      }

      // Don't handle other shortcuts if in an input (unless CMD is pressed)
      if (isInput && !isMeta) return;

      // Prevent default for navigation keys
      const navigationKeys = [
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'Enter',
        ' ',
      ];
      if (navigationKeys.includes(event.key)) {
        event.preventDefault();
      }

      switch (event.key) {
        // Arrow navigation
        case 'ArrowUp':
          if (event.shiftKey) {
            // Extend selection up
            moveFocus('up');
            toggleSelection();
          } else {
            moveFocus('up');
          }
          break;

        case 'ArrowDown':
          if (event.shiftKey) {
            // Extend selection down
            moveFocus('down');
            toggleSelection();
          } else {
            moveFocus('down');
          }
          break;

        case 'Home':
          if (isMeta) {
            moveFocus('first');
          }
          break;

        case 'End':
          if (isMeta) {
            moveFocus('last');
          }
          break;

        // Enter: Open detail panel or start editing
        case 'Enter':
          if (focusedRowId) {
            if (event.shiftKey) {
              // Shift+Enter: Open detail panel
              openDetailPanel();
            } else {
              // Enter: Open detail panel (could also start inline edit)
              openDetailPanel();
            }
          }
          break;

        // Space: Toggle selection
        case ' ':
          if (!isInput) {
            toggleSelection();
          }
          break;

        // CMD+A: Select all
        case 'a':
          if (isMeta) {
            event.preventDefault();
            selectAll();
          }
          break;

        // Delete/Backspace: Delete selected
        case 'Delete':
        case 'Backspace':
          if (!isInput && selectedRowIds.length > 0) {
            onDelete?.(selectedRowIds);
          }
          break;

        // R: Refresh
        case 'r':
          if (!isMeta && !isInput) {
            event.preventDefault();
            onRefresh?.();
          }
          break;

        // /: Focus search
        case '/':
          if (!isInput) {
            event.preventDefault();
            onFocusSearch?.();
          }
          break;

        // F: Focus filter (when not in input)
        case 'f':
          if (isMeta) {
            event.preventDefault();
            onFocusSearch?.();
          }
          break;

        // X: Expand/collapse row
        case 'x':
          if (!isInput && focusedRowId) {
            setExpandedRowIds((current) => {
              if (current.includes(focusedRowId)) {
                return current.filter((id) => id !== focusedRowId);
              }
              return [...current, focusedRowId];
            });
          }
          break;

        // Number keys for quick status change
        case '1':
        case '2':
        case '3':
        case '4':
          if (!isInput && focusedRowId) {
            // Could trigger quick status change
            // 1: Not Started, 2: In Progress, 3: Blocked, 4: Complete
          }
          break;
      }
    },
    [
      enabled,
      commandPaletteOpen,
      editingCell,
      detailPanelWorkItemId,
      selectedRowIds,
      focusedRowId,
      moveFocus,
      toggleSelection,
      selectAll,
      clearSelection,
      openDetailPanel,
      closeDetailPanel,
      setCommandPaletteOpen,
      setEditingCell,
      setExpandedRowIds,
      onDelete,
      onRefresh,
      onFocusSearch,
    ]
  );

  // Attach event listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // Return utilities for manual control
  return {
    focusedRowId,
    setFocusedRowId,
    selectedRowIds,
    setSelectedRowIds,
    moveFocus,
    toggleSelection,
    selectAll,
    clearSelection,
    openDetailPanel,
    closeDetailPanel,
    commandPaletteOpen,
    setCommandPaletteOpen,
  };
}

/**
 * Hook to detect if user prefers keyboard navigation
 */
export function usePreferKeyboard() {
  const lastInputType = useRef<'mouse' | 'keyboard'>('mouse');

  useEffect(() => {
    const handleMouseDown = () => {
      lastInputType.current = 'mouse';
    };

    const handleKeyDown = () => {
      lastInputType.current = 'keyboard';
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return lastInputType;
}
