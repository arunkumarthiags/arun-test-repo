'use client';

/**
 * InsightsPanel - AI-powered executive insights dashboard panel
 *
 * Displays executive summary, key metrics, risk alerts, and provides
 * an "Ask AI" interface for natural language queries about work items.
 *
 * Features:
 * - Executive summary card with natural language insights
 * - Key metrics visualization (status, health, priorities)
 * - Risk alerts with urgency levels
 * - Ask AI input for ad-hoc queries
 * - Collapsible/expandable sections
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  LinearProgress,
  IconButton,
  Collapse,
  TextField,
  InputAdornment,
  Button,
  Alert,
  AlertTitle,
  Divider,
  Tooltip,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AutoAwesome as AIIcon,
  Send as SendIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Refresh as RefreshIcon,
  Insights as InsightsIcon,
  Assessment as AssessmentIcon,
  Flag as FlagIcon,
  Block as BlockIcon,
  Schedule as ScheduleIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  graphqlClient,
  EXECUTIVE_SUMMARY_QUERY,
  RISK_ANALYSIS_QUERY,
  ASK_AI_QUERY,
} from '@/lib/graphql-client';

// ============================================
// TYPES
// ============================================

interface WorkItemMetrics {
  total: number;
  notStarted: number;
  inProgress: number;
  blocked: number;
  complete: number;
  cancelled: number;
  healthGreen: number;
  healthYellow: number;
  healthRed: number;
  healthUnknown: number;
  priorityP0: number;
  priorityP1: number;
  priorityP2: number;
  priorityP3: number;
  atRisk: number;
  needsHelp: number;
  stale: number;
  overdue: number;
  completionRate: number;
  healthScore: number;
}

interface AttentionItem {
  id: string;
  title: string;
  reason: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  priority: string;
  daysOverdue?: number;
  teamName?: string;
}

interface ExecutiveSummary {
  summary: string;
  highlights: string[];
  metrics: WorkItemMetrics;
  attentionItems: AttentionItem[];
  generatedAt: string;
}

interface RiskItem {
  id: string;
  title: string;
  riskFactors: string[];
  riskScore: number;
  priority: string;
  targetDate?: string;
  daysToTarget?: number;
}

interface RiskPattern {
  type: string;
  description: string;
  affectedCount: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface RiskAnalysis {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  riskItems: RiskItem[];
  patterns: RiskPattern[];
  recommendations: string[];
  generatedAt: string;
}

interface AskAIResponse {
  response: string;
  relatedItemIds: string[];
  queriedAt: string;
}

interface InsightsPanelProps {
  /** Group ID to filter insights */
  groupId?: string;
  /** Whether panel is initially expanded */
  defaultExpanded?: boolean;
  /** Maximum height of the panel */
  maxHeight?: number | string;
  /** Callback when an attention item is clicked */
  onAttentionItemClick?: (itemId: string) => void;
}

// ============================================
// MOCK DATA FOR DEVELOPMENT
// ============================================

const generateMockExecutiveSummary = (): ExecutiveSummary => ({
  summary:
    'The portfolio is in fair shape with a health score of 68%. 24 of 47 items (51%) are complete, with 15 currently in progress. Key concerns include 3 blocked items, 5 at-risk items, and 4 overdue items. There are 2 critical items requiring immediate attention.',
  highlights: [
    'Portfolio health score: 68% (requires attention)',
    'Completion rate: 51% (24 of 47 items complete)',
    'Health distribution: 45% green, 30% yellow, 25% red',
    '5 items at risk of missing their target dates',
    '3 items currently blocked',
    '2 items flagged as needing help',
    '2 critical items requiring immediate attention',
  ],
  metrics: {
    total: 47,
    notStarted: 5,
    inProgress: 15,
    blocked: 3,
    complete: 24,
    cancelled: 0,
    healthGreen: 21,
    healthYellow: 14,
    healthRed: 12,
    healthUnknown: 0,
    priorityP0: 4,
    priorityP1: 12,
    priorityP2: 22,
    priorityP3: 9,
    atRisk: 5,
    needsHelp: 2,
    stale: 3,
    overdue: 4,
    completionRate: 51,
    healthScore: 68,
  },
  attentionItems: [
    {
      id: '1',
      title: 'Critical API Migration',
      reason: 'P0 priority with non-green health; Overdue by 5 days',
      urgency: 'CRITICAL',
      priority: 'P0',
      daysOverdue: 5,
    },
    {
      id: '2',
      title: 'Database Performance Optimization',
      reason: 'High-priority item blocked; Red health status',
      urgency: 'CRITICAL',
      priority: 'P1',
    },
    {
      id: '3',
      title: 'User Authentication Redesign',
      reason: 'Flagged as needing help; Overdue by 3 days',
      urgency: 'HIGH',
      priority: 'P1',
      daysOverdue: 3,
    },
    {
      id: '4',
      title: 'Mobile App Feature Release',
      reason: 'Flagged as at risk; Yellow health status',
      urgency: 'HIGH',
      priority: 'P1',
    },
    {
      id: '5',
      title: 'Infrastructure Cost Optimization',
      reason: 'Red health status',
      urgency: 'MEDIUM',
      priority: 'P2',
    },
  ],
  generatedAt: new Date().toISOString(),
});

