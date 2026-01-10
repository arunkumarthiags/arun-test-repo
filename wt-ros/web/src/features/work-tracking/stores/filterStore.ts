/**
 * Filter Store - Jotai atoms for Work Item filtering
 *
 * Manages:
 * - Active filters
 * - Saved filter presets
 * - Filter history
 */
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import {
  WorkItemFilters,
  HealthStatus,
  Priority,
  WorkStatus,
  DateRange,
} from '@wt-ros/common';

// ============================================
// ACTIVE FILTERS
// ============================================

/**
 * Current active filters
 */
export const filtersAtom = atom<WorkItemFilters>({});

// Alias for backward compatibility
export const activeFiltersAtom = filtersAtom;

/**
 * Clear all filters
 */
export const clearFiltersAtom = atom(null, (get, set) => {
  set(filtersAtom, {});
});

// ============================================
// FILTER TOGGLES
// ============================================

/**
 * Toggle a health status filter
 */
export const toggleHealthFilterAtom = atom(
  null,
  (get, set, health: HealthStatus) => {
    const currentFilters = get(filtersAtom);
    const currentHealth = currentFilters.health || [];

    if (currentHealth.includes(health)) {
      // Remove
      set(filtersAtom, {
        ...currentFilters,
        health: currentHealth.filter((h) => h !== health),
      });
    } else {
      // Add
      set(filtersAtom, {
        ...currentFilters,
        health: [...currentHealth, health],
      });
    }
  }
);

/**
 * Toggle a priority filter
 */
export const togglePriorityFilterAtom = atom(
  null,
  (get, set, priority: Priority) => {
    const currentFilters = get(filtersAtom);
    const currentPriorities = currentFilters.priorities || [];

    if (currentPriorities.includes(priority)) {
      set(filtersAtom, {
        ...currentFilters,
        priorities: currentPriorities.filter((p) => p !== priority),
      });
    } else {
      set(filtersAtom, {
        ...currentFilters,
        priorities: [...currentPriorities, priority],
      });
    }
  }
);

/**
 * Toggle a status filter
 */
export const toggleStatusFilterAtom = atom(
  null,
  (get, set, status: WorkStatus) => {
    const currentFilters = get(filtersAtom);
    const currentStatuses = currentFilters.statuses || [];

    if (currentStatuses.includes(status)) {
      set(filtersAtom, {
        ...currentFilters,
        statuses: currentStatuses.filter((s) => s !== status),
      });
    } else {
      set(filtersAtom, {
        ...currentFilters,
        statuses: [...currentStatuses, status],
      });
    }
  }
);

/**
 * Set group IDs filter
 */
export const setGroupFilterAtom = atom(
  null,
  (get, set, groupIds: string[] | undefined) => {
    set(filtersAtom, {
      ...get(filtersAtom),
      groupIds,
    });
  }
);

/**
 * Set team IDs filter
 */
export const setTeamFilterAtom = atom(
  null,
  (get, set, teamIds: string[] | undefined) => {
    set(filtersAtom, {
      ...get(filtersAtom),
      teamIds,
    });
  }
);

/**
 * Set DRI IDs filter
 */
export const setDriFilterAtom = atom(
  null,
  (get, set, driIds: string[] | undefined) => {
    set(filtersAtom, {
      ...get(filtersAtom),
      driIds,
    });
  }
);

/**
 * Set date range filter
 */
export const setDateRangeFilterAtom = atom(
  null,
  (get, set, dateRange: DateRange | undefined) => {
    set(filtersAtom, {
      ...get(filtersAtom),
      targetDateRange: dateRange,
    });
  }
);

/**
 * Set flag filters
 */
export const setFlagFiltersAtom = atom(
  null,
  (
    get,
    set,
    flags: { needsHelp?: boolean; atRisk?: boolean; stale?: boolean }
  ) => {
    set(filtersAtom, {
      ...get(filtersAtom),
      ...flags,
    });
  }
);

// ============================================
// DERIVED ATOMS
// ============================================

