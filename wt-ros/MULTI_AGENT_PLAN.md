# MULTI_AGENT_PLAN.md: WT-ROS AI-Native Work Tracking System

## 1. Project Overview

**WT-ROS** is an AI-native work tracking platform designed to replace manual roadmapping with "Work as a Living Object" synthesis. The goal is to ingest signals from Jira, GitHub, Slack, and Google Docs to automate status reporting and provide "blazingly fast" review interfaces for leadership.

### Core Value Propositions
- **Performance as Baseline**: <100ms grid load times for live executive reviews
- **Automatic Updates**: AI-synthesized weekly updates from connected artifacts
- **Clear Project Health**: Automated risk flagging and drift detection
- **Bi-Directional Value**: Feedback loops and "Asks" workflow for leadership response

---

## 2. Swarm Architecture & Roles

| Agent | Persona | Primary Workspace | Responsibility |
|-------|---------|-------------------|----------------|
| **Agent-Core** | Data Architect | `api/src/entities`, `api/src/resolvers` | TypeORM schemas, TypeGraphQL API, DataLoader optimization |
| **Agent-Sync** | Synthesis Lead | `sync/`, `api/src/services` | AI-driven update generation via @slack/bolt and GitHub APIs |
| **Agent-UI** | Frontend Engineer | `web/src/features/work-tracking` | MUI X Data Grid Premium and TipTap line-level commenting |
| **Agent-Glue** | Integration Spec | `services/mcp-server/`, `common/` | MCP server exposure and Chrome Extension manifest logic |
| **Agent-Strategist** | Innovation Auditor | Project Root | Competitive feature analysis and Predictive Drift Detection |

---

## 3. Shared API Contracts

### 3.1 WorkItem GraphQL Schema

```graphql
type WorkItem {
  id: ID!
  title: String!
  description: String

  # Ownership
  driId: ID!
  dri: User!
  teamId: ID
  team: Team
  groupId: ID!
  group: Group!

  # Dates
  targetDate: DateTime
  originalTargetDate: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!

  # Status & Priority
  priority: Priority!
  status: WorkStatus!
  health: HealthStatus!

  # Flags
  needsHelp: Boolean!
  atRisk: Boolean!
  stale: Boolean!

  # Connections
  artifacts: [Artifact!]!
  updates: [WorkUpdate!]!
  comments: [Comment!]!
  parentWorkItem: WorkItem
  childWorkItems: [WorkItem!]!

  # AI-generated
  aiSuggestedUpdate: String
  driftScore: Float
  lastActivityAt: DateTime
}

enum Priority {
  P0
  P1
  P2
  P3
}

enum WorkStatus {
  NOT_STARTED
  IN_PROGRESS
  BLOCKED
  COMPLETE
  CANCELLED
}

enum HealthStatus {
  GREEN
  YELLOW
  RED
  UNKNOWN
}

type Artifact {
  id: ID!
  type: ArtifactType!
  url: String!
  title: String
  lastActivityAt: DateTime
  metadata: JSON
}

enum ArtifactType {
  JIRA_TICKET
  GITHUB_PR
  GITHUB_ISSUE
  SLACK_THREAD
  GOOGLE_DOC
  CONFLUENCE_PAGE
  FIGMA_FILE
}

type WorkUpdate {
  id: ID!
  workItemId: ID!
  content: String!
  authorId: ID!
  author: User!
  createdAt: DateTime!
  week: String!
  isAiGenerated: Boolean!
  aiConfidence: Float
  lineComments: [LineComment!]!
}

type LineComment {
  id: ID!
  updateId: ID!
  startOffset: Int!
  endOffset: Int!
  content: String!
  authorId: ID!
  author: User!
  createdAt: DateTime!
  resolved: Boolean!
  mentions: [User!]!
}
```

### 3.2 GraphQL Queries

