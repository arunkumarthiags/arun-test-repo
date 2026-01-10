'use client';

/**
 * DetailPanel - Side panel for viewing/editing work item details
 */
import React, { useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Link,
} from '@mui/material';
import {
  Close as CloseIcon,
  GitHub as GitHubIcon,
  Description as DocIcon,
  Link as LinkIcon,
  AutoAwesome as AiIcon,
} from '@mui/icons-material';
import { useAtom } from 'jotai';
import { format } from 'date-fns';

import { Priority, WorkStatus, HealthStatus, IWorkItem, ArtifactType } from '@wt-ros/common';
import { detailPanelWorkItemIdAtom } from '../stores/gridStore';
import {
  useUpdateWorkItem,
  useAcceptAiSuggestedUpdate,
} from '../hooks/useWorkItemMutation';
import { RichTextEditor } from './RichTextEditor';

// ============================================
// COMPONENT
// ============================================

interface DetailPanelProps {
  /** Work item to display (for controlled mode) */
  workItem?: IWorkItem | null;
  /** Width of the panel */
  width?: number;
}

export function DetailPanel({ workItem: propWorkItem, width = 480 }: DetailPanelProps) {
  const [detailPanelWorkItemId, setDetailPanelWorkItemId] = useAtom(
    detailPanelWorkItemIdAtom
  );

  // Tabs
  const [activeTab, setActiveTab] = React.useState(0);

  // Mutations
  const updateWorkItem = useUpdateWorkItem();
  const acceptAiUpdate = useAcceptAiSuggestedUpdate();

  // For demo, use mock data if no real data
  const mockWorkItem: IWorkItem = {
    id: detailPanelWorkItemId || 'mock',
    title: 'Implement user authentication flow',
    description: 'Build secure OAuth2 authentication with SSO support',
    driId: 'user-1',
    teamId: 'team-1',
    groupId: 'group-1',
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    originalTargetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    priority: Priority.P1,
    status: WorkStatus.IN_PROGRESS,
    health: HealthStatus.YELLOW,
    needsHelp: false,
    atRisk: true,
    stale: false,
    parentWorkItemId: null,
    artifacts: [
      {
        id: 'artifact-1',
        type: ArtifactType.GITHUB_PR,
        url: 'https://github.com/org/repo/pull/123',
        title: 'PR #123: Add OAuth2 flow',
        lastActivityAt: new Date(),
        metadata: {},
      },
      {
        id: 'artifact-2',
        type: ArtifactType.GOOGLE_DOC,
        url: 'https://docs.google.com/document/d/xxx',
        title: 'Auth Technical Spec',
        lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        metadata: {},
      },
    ],
    aiSuggestedUpdate:
      'Made significant progress on OAuth2 implementation. Completed the authorization code flow and token refresh logic. Currently working on SSO integration with the corporate identity provider. Target date remains on track.',
    driftScore: 0.3,
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  };

  const workItem = propWorkItem || mockWorkItem;
  const isOpen = Boolean(detailPanelWorkItemId);

  // Handlers
  const handleClose = useCallback(() => {
    setDetailPanelWorkItemId(null);
  }, [setDetailPanelWorkItemId]);

  const handleFieldChange = useCallback(
    async (field: keyof IWorkItem, value: any) => {
      if (!workItem) return;
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        input: { [field]: value },
      });
    },
    [workItem, updateWorkItem]
  );

  const handleAcceptAiUpdate = useCallback(async () => {
    if (!workItem) return;
    await acceptAiUpdate.mutateAsync(workItem.id);
  }, [workItem, acceptAiUpdate]);

  // Artifact icon mapping
  const getArtifactIcon = (type: ArtifactType | string) => {
    switch (type) {
      case ArtifactType.GITHUB_PR:
      case ArtifactType.GITHUB_ISSUE:
        return <GitHubIcon fontSize="small" />;
      case ArtifactType.GOOGLE_DOC:
      case ArtifactType.CONFLUENCE_PAGE:
        return <DocIcon fontSize="small" />;
      default:
        return <LinkIcon fontSize="small" />;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      PaperProps={{
        sx: { width, p: 0 },
      }}
    >
      {workItem && (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {workItem.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  label={workItem.priority}
                  size="small"
                  color={workItem.priority === 'P0' ? 'error' : 'default'}
                />
                <Chip
                  label={workItem.status.replace('_', ' ')}
                  size="small"
                  variant="outlined"
                />
                {workItem.atRisk && (
                  <Chip label="At Risk" size="small" color="warning" />
                )}
              </Box>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab label="Details" />
            <Tab label="Updates" />
            <Tab label="Artifacts" />
          </Tabs>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* Details Tab */}
            {activeTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Description"
                  multiline
                  rows={3}
                  value={workItem.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  fullWidth
                />

                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={workItem.priority}
                    label="Priority"
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                  >
                    {Object.values(Priority).map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={workItem.status}
                    label="Status"
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                  >
                    {Object.values(WorkStatus).map((s) => (
                      <MenuItem key={s} value={s}>
                        {s.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Health</InputLabel>
                  <Select
                    value={workItem.health}
                    label="Health"
                    onChange={(e) => handleFieldChange('health', e.target.value)}
                  >
                    {Object.values(HealthStatus).map((h) => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Target Date"
                  type="date"
                  value={
                    workItem.targetDate
                      ? format(new Date(workItem.targetDate), 'yyyy-MM-dd')
                      : ''
                  }
                  onChange={(e) =>
                    handleFieldChange('targetDate', new Date(e.target.value))
                  }
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />

                <Divider sx={{ my: 1 }} />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created: {format(new Date(workItem.createdAt), 'MMM d, yyyy')}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    Last Activity:{' '}
                    {workItem.lastActivityAt
                      ? format(new Date(workItem.lastActivityAt), 'MMM d, h:mm a')
                      : 'None'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Updates Tab */}
            {activeTab === 1 && (
              <Box>
                {/* AI Suggested Update */}
                {workItem.aiSuggestedUpdate && (
                  <Box
                    sx={{
                      mb: 3,
                      p: 2,
                      backgroundColor: '#f5f3ff',
                      borderRadius: 2,
                      border: '1px solid #c4b5fd',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AiIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#7c3aed' }}>
                        AI-Suggested Update
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {workItem.aiSuggestedUpdate}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ backgroundColor: '#7c3aed' }}
                        onClick={handleAcceptAiUpdate}
                        disabled={acceptAiUpdate.isPending}
                      >
                        Accept & Publish
                      </Button>
                      <Button size="small" variant="outlined">
                        Edit
                      </Button>
                      <Button size="small" color="inherit">
                        Dismiss
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* New Update Editor */}
                <Typography variant="subtitle2" gutterBottom>
                  Add Update
                </Typography>
                <RichTextEditor
                  placeholder="Write your weekly update..."
                  onChange={(content) => {
                    // Handle update content
                  }}
                />
              </Box>
            )}

            {/* Artifacts Tab */}
            {activeTab === 2 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Linked Artifacts
                </Typography>
                <List disablePadding>
                  {workItem.artifacts.map((artifact) => (
                    <ListItem
                      key={artifact.id}
                      sx={{
                        px: 0,
                        '&:hover': { backgroundColor: '#f9fafb' },
                        borderRadius: 1,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {getArtifactIcon(artifact.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Link
                            href={artifact.url}
                            target="_blank"
                            rel="noopener"
                            underline="hover"
                          >
                            {artifact.title || artifact.url}
                          </Link>
                        }
                        secondary={artifact.type.replace('_', ' ')}
                      />
                    </ListItem>
                  ))}
                </List>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  sx={{ mt: 2 }}
                >
                  Link Artifact
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export default DetailPanel;