/**
 * Count of active filters
 */
export const activeFilterCountAtom = atom((get) => {
  const filters = get(filtersAtom);
  let count = 0;

  if (filters.health?.length) count += filters.health.length;
  if (filters.priorities?.length) count += filters.priorities.length;
  if (filters.statuses?.length) count += filters.statuses.length;
  if (filters.groupIds?.length) count += filters.groupIds.length;
  if (filters.teamIds?.length) count += filters.teamIds.length;
  if (filters.driIds?.length) count += filters.driIds.length;
  if (filters.needsHelp) count++;
  if (filters.atRisk) count++;
  if (filters.stale) count++;
  if (filters.searchQuery) count++;
  if (filters.targetDateRange) count++;

  return count;
});

/**
 * Check if any filter is active
 */
export const hasActiveFiltersAtom = atom((get) => get(activeFilterCountAtom) > 0);

// ============================================
// SAVED FILTER PRESETS
// ============================================

export interface FilterPreset {
  id: string;
  name: string;
  filters: WorkItemFilters;
  createdAt: Date;
  isDefault?: boolean;
}

/**
 * Saved filter presets - persisted to localStorage
 */
export const filterPresetsAtom = atomWithStorage<FilterPreset[]>(
  'wt-ros-filter-presets',
  [
    {
      id: 'needs-attention',
      name: 'Needs Attention',
      filters: {
        health: [HealthStatus.RED, HealthStatus.YELLOW],
        atRisk: true,
      },
      createdAt: new Date(),
      isDefault: true,
    },
    {
      id: 'blocked',
      name: 'Blocked Items',
      filters: {
        statuses: [WorkStatus.BLOCKED],
        needsHelp: true,
      },
      createdAt: new Date(),
      isDefault: true,
    },
    {
      id: 'p0-p1',
      name: 'High Priority (P0-P1)',
      filters: {
        priorities: [Priority.P0, Priority.P1],
      },
      createdAt: new Date(),
      isDefault: true,
    },
  ]
);

/**
 * Save current filters as a preset
 */
export const saveFilterPresetAtom = atom(null, (get, set, name: string) => {
  const currentFilters = get(filtersAtom);
  const currentPresets = get(filterPresetsAtom);

  const newPreset: FilterPreset = {
    id: `preset-${Date.now()}`,
    name,
    filters: currentFilters,
    createdAt: new Date(),
    isDefault: false,
  };

  set(filterPresetsAtom, [...currentPresets, newPreset]);
});

/**
 * Apply a filter preset
 */
export const applyFilterPresetAtom = atom(null, (get, set, presetId: string) => {
  const presets = get(filterPresetsAtom);
  const preset = presets.find((p) => p.id === presetId);

  if (preset) {
    set(filtersAtom, preset.filters);
  }
});

/**
 * Delete a filter preset
 */
export const deleteFilterPresetAtom = atom(null, (get, set, presetId: string) => {
  const presets = get(filterPresetsAtom);
  set(
    filterPresetsAtom,
    presets.filter((p) => p.id !== presetId || p.isDefault)
  );
});

// ============================================
// FILTER HISTORY
// ============================================

/**
 * Recent filter combinations for quick access
 */
export const filterHistoryAtom = atomWithStorage<WorkItemFilters[]>(
  'wt-ros-filter-history',
  []
);

/**
 * Add current filters to history
 */
export const addToFilterHistoryAtom = atom(null, (get, set) => {
  const currentFilters = get(filtersAtom);
  const history = get(filterHistoryAtom);

  // Don't add empty filters
  if (Object.keys(currentFilters).length === 0) return;

  // Don't add duplicates
  const isDuplicate = history.some(
    (h) => JSON.stringify(h) === JSON.stringify(currentFilters)
  );
  if (isDuplicate) return;

  // Keep only last 10 unique filter combinations
  const newHistory = [currentFilters, ...history].slice(0, 10);
  set(filterHistoryAtom, newHistory);
});