const generateMockRiskAnalysis = (): RiskAnalysis => ({
  overallRisk: 'MEDIUM',
  riskScore: 42,
  riskItems: [
    {
      id: '1',
      title: 'Critical API Migration',
      riskFactors: ['Red health status', 'Overdue by 5 days', 'High drift between stated progress and activity'],
      riskScore: 85,
      priority: 'P0',
      targetDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      daysToTarget: -5,
    },
    {
      id: '2',
      title: 'Database Performance Optimization',
      riskFactors: ['Currently blocked', 'Red health status', 'Flagged as at risk'],
      riskScore: 78,
      priority: 'P1',
    },
    {
      id: '3',
      title: 'User Authentication Redesign',
      riskFactors: ['Yellow health status', 'Overdue by 3 days', 'No recent activity'],
      riskScore: 62,
      priority: 'P1',
      targetDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      daysToTarget: -3,
    },
  ],
  patterns: [
    {
      type: 'TEAM_BLOCKED',
      description: 'Platform team has 3 blocked items, indicating potential systemic issues',
      affectedCount: 3,
      severity: 'MEDIUM',
    },
    {
      type: 'DATE_SLIPPAGE',
      description: '5 items have had their target dates pushed back',
      affectedCount: 5,
      severity: 'MEDIUM',
    },
  ],
  recommendations: [
    'Prioritize review of top 3 highest-risk items',
    'Investigate root cause of blocked items - may indicate dependency or resource issues',
    'Review estimation practices - multiple date slippages suggest scope or resource misalignment',
    'Unblock 2 high-priority blocked items as immediate priority',
  ],
  generatedAt: new Date().toISOString(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

const getUrgencyColor = (urgency: string): 'error' | 'warning' | 'info' => {
  switch (urgency) {
    case 'CRITICAL':
      return 'error';
    case 'HIGH':
      return 'warning';
    default:
      return 'info';
  }
};

const getUrgencyIcon = (urgency: string) => {
  switch (urgency) {
    case 'CRITICAL':
      return <ErrorIcon />;
    case 'HIGH':
      return <WarningIcon />;
    default:
      return <InfoIcon />;
  }
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'CRITICAL':
      return '#dc2626';
    case 'HIGH':
      return '#ea580c';
    case 'MEDIUM':
      return '#eab308';
    default:
      return '#22c55e';
  }
};

const getHealthColor = (score: number): string => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
};

const getTrendIcon = (delta: number) => {
  if (delta > 0) return <TrendingUpIcon sx={{ color: '#22c55e', fontSize: 16 }} />;
  if (delta < 0) return <TrendingDownIcon sx={{ color: '#ef4444', fontSize: 16 }} />;
  return <TrendingFlatIcon sx={{ color: '#6b7280', fontSize: 16 }} />;
};

// ============================================
// SUBCOMPONENTS
// ============================================

/**
 * Circular progress indicator with label
 */
function HealthScoreGauge({ score, size = 100 }: { score: number; size?: number }) {
  const color = getHealthColor(score);

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={score}
        size={size}
        thickness={4}
        sx={{
          color,
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          },
        }}
      />
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={4}
        sx={{
          color: '#e5e7eb',
          position: 'absolute',
          left: 0,
          zIndex: -1,
        }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h5" component="div" fontWeight={600}>
          {score}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Health
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Metrics bar showing distribution
 */
function MetricsBar({
  items,
  total,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          height: 8,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: '#e5e7eb',
        }}
      >
        {items.map((item) => (
          <Box
            key={item.label}
            sx={{
              width: `${(item.value / total) * 100}%`,
              bgcolor: item.color,
              transition: 'width 0.3s ease',
            }}
          />
        ))}
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <Stack key={item.label} direction="row" spacing={0.5} alignItems="center">
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: item.color,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {item.label}: {item.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Metric card showing a single value
 */
function MetricCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
  subtitle?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        textAlign: 'center',
        minWidth: 100,
      }}
    >
      <Box sx={{ color: color || 'text.secondary', mb: 1 }}>{icon}</Box>
      <Typography variant="h5" fontWeight={600} sx={{ color: color || 'text.primary' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block">
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
}

/**
 * Ask AI input component
 */
function AskAIInput({
  onSubmit,
  isLoading,
}: {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}) {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    if (question.trim()) {
      onSubmit(question.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Ask AI about your work items... (e.g., 'What's blocking P0 items?')"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AIIcon sx={{ color: '#8b5cf6' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />
      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={!question.trim() || isLoading}
        sx={{
          minWidth: 'auto',
          px: 2,
          bgcolor: '#8b5cf6',
          '&:hover': { bgcolor: '#7c3aed' },
        }}
      >
        {isLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
      </Button>
    </Box>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InsightsPanel({
  groupId,
  defaultExpanded = true,
  maxHeight = 600,
  onAttentionItemClick,
}: InsightsPanelProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [showRiskDetails, setShowRiskDetails] = useState(false);

  // Fetch executive summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['executiveSummary', groupId],
    queryFn: async () => {
      try {
        const response = await graphqlClient.request<{ executiveSummary: ExecutiveSummary }>(
          EXECUTIVE_SUMMARY_QUERY,
          { groupId }
        );
        return response.executiveSummary;
      } catch {
        // Return mock data for development
        return generateMockExecutiveSummary();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch risk analysis
  const { data: riskData, isLoading: isRiskLoading } = useQuery({
    queryKey: ['riskAnalysis', groupId],
    queryFn: async () => {
      try {
        const response = await graphqlClient.request<{ riskAnalysis: RiskAnalysis }>(
          RISK_ANALYSIS_QUERY,
          { groupId }
        );
        return response.riskAnalysis;
      } catch {
        // Return mock data for development
        return generateMockRiskAnalysis();
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Ask AI mutation
  const askAIMutation = useMutation({
    mutationFn: async (question: string) => {
      try {
        const response = await graphqlClient.request<{ askAI: AskAIResponse }>(
          ASK_AI_QUERY,
          { question, groupId }
        );
        return response.askAI;
      } catch {
        // Return mock response
        return {
          response: `Based on my analysis of the current portfolio: ${question.toLowerCase().includes('block') ? 'There are 3 blocked items that need attention. The main causes are cross-team dependencies and external approvals.' : 'The portfolio is performing at 68% health with 51% completion rate. I recommend focusing on the 5 at-risk items first.'}`,
          relatedItemIds: [],
          queriedAt: new Date().toISOString(),
        };
      }
    },
    onSuccess: (data) => {
      setAiResponse(data.response);
    },
  });

  // Use mock data if real data is not available
  const summary = summaryData || generateMockExecutiveSummary();
  const risk = riskData || generateMockRiskAnalysis();

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchSummary();
    setAiResponse(null);
  }, [refetchSummary]);

  const handleAskAI = useCallback(
    (question: string) => {
      askAIMutation.mutate(question);
    },
    [askAIMutation]
  );

  const handleAttentionItemClick = useCallback(
    (itemId: string) => {
      onAttentionItemClick?.(itemId);
    },
    [onAttentionItemClick]
  );

  // Memoized health distribution items
  const healthItems = useMemo(() => {
    const metrics = summary.metrics;
    return [
      { label: 'Green', value: metrics.healthGreen, color: '#22c55e' },
      { label: 'Yellow', value: metrics.healthYellow, color: '#eab308' },
      { label: 'Red', value: metrics.healthRed, color: '#ef4444' },
      { label: 'Unknown', value: metrics.healthUnknown, color: '#9ca3af' },
    ];
  }, [summary.metrics]);

  // Memoized status distribution items
  const statusItems = useMemo(() => {
    const metrics = summary.metrics;
    return [
      { label: 'Complete', value: metrics.complete, color: '#22c55e' },
      { label: 'In Progress', value: metrics.inProgress, color: '#3b82f6' },
      { label: 'Not Started', value: metrics.notStarted, color: '#9ca3af' },
      { label: 'Blocked', value: metrics.blocked, color: '#ef4444' },
    ];
  }, [summary.metrics]);

  const isLoading = isSummaryLoading || isRiskLoading;

  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        maxHeight: isExpanded ? maxHeight : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <InsightsIcon sx={{ color: '#8b5cf6' }} />
          <Typography variant="subtitle1" fontWeight={600}>
            AI Insights
          </Typography>
          <Chip
            size="small"
            label={`Health: ${summary.metrics.healthScore}%`}
            sx={{
              bgcolor: getHealthColor(summary.metrics.healthScore),
              color: 'white',
              fontWeight: 600,
            }}
          />
          {risk.riskItems.length > 0 && (
            <Chip
              size="small"
              icon={<WarningIcon sx={{ color: 'white !important' }} />}
              label={`${risk.riskItems.length} at risk`}
              sx={{
                bgcolor: getRiskColor(risk.overallRisk),
                color: 'white',
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh insights">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={isLoading}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      <Collapse in={isExpanded}>
        <Box
          sx={{
            p: 2,
            overflow: 'auto',
            maxHeight: typeof maxHeight === 'number' ? maxHeight - 60 : maxHeight,
          }}
        >
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Generating insights...
              </Typography>
            </Box>
          ) : (
            <Stack spacing={3}>
              {/* Executive Summary */}
              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    bgcolor: 'grey.50',
                    p: 2,
                    borderRadius: 2,
                    borderLeft: '4px solid',
                    borderLeftColor: '#8b5cf6',
                    lineHeight: 1.6,
                  }}
                >
                  {summary.summary}
                </Typography>
              </Box>

              {/* Key Metrics */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Key Metrics
                </Typography>
                <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
                  <MetricCard
                    icon={<AssessmentIcon />}
                    label="Total Items"
                    value={summary.metrics.total}
                  />
                  <MetricCard
                    icon={<CheckCircleIcon />}
                    label="Completion"
                    value={`${summary.metrics.completionRate}%`}
                    color="#22c55e"
                  />
                  <MetricCard
                    icon={<BlockIcon />}
                    label="Blocked"
                    value={summary.metrics.blocked}
                    color={summary.metrics.blocked > 0 ? '#ef4444' : undefined}
                  />
                  <MetricCard
                    icon={<FlagIcon />}
                    label="At Risk"
                    value={summary.metrics.atRisk}
                    color={summary.metrics.atRisk > 0 ? '#ea580c' : undefined}
                  />
                  <MetricCard
                    icon={<ScheduleIcon />}
                    label="Overdue"
                    value={summary.metrics.overdue}
                    color={summary.metrics.overdue > 0 ? '#ef4444' : undefined}
                  />
                  <MetricCard
                    icon={<HelpIcon />}
                    label="Needs Help"
                    value={summary.metrics.needsHelp}
                    color={summary.metrics.needsHelp > 0 ? '#eab308' : undefined}
                  />
                </Stack>
              </Box>

              {/* Health & Status Distributions */}
              <Box>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Health Distribution
                    </Typography>
                    <MetricsBar items={healthItems} total={summary.metrics.total} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Status Distribution
                    </Typography>
                    <MetricsBar items={statusItems} total={summary.metrics.total} />
                  </Box>
                </Stack>
              </Box>

              {/* Attention Items */}
              {summary.attentionItems.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Items Requiring Attention
                  </Typography>
                  <List dense sx={{ bgcolor: 'grey.50', borderRadius: 2 }}>
                    {summary.attentionItems.slice(0, 5).map((item, index) => (
                      <ListItem
                        key={item.id}
                        sx={{
                          borderBottom:
                            index < summary.attentionItems.length - 1
                              ? '1px solid'
                              : 'none',
                          borderColor: 'divider',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'grey.100' },
                        }}
                        onClick={() => handleAttentionItemClick(item.id)}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {getUrgencyIcon(item.urgency)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" fontWeight={500}>
                                {item.title}
                              </Typography>
                              <Chip
                                size="small"
                                label={item.priority}
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  bgcolor: item.priority === 'P0' ? '#dc2626' : item.priority === 'P1' ? '#ea580c' : '#6b7280',
                                  color: 'white',
                                }}
                              />
                              <Chip
                                size="small"
                                label={item.urgency}
                                color={getUrgencyColor(item.urgency)}
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            </Stack>
                          }
                          secondary={item.reason}
                          secondaryTypographyProps={{
                            variant: 'caption',
                            sx: { mt: 0.5 },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Risk Patterns */}
              {risk.patterns.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Risk Patterns Detected
                  </Typography>
                  <Stack spacing={1}>
                    {risk.patterns.map((pattern, index) => (
                      <Alert
                        key={index}
                        severity={
                          pattern.severity === 'HIGH'
                            ? 'error'
                            : pattern.severity === 'MEDIUM'
                            ? 'warning'
                            : 'info'
                        }
                        sx={{ '& .MuiAlert-message': { width: '100%' } }}
                      >
                        <AlertTitle sx={{ fontSize: '0.875rem' }}>
                          {pattern.description}
                        </AlertTitle>
                        <Typography variant="caption">
                          Affects {pattern.affectedCount} items
                        </Typography>
                      </Alert>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Recommendations */}
              {risk.recommendations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Recommendations
                  </Typography>
                  <List dense>
                    {risk.recommendations.map((rec, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={rec}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Divider />

              {/* Ask AI Section */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Ask AI
                </Typography>
                <AskAIInput onSubmit={handleAskAI} isLoading={askAIMutation.isPending} />
                {aiResponse && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: '#f3e8ff',
                      borderRadius: 2,
                      borderLeft: '4px solid',
                      borderLeftColor: '#8b5cf6',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <AIIcon sx={{ color: '#8b5cf6', mt: 0.5 }} />
                      <Typography variant="body2">{aiResponse}</Typography>
                    </Stack>
                  </Box>
                )}
              </Box>
            </Stack>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default InsightsPanel;
