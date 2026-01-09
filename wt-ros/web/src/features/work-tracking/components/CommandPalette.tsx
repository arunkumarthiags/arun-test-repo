'use client';

/**
 * CommandPalette - CMD+K quick actions menu
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAtom } from 'jotai';

import { commandPaletteOpenAtom } from '../stores/gridStore';

// ============================================
// TYPES
// ============================================

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: 'action' | 'filter' | 'navigation';
  action: () => void;
}

// ============================================
// COMPONENT
// ============================================

interface CommandPaletteProps {
  onCreateWorkItem?: () => void;
  onRefresh?: () => void;
  onFilterChange?: (filter: string) => void;
}

export function CommandPalette({
  onCreateWorkItem,
  onRefresh,
  onFilterChange,
}: CommandPaletteProps) {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom);
  const [query, setQuery] = useState('');

  // Define commands
  const commands: Command[] = useMemo(
    () => [
      {
        id: 'create',
        label: 'Create Work Item',
        description: 'Add a new work item to track',
        icon: <AddIcon />,
        shortcut: 'C',
        category: 'action',
        action: () => {
          setOpen(false);
          onCreateWorkItem?.();
        },
      },
      {
        id: 'refresh',
        label: 'Refresh',
        description: 'Reload work items',
        icon: <RefreshIcon />,
        shortcut: 'R',
        category: 'action',
        action: () => {
          setOpen(false);
          onRefresh?.();
        },
      },
      {
        id: 'filter-needs-help',
        label: 'Filter: Needs Help',
        description: 'Show items flagged as needing help',
        icon: <FlagIcon />,
        category: 'filter',
        action: () => {
          setOpen(false);
          onFilterChange?.('needsHelp');
        },
      },
      {
        id: 'filter-at-risk',
        label: 'Filter: At Risk',
        description: 'Show items marked as at risk',
        icon: <WarningIcon />,
        category: 'filter',
        action: () => {
          setOpen(false);
          onFilterChange?.('atRisk');
        },
      },
      {
        id: 'filter-stale',
        label: 'Filter: Stale',
        description: 'Show items with no recent activity',
        icon: <ScheduleIcon />,
        category: 'filter',
        action: () => {
          setOpen(false);
          onFilterChange?.('stale');
        },
      },
      {
        id: 'filter-complete',
        label: 'Filter: Complete',
        description: 'Show completed items',
        icon: <CheckIcon />,
        category: 'filter',
        action: () => {
          setOpen(false);
          onFilterChange?.('complete');
        },
      },
      {
        id: 'filter-p0',
        label: 'Filter: P0 Only',
        description: 'Show only P0 priority items',
        icon: <FilterIcon />,
        category: 'filter',
        action: () => {
          setOpen(false);
          onFilterChange?.('p0');
        },
      },
    ],
    [setOpen, onCreateWorkItem, onRefresh, onFilterChange]
  );

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      action: [],
      filter: [],
      navigation: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Handle close
  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, [setOpen]);

  // Handle command selection
  const handleSelect = useCallback(
    (command: Command) => {
      command.action();
      setQuery('');
    },
    []
  );

  // Handle keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]);
        }
      }
    },
    [filteredCommands, selectedIndex, handleSelect]
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: '20%',
          m: 0,
          borderRadius: 2,
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Search Input */}
        <TextField
          fullWidth
          placeholder="Type a command or search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: {
              '& fieldset': { border: 'none' },
            },
          }}
          sx={{
            '& .MuiInputBase-root': {
              py: 1.5,
              px: 2,
            },
          }}
        />

        {/* Commands List */}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', maxHeight: 400, overflow: 'auto' }}>
          {/* Actions */}
          {groupedCommands.action.length > 0 && (
            <>
              <Typography
                variant="caption"
                sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}
              >
                Actions
              </Typography>
              <List disablePadding>
                {groupedCommands.action.map((command, index) => (
                  <ListItem key={command.id} disablePadding>
                    <ListItemButton
                      selected={selectedIndex === index}
                      onClick={() => handleSelect(command)}
                      sx={{ py: 1, px: 2 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>{command.icon}</ListItemIcon>
                      <ListItemText
                        primary={command.label}
                        secondary={command.description}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      {command.shortcut && (
                        <Chip
                          label={command.shortcut}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: '#f3f4f6',
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* Filters */}
          {groupedCommands.filter.length > 0 && (
            <>
              <Typography
                variant="caption"
                sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}
              >
                Filters
              </Typography>
              <List disablePadding>
                {groupedCommands.filter.map((command, index) => (
                  <ListItem key={command.id} disablePadding>
                    <ListItemButton
                      selected={
                        selectedIndex === groupedCommands.action.length + index
                      }
                      onClick={() => handleSelect(command)}
                      sx={{ py: 1, px: 2 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>{command.icon}</ListItemIcon>
                      <ListItemText
                        primary={command.label}
                        secondary={command.description}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* No Results */}
          {filteredCommands.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No commands found for "{query}"
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            <Chip label="↑↓" size="small" sx={{ height: 18, mr: 0.5 }} /> Navigate
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Chip label="↵" size="small" sx={{ height: 18, mr: 0.5 }} /> Select
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Chip label="esc" size="small" sx={{ height: 18, mr: 0.5 }} /> Close
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