```graphql
type Query {
  # Single item
  workItem(id: ID!): WorkItem

  # Grid queries (optimized for <100ms)
  workItems(
    filters: WorkItemFilters
    pagination: PaginationInput
    sort: SortInput
  ): WorkItemConnection!

  # Board views
  execBreakfastBoard(week: String): [WorkItem!]!
  groupBoard(groupId: ID!, week: String): [WorkItem!]!

  # AI-powered
  staleWorkItems(threshold: Int = 7): [WorkItem!]!
  driftingWorkItems(threshold: Float = 0.7): [WorkItem!]!
}

type Mutation {
  # CRUD
  createWorkItem(input: CreateWorkItemInput!): WorkItem!
  updateWorkItem(id: ID!, input: UpdateWorkItemInput!): WorkItem!
  deleteWorkItem(id: ID!): Boolean!

  # Updates
  createWorkUpdate(workItemId: ID!, input: CreateWorkUpdateInput!): WorkUpdate!
  acceptAiSuggestedUpdate(workItemId: ID!): WorkUpdate!

  # Comments
  addLineComment(updateId: ID!, input: LineCommentInput!): LineComment!
  resolveLineComment(commentId: ID!): LineComment!

  # Artifacts
  linkArtifact(workItemId: ID!, artifact: ArtifactInput!): Artifact!
  unlinkArtifact(workItemId: ID!, artifactId: ID!): Boolean!

  # AI Actions
  triggerSynthesis(workItemId: ID!): WorkItem!
  flagAsAtRisk(workItemId: ID!, reason: String!): WorkItem!
}

input WorkItemFilters {
  groupIds: [ID!]
  teamIds: [ID!]
  driIds: [ID!]
  priorities: [Priority!]
  statuses: [WorkStatus!]
  health: [HealthStatus!]
  needsHelp: Boolean
  atRisk: Boolean
  stale: Boolean
  searchQuery: String
  targetDateRange: DateRange
}
```

---

## 4. Technical Requirements

### 4.1 Backend (Agent-Core)

#### TypeORM Entity Requirements
```typescript
// Required columns for WorkItem entity
interface WorkItemEntity {
  id: string;                    // UUID primary key
  title: string;                 // VARCHAR(255), NOT NULL
  description: string | null;    // TEXT
  driId: string;                 // UUID, NOT NULL, FK to users
  teamId: string | null;         // UUID, FK to teams
  groupId: string;               // UUID, NOT NULL, FK to groups
  targetDate: Date | null;       // TIMESTAMP
  originalTargetDate: Date | null;
  priority: Priority;            // ENUM
  status: WorkStatus;            // ENUM
  health: HealthStatus;          // ENUM
  needsHelp: boolean;            // DEFAULT false
  atRisk: boolean;               // DEFAULT false
  stale: boolean;                // DEFAULT false
  artifacts: object[];           // JSONB
  parentWorkItemId: string | null;
  aiSuggestedUpdate: string | null;
  driftScore: number | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Performance Requirements
- **DataLoader**: Batch all N+1 queries (users, teams, groups)
- **Redis Caching**: Cache grid queries with 30s TTL
- **Pagination**: Cursor-based pagination for infinite scroll
- **Indexes**: Composite indexes on (groupId, priority, targetDate)

### 4.2 Frontend (Agent-UI)

#### MUI X Data Grid Configuration
```typescript
interface GridConfig {
  // Performance
  rowBuffer: 10;
  columnBuffer: 5;
  throttleRowsMs: 100;

  // Features
  pagination: false;              // Virtual scrolling instead
  checkboxSelection: true;
  disableSelectionOnClick: true;

  // Keyboard Navigation
  disableColumnMenu: false;
  disableColumnFilter: false;

  // Custom
  getRowClassName: (params) => health-based styling;
  processRowUpdate: async (newRow) => optimistic update;
}
```

#### TipTap Configuration
```typescript
interface TipTapConfig {
  extensions: [
    StarterKit,
    Mention.configure({ suggestion: mentionSuggestion }),
    Highlight.configure({ multicolor: true }),
    Comments,                     // Custom extension for line comments
    Placeholder,
  ];
  editorProps: {
    handleDOMEvents: {
      mouseup: handleTextSelection,  // For line comment creation
    };
  };
}
```

### 4.3 Sync Engine (Agent-Sync)

#### Activity Ingestion Pipeline
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sources   │────▶│  Normalizer │────▶│   Storage   │
│ Slack/GH/   │     │  Extract &  │     │  Activity   │
│ Jira/Docs   │     │  Transform  │     │   Stream    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Synthesis  │
                    │   Engine    │
                    │  (Claude)   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  WorkUpdate │
                    │  Suggestion │
                    └─────────────┘
```

#### Risk Detection Rules
```typescript
const RISK_RULES = {
  STALE: {
    condition: 'no artifact activity for > 7 days',
    action: 'mark stale = true',
  },
  DATE_SLIP: {
    condition: 'targetDate moved > 2 times',
    action: 'flag atRisk = true',
  },
  NO_UPDATE: {
    condition: 'no WorkUpdate for > 14 days',
    action: 'health = RED',
  },
  REPEATED_UPDATE: {
    condition: 'last 3 updates have > 80% similarity',
    action: 'flag for review',
  },
};
```

