'use client';

/**
 * WorkGrid - High-density data grid for work items
 *
 * Features:
 * - Virtual scrolling for 1000+ rows
 * - Keyboard-first navigation (CMD+K, arrows)
 * - Health-based row styling
 * - Inline editing with optimistic updates
 * - Selection and bulk actions
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DataGridPremium,
  GridColDef,
  GridRowParams,
  GridCellParams,
  GridRowSelectionModel,
  GridFilterModel,
  GridSortModel,
  useGridApiRef,
  GridToolbar,
  GridActionsCellItem,
  GRID_CHECKBOX_SELECTION_COL_DEF,
} from '@mui/x-data-grid-premium';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Flag as FlagIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useAtom, useSetAtom } from 'jotai';
import { format, formatDistanceToNow, isPast } from 'date-fns';

import {
  IWorkItem,
  Priority,
  WorkStatus,
  HealthStatus,
} from '@wt-ros/common';
import { useWorkItems, generateMockWorkItems } from '../hooks/useWorkItems';
import { useUpdateWorkItem } from '../hooks/useWorkItemMutation';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import {
  selectedRowIdsAtom,
  focusedRowIdAtom,
  detailPanelWorkItemIdAtom,
} from '../stores/gridStore';
import { activeFiltersAtom } from '../stores/filterStore';

// ============================================
// CONSTANTS
// ============================================

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: '#dc2626', // red-600
  P1: '#ea580c', // orange-600
  P2: '#2563eb', // blue-600
  P3: '#6b7280', // gray-500
};

const STATUS_COLORS: Record<WorkStatus, string> = {
  NOT_STARTED: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  BLOCKED: '#ef4444',
  COMPLETE: '#22c55e',
  CANCELLED: '#6b7280',
};

const HEALTH_COLORS: Record<HealthStatus, string> = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  RED: '#ef4444',
  UNKNOWN: '#9ca3af',
};

// ============================================
// COLUMN DEFINITIONS
// ============================================

const createColumns = (
  onEdit: (id: string) => void,
  onOpenDetail: (id: string) => void
): GridColDef<IWorkItem>[] => [
  {
    ...GRID_CHECKBOX_SELECTION_COL_DEF,
    width: 50,
  },
  {
    field: 'priority',
    headerName: 'P',
    width: 60,
    renderCell: (params: GridCellParams<IWorkItem>) => (
      <Chip
        label={params.value}
        size="small"
        sx={{
          backgroundColor: PRIORITY_COLORS[params.value as Priority],
          color: 'white',
          fontWeight: 600,
          fontSize: '0.75rem',
          height: 24,
        }}
      />
    ),
  },
  {
    field: 'health',
    headerName: 'Health',
    width: 80,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      const health = params.value as HealthStatus;
      return (
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: HEALTH_COLORS[health],
          }}
        />
      );
    },
  },
  {
    field: 'title',
    headerName: 'Work Item',
    flex: 1,
    minWidth: 300,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      const row = params.row;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {params.value}
          </Typography>
          {row.needsHelp && (
            <Tooltip title="Needs Help">
              <FlagIcon sx={{ color: '#ef4444', fontSize: 16 }} />
            </Tooltip>
          )}
          {row.atRisk && (
            <Tooltip title="At Risk">
              <WarningIcon sx={{ color: '#eab308', fontSize: 16 }} />
            </Tooltip>
          )}
          {row.stale && (
            <Tooltip title="Stale - No activity">
              <ScheduleIcon sx={{ color: '#9ca3af', fontSize: 16 }} />
            </Tooltip>
          )}
        </Box>
      );
    },
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      const status = params.value as WorkStatus;
      const statusLabels: Record<WorkStatus, string> = {
        NOT_STARTED: 'Not Started',
        IN_PROGRESS: 'In Progress',
        BLOCKED: 'Blocked',
        COMPLETE: 'Complete',
        CANCELLED: 'Cancelled',
      };
      return (
        <Chip
          label={statusLabels[status]}
          size="small"
          variant="outlined"
          sx={{
            borderColor: STATUS_COLORS[status],
            color: STATUS_COLORS[status],
            fontSize: '0.75rem',
          }}
        />
      );
    },
  },
  {
    field: 'targetDate',
    headerName: 'Target Date',
    width: 120,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      if (!params.value) return <Typography variant="body2">-</Typography>;

      const date = new Date(params.value as string);
      const isOverdue = isPast(date) && params.row.status !== 'COMPLETE';

      return (
        <Typography
          variant="body2"
          sx={{
            color: isOverdue ? '#ef4444' : 'inherit',
            fontWeight: isOverdue ? 600 : 400,
          }}
        >
          {format(date, 'MMM d')}
        </Typography>
      );
    },
  },
  {
    field: 'lastActivityAt',
    headerName: 'Last Activity',
    width: 120,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      if (!params.value) return <Typography variant="body2">-</Typography>;

      const date = new Date(params.value as string);
      return (
        <Typography variant="body2" sx={{ color: '#6b7280' }}>
          {formatDistanceToNow(date, { addSuffix: true })}
        </Typography>
      );
    },
  },
  {
    field: 'driftScore',
    headerName: 'Drift',
    width: 80,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      const score = params.value as number | null;
      if (score === null || score === undefined) return null;

      const color =
        score > 0.7 ? '#ef4444' : score > 0.4 ? '#eab308' : '#22c55e';

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 40,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#e5e7eb',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${score * 100}%`,
                height: '100%',
                backgroundColor: color,
              }}
            />
          </Box>
        </Box>
      );
    },
  },
  {
    field: 'aiSuggestedUpdate',
    headerName: 'AI',
    width: 60,
    renderCell: (params: GridCellParams<IWorkItem>) => {
      if (!params.value) return null;
      return (
        <Tooltip title="AI update suggestion available">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#8b5cf6',
            }}
          />
        </Tooltip>
      );
    },
  },
  {
    field: 'actions',
    type: 'actions',
    headerName: '',
    width: 80,
    getActions: (params: GridRowParams<IWorkItem>) => [
      <GridActionsCellItem
        key="edit"
        icon={<EditIcon />}
        label="Edit"
        onClick={() => onEdit(params.row.id)}
      />,
      <GridActionsCellItem
        key="open"
        icon={<OpenInNewIcon />}
        label="Open Detail"
        onClick={() => onOpenDetail(params.row.id)}
      />,
    ],
  },
];

// ============================================
// COMPONENT
// ============================================

interface WorkGridProps {
  /** Optional className for styling */
  className?: string;
}

