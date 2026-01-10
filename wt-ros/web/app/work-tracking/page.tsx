'use client';

import { useState, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Drawer,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  KeyboardCommandKey as CommandIcon,
  Add as AddIcon,
  ViewColumn as ViewColumnIcon,
  Download as DownloadIcon,
  Insights as InsightsIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { HealthStatus, Priority, WorkStatus } from '@wt-ros/common';

import { WorkGrid } from '@/features/work-tracking/components/WorkGrid';
import { InsightsPanel } from '@/features/work-tracking/components/InsightsPanel';
import { useWorkItems } from '@/features/work-tracking/hooks/useWorkItems';
import { useKeyboardNavigation } from '@/features/work-tracking/hooks/useKeyboardNavigation';
import {
  searchQueryAtom,
  selectedRowIdsAtom,
  commandPaletteOpenAtom,
  quickFiltersAtom,
  activeFilterCountAtom,
  detailPanelWorkItemIdAtom,
} from '@/features/work-tracking/stores/gridStore';
import {
  filtersAtom,
  clearFiltersAtom,
  toggleHealthFilterAtom,
  togglePriorityFilterAtom,
  toggleStatusFilterAtom,
} from '@/features/work-tracking/stores/filterStore';

/** Width of the insights panel drawer */
const INSIGHTS_PANEL_WIDTH = 420;

/**
 * Work Tracking Dashboard - Main page with high-density grid
 *
 * Features:
 * - Virtual scrolling for performance
 * - Keyboard-first navigation (CMD+K, arrows)
 * - Health-based row styling
 * - Inline editing with optimistic updates
 * - <100ms perceived latency
 */
export default function WorkTrackingPage() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const selectedRowIds = useAtomValue(selectedRowIdsAtom);
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom);
  const [filters, setFilters] = useAtom(filtersAtom);
  const clearFilters = useSetAtom(clearFiltersAtom);
  const toggleHealthFilter = useSetAtom(toggleHealthFilterAtom);
  const togglePriorityFilter = useSetAtom(togglePriorityFilterAtom);
  const toggleStatusFilter = useSetAtom(toggleStatusFilterAtom);
  const activeFilterCount = useAtomValue(activeFilterCountAtom);
  const setDetailPanelWorkItemId = useSetAtom(detailPanelWorkItemIdAtom);

  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [healthAnchorEl, setHealthAnchorEl] = useState<null | HTMLElement>(null);
  const [priorityAnchorEl, setPriorityAnchorEl] = useState<null | HTMLElement>(null);
  const [statusAnchorEl, setStatusAnchorEl] = useState<null | HTMLElement>(null);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(true);

  // Fetch work items with filters
  const {
    workItems,
    isLoading,
    isFetching,
    refetch,
    totalCount,
  } = useWorkItems({
    filters: {
      ...filters,
      searchQuery: searchQuery || undefined,
    },
  });

  // Enable keyboard navigation
  useKeyboardNavigation();

  // Handlers
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
    },
    [setSearchQuery]
  );

  const handleCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, [setCommandPaletteOpen]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleHealthFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setHealthAnchorEl(event.currentTarget);
  };

  const handlePriorityFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setPriorityAnchorEl(event.currentTarget);
  };

  const handleStatusFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setStatusAnchorEl(event.currentTarget);
  };

  const handleToggleInsightsPanel = useCallback(() => {
    setInsightsPanelOpen((prev) => !prev);
  }, []);

  const handleAttentionItemClick = useCallback(
    (itemId: string) => {
      setDetailPanelWorkItemId(itemId);
    },
    [setDetailPanelWorkItemId]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
            Work Tracking
          </Typography>

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search work items..."
            value={searchQuery}
            onChange={handleSearchChange}
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Chip
                    size="small"
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <CommandIcon sx={{ fontSize: 12 }} />
                        <Typography variant="caption">K</Typography>
                      </Stack>
                    }
                    onClick={handleCommandPalette}
                    sx={{ cursor: 'pointer', height: 20 }}
                  />
                </InputAdornment>
              ),
            }}
          />

          {/* Quick Filters */}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant={filters.health?.length ? 'contained' : 'outlined'}
              onClick={handleHealthFilterClick}
            >
              Health
            </Button>
            <Menu
              anchorEl={healthAnchorEl}
              open={Boolean(healthAnchorEl)}
              onClose={() => setHealthAnchorEl(null)}
            >
              {Object.values(HealthStatus).map((health) => (
                <MenuItem
                  key={health}
                  onClick={() => toggleHealthFilter(health)}
                  selected={filters.health?.includes(health)}
                >
                  {health}
                </MenuItem>
              ))}
            </Menu>

            <Button
              size="small"
              variant={filters.priorities?.length ? 'contained' : 'outlined'}
              onClick={handlePriorityFilterClick}
            >
              Priority
            </Button>
            <Menu
              anchorEl={priorityAnchorEl}
              open={Boolean(priorityAnchorEl)}
              onClose={() => setPriorityAnchorEl(null)}
            >
              {Object.values(Priority).map((priority) => (
                <MenuItem
                  key={priority}
                  onClick={() => togglePriorityFilter(priority)}
                  selected={filters.priorities?.includes(priority)}
                >
                  {priority}
                </MenuItem>
              ))}
            </Menu>

            <Button
              size="small"
              variant={filters.statuses?.length ? 'contained' : 'outlined'}
              onClick={handleStatusFilterClick}
            >
              Status
            </Button>
            <Menu
              anchorEl={statusAnchorEl}
              open={Boolean(statusAnchorEl)}
              onClose={() => setStatusAnchorEl(null)}
            >
              {Object.values(WorkStatus).map((status) => (
                <MenuItem
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  selected={filters.statuses?.includes(status)}
                >
                  {status.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Menu>

            {activeFilterCount > 0 && (
              <Button size="small" color="secondary" onClick={() => clearFilters()}>
                Clear ({activeFilterCount})
              </Button>
            )}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {/* Actions */}
          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {totalCount} items
              {selectedRowIds.length > 0 && ` (${selectedRowIds.length} selected)`}
            </Typography>

            <Tooltip title="Refresh (R)">
              <IconButton onClick={handleRefresh} disabled={isFetching}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Add Work Item">
              <IconButton color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Column Settings">
              <IconButton>
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export">
              <IconButton>
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={insightsPanelOpen ? 'Hide AI Insights' : 'Show AI Insights'}>
              <IconButton
                onClick={handleToggleInsightsPanel}
                color={insightsPanelOpen ? 'primary' : 'default'}
                sx={{
                  bgcolor: insightsPanelOpen ? 'primary.50' : 'transparent',
                  '&:hover': {
                    bgcolor: insightsPanelOpen ? 'primary.100' : 'action.hover',
                  },
                }}
              >
                <InsightsIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {filters.health?.map((health) => (
              <Chip
                key={health}
                label={`Health: ${health}`}
                size="small"
                onDelete={() => toggleHealthFilter(health)}
              />
            ))}
            {filters.priorities?.map((priority) => (
              <Chip
                key={priority}
                label={`Priority: ${priority}`}
                size="small"
                onDelete={() => togglePriorityFilter(priority)}
              />
            ))}
            {filters.statuses?.map((status) => (
              <Chip
                key={status}
                label={`Status: ${status.replace(/_/g, ' ')}`}
                size="small"
                onDelete={() => toggleStatusFilter(status)}
              />
            ))}
            {(filters.needsHelp || filters.atRisk || filters.stale) && (
              <>
                {filters.needsHelp && (
                  <Chip
                    label="Needs Help"
                    size="small"
                    color="warning"
                    onDelete={() => setFilters((f) => ({ ...f, needsHelp: undefined }))}
                  />
                )}
                {filters.atRisk && (
                  <Chip
                    label="At Risk"
                    size="small"
                    color="error"
                    onDelete={() => setFilters((f) => ({ ...f, atRisk: undefined }))}
                  />
                )}
                {filters.stale && (
                  <Chip
                    label="Stale"
                    size="small"
                    color="default"
                    onDelete={() => setFilters((f) => ({ ...f, stale: undefined }))}
                  />
                )}
              </>
            )}
          </Stack>
        </Box>
      )}

      {/* Main Content Area with Grid and Insights Panel */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Work Grid */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
            transition: 'margin-right 0.3s ease',
            marginRight: insightsPanelOpen ? `${INSIGHTS_PANEL_WIDTH}px` : 0,
          }}
        >
          <WorkGrid />
        </Box>

        {/* Insights Panel Drawer */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={insightsPanelOpen}
          sx={{
            width: insightsPanelOpen ? INSIGHTS_PANEL_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: INSIGHTS_PANEL_WIDTH,
              boxSizing: 'border-box',
              top: 'auto',
              height: 'calc(100vh - 64px)', // Subtract AppBar height
              borderLeft: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              bgcolor: 'grey.50',
              p: 2,
            }}
          >
            <InsightsPanel
              defaultExpanded={true}
              maxHeight="calc(100vh - 100px)"
              onAttentionItemClick={handleAttentionItemClick}
            />
          </Box>
        </Drawer>

        {/* Collapsed Insights Toggle (shown when panel is closed) */}
        {!insightsPanelOpen && (
          <Box
            sx={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
            }}
          >
            <Tooltip title="Show AI Insights" placement="left">
              <IconButton
                onClick={handleToggleInsightsPanel}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  borderRadius: '8px 0 0 8px',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  boxShadow: 2,
                }}
              >
                <ChevronRightIcon sx={{ transform: 'rotate(180deg)' }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}