### 4.4 MCP Server (Agent-Glue)

#### Exposed Tools
```typescript
const MCP_TOOLS = [
  {
    name: 'get_work_items',
    description: 'Retrieve work items with filters',
    inputSchema: WorkItemFilters,
  },
  {
    name: 'update_work_status',
    description: 'Update work item status/health',
    inputSchema: { workItemId: string, status?: string, health?: string },
  },
  {
    name: 'create_work_update',
    description: 'Add a weekly update to a work item',
    inputSchema: { workItemId: string, content: string },
  },
  {
    name: 'link_artifact',
    description: 'Connect an artifact URL to work item',
    inputSchema: { workItemId: string, url: string, type: ArtifactType },
  },
];
```

### 4.5 Drift Detection (Agent-Strategist)

#### Drift Score Calculation
```typescript
interface DriftDetector {
  // Compare strategy doc content with actual implementation
  calculateDrift(workItemId: string): Promise<DriftScore>;

  // Factors
  factors: {
    docUpdateFrequency: number;      // 0-1
    codeActivityAlignment: number;   // 0-1
    statusAccuracy: number;          // 0-1
    dateStability: number;           // 0-1
  };

  // Threshold for flagging
  alertThreshold: 0.7;
}
```

---

## 5. Milestones & Progress Tracking

### Phase 1: Foundation (Core + Types)
- [x] **CORE-00**: Project structure and shared types
- [ ] **CORE-01**: WorkItem TypeORM Entity & Migration
- [ ] **CORE-02**: WorkUpdate & Comment Entities
- [ ] **CORE-03**: GraphQL Resolvers with DataLoader
- [ ] **CORE-04**: Redis caching layer

### Phase 2: Frontend Grid
- [ ] **UI-01**: High-Density Grid with Virtual Scrolling
- [ ] **UI-02**: Keyboard Navigation (CMD+K, arrows)
- [ ] **UI-03**: Inline Editing & Optimistic Updates
- [ ] **UI-04**: TipTap Rich Text Editor
- [ ] **UI-05**: Line-Level Commenting System

### Phase 3: AI Synthesis
- [ ] **SYNC-01**: Slack Integration (@slack/bolt)
- [ ] **SYNC-02**: GitHub Integration (Octokit)
- [ ] **SYNC-03**: Activity Stream Normalization
- [ ] **SYNC-04**: Update Synthesis Engine
- [ ] **SYNC-05**: Risk Detection Rules

### Phase 4: Integration
- [ ] **GLUE-01**: MCP Server Endpoints
- [ ] **GLUE-02**: Chrome Extension Manifest
- [ ] **GLUE-03**: Real-time Subscriptions

### Phase 5: Intelligence
- [ ] **STRAT-01**: Drift Detection Algorithm
- [ ] **STRAT-02**: Anomaly Flagging Engine
- [ ] **STRAT-03**: Quality Enforcement Rules

---

## 6. Cross-Agent Coordination Protocol

### Communication Rules
1. **Schema Changes**: Agent-Core must update this file BEFORE implementation
2. **Type Changes**: All shared types go in `common/src/types/`
3. **API Changes**: Announce in the "API Changes Log" section below

### Conflict Resolution
- Agent-Core is the authority on database/schema changes
- Agent-Strategist can reject implementations not meeting performance requirements
- Agent-UI owns all React component interfaces

### API Changes Log
```
[2024-01-XX] Initial schema published by Agent-Core
```

---

## 7. Testing Requirements (TDD)

Every feature must have tests written FIRST:

```typescript
// Example test structure
describe('WorkItem', () => {
  describe('Entity', () => {
    it('should create with required fields', async () => {});
    it('should enforce priority enum values', async () => {});
    it('should cascade delete updates', async () => {});
  });

  describe('Resolver', () => {
    it('should fetch work items in <100ms', async () => {});
    it('should batch load users via DataLoader', async () => {});
    it('should respect permission guards', async () => {});
  });

  describe('Grid', () => {
    it('should render 1000 rows without lag', async () => {});
    it('should support keyboard navigation', async () => {});
    it('should show health-based row styling', async () => {});
  });
});
```

---

## 8. Environment Setup

### Required Services
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: wt_ros
      POSTGRES_USER: wt_ros
      POSTGRES_PASSWORD: local_dev
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Environment Variables
```env
DATABASE_URL=postgresql://wt_ros:local_dev@localhost:5432/wt_ros
REDIS_URL=redis://localhost:6379
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
GITHUB_TOKEN=ghp_...
OPENAI_API_KEY=sk-...  # For synthesis
```
