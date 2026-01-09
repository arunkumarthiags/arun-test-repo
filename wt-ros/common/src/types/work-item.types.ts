/**
 * WT-ROS Shared Types
 * These types are the single source of truth for all agents
 */

// ============================================
// ENUMS
// ============================================

export enum Priority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum WorkStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
}

export enum HealthStatus {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
  UNKNOWN = 'UNKNOWN',
}

export enum ArtifactType {
  JIRA_TICKET = 'JIRA_TICKET',
  GITHUB_PR = 'GITHUB_PR',
  GITHUB_ISSUE = 'GITHUB_ISSUE',
  SLACK_THREAD = 'SLACK_THREAD',
  GOOGLE_DOC = 'GOOGLE_DOC',
  CONFLUENCE_PAGE = 'CONFLUENCE_PAGE',
  FIGMA_FILE = 'FIGMA_FILE',
}

// ============================================
// CORE ENTITIES
// ============================================

export interface IWorkItem {
  id: string;
  title: string;
  description: string | null;

  // Ownership
  driId: string;
  teamId: string | null;
  groupId: string;

  // Dates
  targetDate: Date | null;
  originalTargetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Status & Priority
  priority: Priority;
  status: WorkStatus;
  health: HealthStatus;

  // Flags
  needsHelp: boolean;
  atRisk: boolean;
  stale: boolean;

  // Relationships
  parentWorkItemId: string | null;
  artifacts: IArtifact[];

  // AI-generated
  aiSuggestedUpdate: string | null;
  driftScore: number | null;
  lastActivityAt: Date | null;
}

export interface IArtifact {
  id: string;
  type: ArtifactType;
  url: string;
  title: string | null;
  lastActivityAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface IWorkUpdate {
  id: string;
  workItemId: string;
  content: string;
  authorId: string;
  createdAt: Date;
  week: string; // Format: "2024-W01"
  isAiGenerated: boolean;
  aiConfidence: number | null;
}

export interface ILineComment {
  id: string;
  updateId: string;
  startOffset: number;
  endOffset: number;
  content: string;
  authorId: string;
  createdAt: Date;
  resolved: boolean;
  mentionIds: string[];
}

export interface IUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ITeam {
  id: string;
  name: string;
  groupId: string;
}

export interface IGroup {
  id: string;
  name: string;
  leadId: string;
}

// ============================================
// INPUT TYPES
// ============================================

export interface CreateWorkItemInput {
  title: string;
  description?: string;
  driId: string;
  teamId?: string;
  groupId: string;
  targetDate?: Date;
  priority: Priority;
  parentWorkItemId?: string;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  driId?: string;
  teamId?: string;
  targetDate?: Date;
  priority?: Priority;
  status?: WorkStatus;
  health?: HealthStatus;
  needsHelp?: boolean;
  atRisk?: boolean;
}

export interface CreateWorkUpdateInput {
  content: string;
  isAiGenerated?: boolean;
  aiConfidence?: number;
}

export interface LineCommentInput {
  startOffset: number;
  endOffset: number;
  content: string;
  mentionIds?: string[];
}

export interface ArtifactInput {
  type: ArtifactType;
  url: string;
  title?: string;
}

// ============================================
// FILTER & PAGINATION TYPES
// ============================================

export interface WorkItemFilters {
  groupIds?: string[];
  teamIds?: string[];
  driIds?: string[];
  priorities?: Priority[];
  statuses?: WorkStatus[];
  health?: HealthStatus[];
  needsHelp?: boolean;
  atRisk?: boolean;
  stale?: boolean;
  searchQuery?: string;
  targetDateRange?: DateRange;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PaginationInput {
  cursor?: string;
  limit?: number;
}

export interface SortInput {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface WorkItemConnection {
  edges: WorkItemEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface WorkItemEdge {
  cursor: string;
  node: IWorkItem;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

// ============================================
// ACTIVITY STREAM TYPES
// ============================================

export interface IActivity {
  id: string;
  workItemId: string;
  source: ArtifactType;
  action: ActivityAction;
  actorId: string | null;
  actorName: string;
  content: string | null;
  url: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'commented'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'mentioned'
  | 'assigned';

// ============================================
// AI SYNTHESIS TYPES
// ============================================

export interface SynthesisRequest {
  workItemId: string;
  activities: IActivity[];
  previousUpdates: IWorkUpdate[];
  timeframe: DateRange;
}

export interface SynthesisResult {
  suggestedUpdate: string;
  confidence: number;
  highlights: string[];
  risks: RiskFlag[];
}

export interface RiskFlag {
  type: RiskType;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  detectedAt: Date;
}

export type RiskType =
  | 'stale'
  | 'date_slip'
  | 'no_update'
  | 'repeated_update'
  | 'strategy_drift'
  | 'blocked';

// ============================================
// DRIFT DETECTION TYPES
// ============================================

export interface DriftScore {
  workItemId: string;
  score: number; // 0-1, where 1 = high drift
  factors: DriftFactors;
  calculatedAt: Date;
}

export interface DriftFactors {
  docUpdateFrequency: number;
  codeActivityAlignment: number;
  statusAccuracy: number;
  dateStability: number;
}
