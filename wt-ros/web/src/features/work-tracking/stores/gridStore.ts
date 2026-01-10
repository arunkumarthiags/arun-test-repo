/**
 * Grid Store - Jotai atoms for Work Grid UI state
 *
 * Manages:
 * - Search query
 * - Selected rows
 * - Command palette state
 * - Quick filters
 * - Column visibility
 * - Expanded rows for detail panels
 */
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { GridRowId, GridSortModel, GridColumnVisibilityModel } from '@mui/x-data-grid';
import { HealthStatus, Priority, WorkStatus } from '@wt-ros/common';

// ============================================
// SEARCH & SELECTION
// ============================================

/**
 * Current search query - debounced in the UI
 */
export const searchQueryAtom = atom<string>('');

/**
 * Currently selected row IDs for bulk actions
 */
export const selectedRowIdsAtom = atom<GridRowId[]>([]);

/**
 * Currently focused row ID for keyboard navigation
 */
export const focusedRowIdAtom = atom<GridRowId | null>(null);

/**
 * Row IDs with expanded detail panels
 */
export const expandedRowIdsAtom = atom<GridRowId[]>([]);

// ============================================
// COMMAND PALETTE
// ============================================

/**
 * Command palette open state (CMD+K)
 */
export const commandPaletteOpenAtom = atom<boolean>(false);

/**
 * Command palette search query
 */
export const commandPaletteQueryAtom = atom<string>('');

/**
 * Available commands for the palette
 */
export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: 'navigation' | 'filter' | 'action' | 'view';
}

export const commandsAtom = atom<Command[]>([]);

// ============================================
// QUICK FILTERS
// ============================================

export interface QuickFilters {
  needsHelp: boolean;
  atRisk: boolean;
  stale: boolean;
  myItems: boolean;
  overdue: boolean;
}

export const quickFiltersAtom = atom<QuickFilters>({
  needsHelp: false,
  atRisk: false,
  stale: false,
  myItems: false,
  overdue: false,
});

/**
 * Count of active filters (including quick filters)
 */
export const activeFilterCountAtom = atom((get) => {
  const quickFilters = get(quickFiltersAtom);
  let count = 0;

  if (quickFilters.needsHelp) count++;
  if (quickFilters.atRisk) count++;
  if (quickFilters.stale) count++;
  if (quickFilters.myItems) count++;
  if (quickFilters.overdue) count++;

  // Include filter store counts
  // This would normally be derived from filterStore, but we keep it simple here
  return count;
});

// ============================================
// GRID CONFIGURATION
// ============================================

/**
 * Column visibility - persisted to localStorage
 */
export const columnVisibilityAtom = atomWithStorage<GridColumnVisibilityModel>(
  'wt-ros-column-visibility',
  {
    // Default visibility
    id: false,
    description: false,
    originalTargetDate: false,
    driftScore: false,
    lastActivityAt: false,
    createdAt: false,
    updatedAt: false,
  }
);

/**
 * Column order - persisted to localStorage
 */
export const columnOrderAtom = atomWithStorage<string[]>(
  'wt-ros-column-order',
  [
    'title',
    'dri',
    'group',
    'team',
    'priority',
    'status',
    'health',
    'targetDate',
    'needsHelp',
    'atRisk',
    'stale',
    'artifacts',
  ]
);

/**
 * Sort model for the grid
 */
export const sortModelAtom = atom<GridSortModel>([
  { field: 'priority', sort: 'asc' },
  { field: 'targetDate', sort: 'asc' },
]);

/**
 * Row density - persisted to localStorage
 */
export type GridDensity = 'compact' | 'standard' | 'comfortable';

export const gridDensityAtom = atomWithStorage<GridDensity>(
  'wt-ros-grid-density',
  'compact'
);

// ============================================
// INLINE EDITING
// ============================================

/**
 * Currently editing cell
 */
export interface EditingCell {
  rowId: GridRowId;
  field: string;
}

export const editingCellAtom = atom<EditingCell | null>(null);

/**
 * Pending edits (for optimistic updates)
 */
export interface PendingEdit {
  rowId: GridRowId;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export const pendingEditsAtom = atom<PendingEdit[]>([]);

// ============================================
// DETAIL PANEL
// ============================================

/**
 * Currently open detail panel work item ID
 */
export const detailPanelWorkItemIdAtom = atom<string | null>(null);

/**
 * Detail panel tab (updates, comments, artifacts)
 */
export type DetailPanelTab = 'updates' | 'comments' | 'artifacts' | 'activity';

export const detailPanelTabAtom = atom<DetailPanelTab>('updates');

// ============================================
// UI STATE
// ============================================

/**
 * Whether the grid is in bulk selection mode
 */
export const bulkSelectionModeAtom = atom<boolean>(false);

/**
 * Notification snackbar state
 */
export interface Notification {
  id: string;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  autoHideDuration?: number;
}

export const notificationsAtom = atom<Notification[]>([]);

/**
 * Add a notification
 */
export const addNotificationAtom = atom(
  null,
  (get, set, notification: Omit<Notification, 'id'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set(notificationsAtom, [...get(notificationsAtom), newNotification]);
  }
);

/**
 * Remove a notification
 */
export const removeNotificationAtom = atom(null, (get, set, id: string) => {
  set(
    notificationsAtom,
    get(notificationsAtom).filter((n) => n.id !== id)
  );
});

// ============================================
// DERIVED ATOMS
// ============================================

/**
 * Whether any row is selected
 */
export const hasSelectionAtom = atom((get) => get(selectedRowIdsAtom).length > 0);

/**
 * Whether multiple rows are selected
 */
export const hasMultipleSelectionAtom = atom(
  (get) => get(selectedRowIdsAtom).length > 1
);

/**
 * Whether the detail panel is open
 */
export const isDetailPanelOpenAtom = atom(
  (get) => get(detailPanelWorkItemIdAtom) !== null
);