export function WorkGrid({ className }: WorkGridProps) {
  const apiRef = useGridApiRef();

  // State
  const [selectedRowIds, setSelectedRowIds] = useAtom(selectedRowIdsAtom);
  const [focusedRowId, setFocusedRowId] = useAtom(focusedRowIdAtom);
  const setDetailPanelWorkItemId = useSetAtom(detailPanelWorkItemIdAtom);
  const [activeFilters] = useAtom(activeFiltersAtom);

  // Data fetching
  const {
    workItems,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useWorkItems({
    filters: activeFilters,
    enabled: true,
  });

  // Use mock data for development
  const mockData = useMemo(() => generateMockWorkItems(100), []);
  const displayData = workItems.length > 0 ? workItems : mockData;

  // Mutations
  const updateWorkItem = useUpdateWorkItem();

  // Keyboard navigation
  const rowIds = useMemo(() => displayData.map((w) => w.id), [displayData]);

  useKeyboardNavigation({
    rowIds,
    onFocusRow: (rowId) => {
      apiRef.current?.scrollToIndexes({
        rowIndex: rowIds.indexOf(rowId),
      });
    },
    onRefresh: () => refetch(),
  });

  // Handlers
  const handleEdit = useCallback((id: string) => {
    setDetailPanelWorkItemId(id);
  }, [setDetailPanelWorkItemId]);

  const handleOpenDetail = useCallback((id: string) => {
    setDetailPanelWorkItemId(id);
  }, [setDetailPanelWorkItemId]);

  const handleSelectionChange = useCallback(
    (newSelection: GridRowSelectionModel) => {
      setSelectedRowIds(newSelection as string[]);
    },
    [setSelectedRowIds]
  );

  const handleRowClick = useCallback(
    (params: GridRowParams<IWorkItem>) => {
      setFocusedRowId(params.row.id);
    },
    [setFocusedRowId]
  );

  const handleRowDoubleClick = useCallback(
    (params: GridRowParams<IWorkItem>) => {
      setDetailPanelWorkItemId(params.row.id);
    },
    [setDetailPanelWorkItemId]
  );

  const handleProcessRowUpdate = useCallback(
    async (newRow: IWorkItem, oldRow: IWorkItem) => {
      // Optimistic update
      await updateWorkItem.mutateAsync({
        id: newRow.id,
        input: {
          title: newRow.title,
          priority: newRow.priority,
          status: newRow.status,
          health: newRow.health,
          targetDate: newRow.targetDate,
        },
      });
      return newRow;
    },
    [updateWorkItem]
  );

  // Load more on scroll
  const handleRowsScrollEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Columns
  const columns = useMemo(
    () => createColumns(handleEdit, handleOpenDetail),
    [handleEdit, handleOpenDetail]
  );

  // Row styling based on health
  const getRowClassName = useCallback((params: GridRowParams<IWorkItem>) => {
    const classes: string[] = [];

    if (params.row.health === 'RED') {
      classes.push('row-health-red');
    } else if (params.row.health === 'YELLOW') {
      classes.push('row-health-yellow');
    }

    if (params.row.atRisk) {
      classes.push('row-at-risk');
    }

    if (params.row.stale) {
      classes.push('row-stale');
    }

    return classes.join(' ');
  }, []);

  return (
    <Box
      className={className}
      sx={{
        height: '100%',
        width: '100%',
        '& .row-health-red': {
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
        },
        '& .row-health-yellow': {
          backgroundColor: 'rgba(234, 179, 8, 0.05)',
        },
        '& .row-at-risk': {
          borderLeft: '3px solid #ef4444',
        },
        '& .row-stale': {
          opacity: 0.7,
        },
        '& .MuiDataGrid-row:hover': {
          backgroundColor: 'rgba(59, 130, 246, 0.04)',
        },
        '& .MuiDataGrid-row.Mui-selected': {
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
        },
      }}
    >
      <DataGridPremium
        apiRef={apiRef}
        rows={displayData}
        columns={columns}
        loading={isLoading}
        // Selection
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectedRowIds}
        onRowSelectionModelChange={handleSelectionChange}
        // Events
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
        processRowUpdate={handleProcessRowUpdate}
        onRowsScrollEnd={handleRowsScrollEnd}
        // Performance
        rowBuffer={10}
        columnBuffer={5}
        // Styling
        getRowClassName={getRowClassName}
        density="compact"
        // Features
        pagination={false}
        slots={{
          toolbar: GridToolbar,
        }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 300 },
          },
        }}
        // Keyboard
        disableColumnMenu={false}
        // Initial state
        initialState={{
          sorting: {
            sortModel: [{ field: 'priority', sort: 'asc' }],
          },
        }}
      />
    </Box>
  );
}

export default WorkGrid;
