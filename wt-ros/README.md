# WT-ROS: AI-Native Work Tracking System

> **"Work as a Living Object"** - Replace manual status updates with AI-synthesized insights

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-TypeGraphQL-e10098.svg)](https://typegraphql.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Installation Guide](#installation-guide)
6. [Configuration](#configuration)
7. [Running the Application](#running-the-application)
8. [User Manual](#user-manual)
9. [API Reference](#api-reference)
10. [Component Documentation](#component-documentation)
11. [Development Guide](#development-guide)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)
15. [Contributing](#contributing)

---

## Overview

### What is WT-ROS?

WT-ROS (Work Tracking - Roblox Operating System) is an AI-native work tracking platform designed to:

- **Automate Status Updates**: AI synthesizes weekly updates from connected artifacts (Slack, GitHub, Jira, Google Docs)
- **Provide Blazingly Fast Reviews**: <100ms grid performance for live executive meetings
- **Enable Clear Project Health**: Automated risk flagging and drift detection
- **Support Bi-Directional Value**: Feedback loops and "Asks" workflow for leadership response

### Key Features

| Feature | Description |
|---------|-------------|
| **AI-Synthesized Updates** | Automatically generate weekly status updates from activity streams |
| **High-Density Grid** | MUI X Data Grid Premium with virtual scrolling for 1000+ items |
| **Line-Level Commenting** | Google Docs-style feedback on specific text in updates |
| **Keyboard-First Navigation** | CMD+K command palette, arrow navigation, bulk actions |
| **Predictive Drift Detection** | Flag items when strategy docs and code changes diverge |
| **Risk Flagging** | Automatic detection of stale, at-risk, and blocked items |
| **Real-Time Collaboration** | @mentions, notifications, and threaded discussions |

### Value Proposition

| FROM | TO |
|------|-----|
| Sluggish tools during live reviews | <100ms performant interface |
| Manual data duplication across systems | Automatic sync from source systems |
| Vague, stale updates hiding risks | Clear health status with automated flagging |
| One-way "black hole" communication | Bi-directional feedback and support workflow |
| Disconnected context | Clear connections to source of truth artifacts |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                              │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Web App   │  Chrome Ext │ Slack Bot   │  ROS Apps   │   MCP CLI   │
│  (Next.js)  │  (Manifest) │  (@slack)   │  (Future)   │  (Claude)   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴─────────────┴──────┬──────┴─────────────┘
                                          │
                           ┌──────────────▼──────────────┐
                           │     GraphQL API (4000)      │
                           │  TypeGraphQL + DataLoader   │
                           └──────────────┬──────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
    ┌─────────▼─────────┐    ┌───────────▼───────────┐    ┌─────────▼─────────┐
    │    PostgreSQL     │    │        Redis          │    │   Sync Engine     │
    │   (Primary DB)    │    │   (Cache + Pub/Sub)   │    │  (Activity Sync)  │
    └───────────────────┘    └───────────────────────┘    └─────────┬─────────┘
                                                                    │
                              ┌─────────────────────────────────────┼─────────────┐
                              │                                     │             │
                    ┌─────────▼─────────┐              ┌───────────▼───────┐     │
                    │   Slack API       │              │    GitHub API     │     │
                    │   (@slack/bolt)   │              │    (Octokit)      │     │
                    └───────────────────┘              └───────────────────┘     │
                                                                                 │
                                                              ┌──────────────────▼──┐
                                                              │   Claude AI (LLM)   │
                                                              │   Synthesis Engine  │
                                                              └─────────────────────┘
```

### 5-Agent Swarm Architecture

The system was built using a parallelized 5-agent development model:

| Agent | Persona | Workspace | Responsibility |
|-------|---------|-----------|----------------|
| **Agent-Core** | Data Architect | `api/src/entities`, `api/src/resolvers` | TypeORM schemas, TypeGraphQL API, DataLoader |
| **Agent-Sync** | Synthesis Lead | `sync/`, `api/src/services` | AI-driven updates via Slack/GitHub APIs |
| **Agent-UI** | Frontend Engineer | `web/src/features/work-tracking` | MUI X Data Grid, TipTap commenting |
| **Agent-Glue** | Integration Spec | `services/mcp-server/`, `common/` | MCP server, Chrome Extension |
| **Agent-Strategist** | Innovation Auditor | `api/src/services` | Drift detection, quality enforcement |

### Directory Structure

```
wt-ros/
├── api/                          # GraphQL API Server
│   ├── src/
│   │   ├── entities/             # TypeORM entities
│   │   │   ├── WorkItem.entity.ts
│   │   │   ├── WorkUpdate.entity.ts
│   │   │   ├── LineComment.entity.ts
│   │   │   ├── User.entity.ts
│   │   │   ├── Team.entity.ts
│   │   │   ├── Group.entity.ts
│   │   │   └── Artifact.entity.ts
│   │   ├── resolvers/            # TypeGraphQL resolvers
│   │   │   ├── WorkItemResolver.ts
│   │   │   ├── WorkUpdateResolver.ts
│   │   │   └── LineCommentResolver.ts
│   │   ├── loaders/              # DataLoader implementations
│   │   │   ├── UserLoader.ts
│   │   │   ├── TeamLoader.ts
│   │   │   ├── GroupLoader.ts
│   │   │   └── WorkItemLoader.ts
│   │   ├── repositories/         # Data access layer
│   │   │   ├── WorkItemRepository.ts
│   │   │   ├── WorkUpdateRepository.ts
│   │   │   └── LineCommentRepository.ts
│   │   ├── services/             # Business logic
│   │   │   ├── DriftDetector.ts
│   │   │   ├── QualityEnforcer.ts
│   │   │   └── AnomalyDetector.ts
│   │   └── __tests__/            # Jest tests
│   ├── package.json
│   └── tsconfig.json
│
├── web/                          # Next.js Web Application
│   ├── app/                      # App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── work-tracking/
│   │       └── page.tsx
│   ├── src/
│   │   ├── features/
│   │   │   └── work-tracking/
│   │   │       ├── components/   # React components
│   │   │       │   ├── WorkGrid.tsx
│   │   │       │   ├── RichTextEditor.tsx
│   │   │       │   ├── DetailPanel.tsx
│   │   │       │   └── CommandPalette.tsx
│   │   │       ├── hooks/        # Custom hooks
│   │   │       │   ├── useWorkItems.ts
│   │   │       │   ├── useWorkItemMutation.ts
│   │   │       │   └── useKeyboardNavigation.ts
│   │   │       └── stores/       # Jotai stores
│   │   │           ├── gridStore.ts
│   │   │           └── filterStore.ts
│   │   ├── lib/
│   │   │   └── graphql-client.ts
│   │   └── providers/
│   │       └── Providers.tsx
│   ├── package.json
│   └── tsconfig.json
│
├── sync/                         # Sync Engine Service
│   ├── src/
│   │   ├── agents/
│   │   │   └── WorkUpdateAgent.ts
│   │   └── integrations/
│   │       ├── slack/
│   │       │   ├── SlackClient.ts
│   │       │   └── SlackActivityExtractor.ts
│   │       └── github/
│   │           ├── GitHubClient.ts
│   │           └── GitHubActivityExtractor.ts
│   ├── package.json
│   └── tsconfig.json
│
├── services/
│   └── mcp-server/               # Model Context Protocol Server
│       ├── src/
│       │   ├── index.ts
│       │   ├── tools/
│       │   │   └── WorkItemTools.ts
│       │   └── handlers/
│       │       └── WorkItemHandler.ts
│       ├── package.json
│       └── tsconfig.json
│
├── chrome-extension/             # Chrome Extension
│   ├── src/
│   │   └── background.ts
│   ├── manifest.json
│   ├── package.json
│   └── vite.config.ts
│
├── common/                       # Shared Types & Utilities
│   ├── src/
│   │   └── types/
│   │       ├── work-item.types.ts
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/
│   └── init-db.sql              # Database initialization
│
├── docker-compose.yml           # Docker services
├── package.json                 # Root package.json (workspaces)
├── MULTI_AGENT_PLAN.md          # Agent coordination document
└── README.md                    # This file
```

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | ≥20.0.0 | JavaScript runtime |
| **npm** | ≥10.0.0 | Package manager |
| **Docker** | ≥24.0.0 | Container runtime |
| **Docker Compose** | ≥2.20.0 | Multi-container orchestration |
| **Git** | ≥2.40.0 | Version control |

### Optional Software

| Software | Purpose |
|----------|---------|
| **PostgreSQL Client** | Direct database access (`psql`) |
| **Redis CLI** | Direct cache inspection (`redis-cli`) |
| **GraphQL Playground** | API exploration |

### System Requirements

- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 10GB free space
- **OS**: macOS, Linux, or Windows with WSL2

---

## Quick Start

### 30-Second Setup

```bash
# Clone the repository
git clone https://github.com/your-org/wt-ros.git
cd wt-ros

# Start all services with Docker
docker-compose up -d

# Wait for services to be healthy (about 30 seconds)
docker-compose ps

# Open the web application
open http://localhost:3000
```

### Verify Installation

```bash
# Check service health
curl http://localhost:4000/health

# Test GraphQL API
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

---

## Installation Guide

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/wt-ros.git
cd wt-ros
```

### Step 2: Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Or install individually
npm install -w @wt-ros/common
npm install -w @wt-ros/api
npm install -w @wt-ros/web
npm install -w @wt-ros/sync
npm install -w @wt-ros/mcp-server
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

### Step 4: Start Database Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for healthy status
docker-compose ps
```

### Step 5: Initialize Database

```bash
# Run the initialization script
docker exec -i wt-ros-postgres psql -U wt_ros -d wt_ros < scripts/init-db.sql

# Or use npm script
npm run db:migrate -w @wt-ros/api
```

### Step 6: Build Common Package

```bash
# Build shared types
npm run build -w @wt-ros/common
```

### Step 7: Start Development Servers

```bash
# Start all services in development mode
npm run dev

# Or start individually
npm run dev:api   # GraphQL API on port 4000
npm run dev:web   # Next.js on port 3000
npm run dev:sync  # Sync engine
```

---

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_URL=postgresql://wt_ros:local_dev@localhost:5432/wt_ros
POSTGRES_USER=wt_ros
POSTGRES_PASSWORD=local_dev
POSTGRES_DB=wt_ros

# ===========================================
# REDIS CONFIGURATION
# ===========================================
REDIS_URL=redis://localhost:6379

# ===========================================
# API CONFIGURATION
# ===========================================
PORT=4000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=http://localhost:3000

# ===========================================
# SLACK INTEGRATION
# ===========================================
# Get these from https://api.slack.com/apps
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# ===========================================
# GITHUB INTEGRATION
# ===========================================
# Create at https://github.com/settings/tokens
GITHUB_TOKEN=ghp_your-personal-access-token

# ===========================================
# AI CONFIGURATION
# ===========================================
# Get from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-api-key

# ===========================================
# OPTIONAL: EXTERNAL SERVICES
# ===========================================
# JIRA_BASE_URL=https://your-company.atlassian.net
# JIRA_EMAIL=your-email@company.com
# JIRA_API_TOKEN=your-jira-api-token

# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Configuration Files

#### `api/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

#### `web/next.config.js`
```javascript
module.exports = {
  experimental: {
    serverActions: true,
  },
  transpilePackages: ['@wt-ros/common'],
}
```

---

## Running the Application

### Development Mode

```bash
# Start all services
npm run dev

# This runs concurrently:
# - API server at http://localhost:4000
# - Web app at http://localhost:3000
```

### Production Mode

```bash
# Build all packages
npm run build

# Start production servers
npm start
```

### Docker Mode

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (full reset)
docker-compose down -v
```

### Individual Services

```bash
# API only
npm run dev:api

# Web only
npm run dev:web

# Sync engine only
npm run dev:sync

# MCP server only
npm run dev -w @wt-ros/mcp-server
```

---

## User Manual

### Getting Started

#### 1. Accessing the Application

Open your browser and navigate to:
- **Web App**: http://localhost:3000
- **GraphQL Playground**: http://localhost:4000/graphql

#### 2. Understanding the Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo]  Work Tracking    [Search]           [+ New]  [Settings]    │
├─────────────────────────────────────────────────────────────────────┤
│  Filters: [All Groups ▼] [All Status ▼] [All Priority ▼] [Clear]   │
├─────────────────────────────────────────────────────────────────────┤
│  ☐ │ P │ ● │ Work Item                    │ Status      │ Target   │
│────┼───┼───┼──────────────────────────────┼─────────────┼──────────│
│  ☐ │ P0│ 🔴│ Critical Security Fix        │ In Progress │ Jan 15   │
│  ☐ │ P1│ 🟡│ User Auth Flow              │ Blocked     │ Jan 20   │
│  ☐ │ P2│ 🟢│ Dashboard Redesign          │ Complete    │ Jan 10   │
│  ☐ │ P3│ ⚪│ Documentation Update         │ Not Started │ Feb 1    │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Workflows

#### Creating a Work Item

1. Click **[+ New]** button or press `C`
2. Fill in the required fields:
   - **Title**: Clear, specific name (e.g., "Implement OAuth2 SSO")
   - **Description**: Detailed scope and acceptance criteria
   - **Priority**: P0 (Critical) to P3 (Low)
   - **Target Date**: Expected completion date
   - **DRI**: Directly Responsible Individual
   - **Group/Team**: Organizational assignment

3. Click **Create** or press `Cmd+Enter`

#### Updating Work Items

**Inline Editing:**
1. Double-click any cell to edit
2. Make changes
3. Press `Enter` to save or `Escape` to cancel

**Detail Panel:**
1. Click a row or press `Enter` on focused row
2. Edit fields in the side panel
3. Changes auto-save

#### Adding Weekly Updates

1. Open a work item's detail panel
2. Navigate to **Updates** tab
3. Write your update in the rich text editor
4. Use `@` to mention team members
5. Click **Publish Update**

**AI-Suggested Updates:**
- If an AI suggestion appears, review it
- Click **Accept & Publish** to use as-is
- Click **Edit** to modify before publishing
- Click **Dismiss** to write your own

#### Line-Level Commenting

1. Open a work update
2. Select text you want to comment on
3. Click the comment icon or press `Cmd+Shift+C`
4. Write your feedback
5. Click **Comment**

To resolve comments:
1. Click on the highlighted text
2. View the comment thread
3. Click **Resolve** when addressed

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `C` | Create new work item |
| `R` | Refresh data |
| `/` | Focus search |
| `↑` / `↓` | Navigate rows |
| `Enter` | Open detail panel |
| `Space` | Toggle row selection |
| `Cmd+A` | Select all |
| `Escape` | Close panel / clear selection |
| `Delete` | Delete selected items |
| `X` | Expand/collapse row |

### Command Palette (Cmd+K)

The command palette provides quick access to:

```
╭─────────────────────────────────────────╮
│ 🔍 Type a command or search...          │
├─────────────────────────────────────────┤
│ ACTIONS                                 │
│   ➕ Create Work Item              C    │
│   🔄 Refresh                       R    │
├─────────────────────────────────────────┤
│ FILTERS                                 │
│   🚩 Filter: Needs Help                 │
│   ⚠️  Filter: At Risk                   │
│   ⏰ Filter: Stale                      │
│   ✅ Filter: Complete                   │
│   🔴 Filter: P0 Only                    │
├─────────────────────────────────────────┤
│ ↑↓ Navigate  ↵ Select  esc Close        │
╰─────────────────────────────────────────╯
```

### Understanding Health Status

| Status | Color | Meaning |
|--------|-------|---------|
| **Green** | 🟢 | On track, no issues |
| **Yellow** | 🟡 | Minor concerns, monitor closely |
| **Red** | 🔴 | At risk, needs immediate attention |
| **Unknown** | ⚪ | Not yet assessed |

### Understanding Flags

| Flag | Icon | Meaning |
|------|------|---------|
| **Needs Help** | 🚩 | DRI has requested assistance |
| **At Risk** | ⚠️ | Automated or manual risk flag |
| **Stale** | ⏰ | No activity for >7 days |

### Filtering and Sorting

**Quick Filters:**
- Click filter dropdowns in the toolbar
- Multiple selections allowed
- Filters combine with AND logic

**Column Sorting:**
- Click column header to sort ascending
- Click again for descending
- Shift+click to multi-column sort

**Search:**
- Type in search box or press `/`
- Searches title and description
- Debounced for performance (300ms)

### Linking Artifacts

1. Open work item detail panel
2. Navigate to **Artifacts** tab
3. Click **Link Artifact**
4. Paste URL from:
   - GitHub (PR, Issue, Repository)
   - Slack (Thread permalink)
   - Google Docs
   - Confluence
   - Jira
5. System auto-detects artifact type
6. Click **Link**

### Bulk Operations

1. Select multiple rows using:
   - Checkbox clicks
   - Shift+click for range
   - Cmd+A for all
2. Bulk action toolbar appears
3. Available actions:
   - Change status
   - Change priority
   - Change health
   - Delete

---

## API Reference

### GraphQL Endpoint

```
POST http://localhost:4000/graphql
```

### Authentication

Include JWT token in headers:
```
Authorization: Bearer <token>
```

### Queries

#### Get Work Items

```graphql
query GetWorkItems(
  $filters: WorkItemFiltersInput
  $pagination: PaginationInput
  $sort: SortInput
) {
  workItems(filters: $filters, pagination: $pagination, sort: $sort) {
    edges {
      node {
        id
        title
        description
        priority
        status
        health
        targetDate
        needsHelp
        atRisk
        stale
        driftScore
        lastActivityAt
        dri {
          id
          displayName
          avatarUrl
        }
        team {
          id
          name
        }
        group {
          id
          name
        }
        artifacts {
          id
          type
          url
          title
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
      totalCount
    }
  }
}
```

**Variables:**
```json
{
  "filters": {
    "groupIds": ["group-1"],
    "priorities": ["P0", "P1"],
    "statuses": ["IN_PROGRESS", "BLOCKED"],
    "atRisk": true
  },
  "pagination": {
    "first": 50,
    "after": "cursor123"
  },
  "sort": {
    "field": "priority",
    "direction": "ASC"
  }
}
```

#### Get Single Work Item

```graphql
query GetWorkItem($id: ID!) {
  workItem(id: $id) {
    id
    title
    description
    priority
    status
    health
    targetDate
    originalTargetDate
    needsHelp
    atRisk
    stale
    aiSuggestedUpdate
    driftScore
    artifacts {
      id
      type
      url
      title
      lastActivityAt
    }
    updates {
      id
      content
      week
      isAiGenerated
      aiConfidence
      createdAt
      author {
        displayName
      }
      lineComments {
        id
        content
        startOffset
        endOffset
        resolved
        author {
          displayName
        }
      }
    }
    childWorkItems {
      id
      title
      status
    }
  }
}
```

#### Get Stale Work Items

```graphql
query GetStaleItems($threshold: Int = 7) {
  staleWorkItems(threshold: $threshold) {
    id
    title
    lastActivityAt
    dri {
      displayName
    }
  }
}
```

#### Get Drifting Work Items

```graphql
query GetDriftingItems($threshold: Float = 0.7) {
  driftingWorkItems(threshold: $threshold) {
    id
    title
    driftScore
    status
  }
}
```

### Mutations

#### Create Work Item

```graphql
mutation CreateWorkItem($input: CreateWorkItemInput!) {
  createWorkItem(input: $input) {
    id
    title
    priority
    status
  }
}
```

**Variables:**
```json
{
  "input": {
    "title": "Implement OAuth2 SSO",
    "description": "Add single sign-on support using OAuth2",
    "driId": "user-123",
    "groupId": "group-456",
    "teamId": "team-789",
    "priority": "P1",
    "targetDate": "2024-02-15T00:00:00Z"
  }
}
```

#### Update Work Item

```graphql
mutation UpdateWorkItem($id: ID!, $input: UpdateWorkItemInput!) {
  updateWorkItem(id: $id, input: $input) {
    id
    title
    status
    health
    updatedAt
  }
}
```

**Variables:**
```json
{
  "id": "work-item-123",
  "input": {
    "status": "IN_PROGRESS",
    "health": "YELLOW",
    "needsHelp": true
  }
}
```

#### Create Work Update

```graphql
mutation CreateWorkUpdate(
  $workItemId: ID!
  $input: CreateWorkUpdateInput!
) {
  createWorkUpdate(workItemId: $workItemId, input: $input) {
    id
    content
    week
    createdAt
  }
}
```

**Variables:**
```json
{
  "workItemId": "work-item-123",
  "input": {
    "content": "Completed the authorization code flow. Currently integrating with identity provider. On track for target date."
  }
}
```

#### Accept AI Suggested Update

```graphql
mutation AcceptAiUpdate($workItemId: ID!) {
  acceptAiSuggestedUpdate(workItemId: $workItemId) {
    id
    content
    isAiGenerated
    aiConfidence
  }
}
```

#### Add Line Comment

```graphql
mutation AddLineComment($updateId: ID!, $input: LineCommentInput!) {
  addLineComment(updateId: $updateId, input: $input) {
    id
    content
    startOffset
    endOffset
    author {
      displayName
    }
  }
}
```

**Variables:**
```json
{
  "updateId": "update-123",
  "input": {
    "startOffset": 0,
    "endOffset": 45,
    "content": "Can you provide more details on the blocker?",
    "mentionIds": ["user-456"]
  }
}
```

#### Link Artifact

```graphql
mutation LinkArtifact($workItemId: ID!, $artifact: ArtifactInput!) {
  linkArtifact(workItemId: $workItemId, artifact: $artifact) {
    id
    type
    url
    title
  }
}
```

**Variables:**
```json
{
  "workItemId": "work-item-123",
  "artifact": {
    "type": "GITHUB_PR",
    "url": "https://github.com/org/repo/pull/456",
    "title": "feat: Add OAuth2 support"
  }
}
```

#### Flag As At Risk

```graphql
mutation FlagAtRisk($workItemId: ID!, $reason: String!) {
  flagAsAtRisk(workItemId: $workItemId, reason: $reason) {
    id
    atRisk
    health
  }
}
```

### Enums

```graphql
enum Priority {
  P0  # Critical
  P1  # High
  P2  # Medium
  P3  # Low
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

enum ArtifactType {
  JIRA_TICKET
  GITHUB_PR
  GITHUB_ISSUE
  SLACK_THREAD
  GOOGLE_DOC
  CONFLUENCE_PAGE
  FIGMA_FILE
}
```

---

## Component Documentation

### WorkGrid Component

High-density data grid for displaying and managing work items.

```tsx
import { WorkGrid } from '@/features/work-tracking/components';

<WorkGrid className="h-full" />
```

**Features:**
- Virtual scrolling for 1000+ rows
- Inline editing with optimistic updates
- Health-based row styling
- Keyboard navigation
- Checkbox selection
- Column sorting and filtering

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### RichTextEditor Component

TipTap-based rich text editor with commenting support.

```tsx
import { RichTextEditor } from '@/features/work-tracking/components';

<RichTextEditor
  content={initialContent}
  updateId="update-123"
  lineComments={existingComments}
  users={availableUsers}
  placeholder="Write your update..."
  editable={true}
  onChange={(content) => console.log(content)}
  onCommentAdded={(comment) => console.log(comment)}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | `''` | Initial HTML content |
| `updateId` | `string` | - | Update ID for linking comments |
| `lineComments` | `ILineComment[]` | `[]` | Existing comments |
| `users` | `IUser[]` | `[]` | Users for @mentions |
| `placeholder` | `string` | `'Write your update...'` | Placeholder text |
| `editable` | `boolean` | `true` | Enable/disable editing |
| `onChange` | `(content: string) => void` | - | Content change callback |
| `onCommentAdded` | `(comment: ILineComment) => void` | - | Comment added callback |

### DetailPanel Component

Side panel for viewing and editing work item details.

```tsx
import { DetailPanel } from '@/features/work-tracking/components';

<DetailPanel width={480} />
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `workItem` | `IWorkItem` | - | Work item (controlled mode) |
| `width` | `number` | `480` | Panel width in pixels |

### CommandPalette Component

CMD+K style command palette for quick actions.

```tsx
import { CommandPalette } from '@/features/work-tracking/components';

<CommandPalette
  onCreateWorkItem={() => setCreateModalOpen(true)}
  onRefresh={() => refetch()}
  onFilterChange={(filter) => setActiveFilter(filter)}
/>
```

### Custom Hooks

#### useWorkItems

Fetch work items with React Query.

```tsx
import { useWorkItems } from '@/features/work-tracking/hooks';

const {
  workItems,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  refetch,
} = useWorkItems({
  filters: { groupIds: ['group-1'] },
  enabled: true,
});
```

#### useWorkItemMutation

Mutations for work items with optimistic updates.

```tsx
import {
  useUpdateWorkItem,
  useBulkUpdateWorkItems,
  useCreateWorkUpdate,
  useAcceptAiSuggestedUpdate,
  useAddLineComment,
  useResolveLineComment,
} from '@/features/work-tracking/hooks';

const updateWorkItem = useUpdateWorkItem();
await updateWorkItem.mutateAsync({
  id: 'work-item-123',
  input: { status: 'COMPLETE' },
});
```

#### useKeyboardNavigation

Keyboard-first navigation for the grid.

```tsx
import { useKeyboardNavigation } from '@/features/work-tracking/hooks';

const {
  focusedRowId,
  selectedRowIds,
  moveFocus,
  toggleSelection,
  selectAll,
  clearSelection,
  commandPaletteOpen,
} = useKeyboardNavigation({
  rowIds: workItems.map((w) => w.id),
  onFocusRow: (id) => gridApiRef.current?.scrollToIndexes({ rowIndex }),
  onRefresh: () => refetch(),
  onFocusSearch: () => searchInputRef.current?.focus(),
});
```

---

## Development Guide

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint all packages
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Format with Prettier
npm run format
```

### Adding New Features

1. **Plan**: Update `MULTI_AGENT_PLAN.md` with the feature spec
2. **Types**: Add types to `common/src/types/`
3. **Backend**: Implement entity → repository → resolver
4. **Frontend**: Implement hook → component
5. **Test**: Add Jest tests
6. **Document**: Update this README

### Creating New Entities

1. Create entity in `api/src/entities/`:

```typescript
// api/src/entities/NewEntity.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ObjectType, Field, ID } from 'type-graphql';

@Entity('new_entities')
@ObjectType()
export class NewEntity {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id!: string;

  @Column()
  @Field()
  name!: string;
}
```

2. Create repository in `api/src/repositories/`:

```typescript
// api/src/repositories/NewEntityRepository.ts
import { Repository } from 'typeorm';
import { NewEntity } from '../entities/NewEntity.entity';

export class NewEntityRepository extends Repository<NewEntity> {
  async findByName(name: string): Promise<NewEntity | null> {
    return this.findOne({ where: { name } });
  }
}
```

3. Create resolver in `api/src/resolvers/`:

```typescript
// api/src/resolvers/NewEntityResolver.ts
import { Resolver, Query, Arg } from 'type-graphql';
import { NewEntity } from '../entities/NewEntity.entity';

@Resolver(() => NewEntity)
export class NewEntityResolver {
  @Query(() => NewEntity, { nullable: true })
  async newEntity(@Arg('id') id: string): Promise<NewEntity | null> {
    // Implementation
  }
}
```

### Creating New React Components

1. Create component in `web/src/features/work-tracking/components/`:

```tsx
// web/src/features/work-tracking/components/NewComponent.tsx
'use client';

import React from 'react';

interface NewComponentProps {
  title: string;
  onAction?: () => void;
}

export function NewComponent({ title, onAction }: NewComponentProps) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

2. Export from index:

```typescript
// web/src/features/work-tracking/components/index.ts
export { NewComponent } from './NewComponent';
```

### Database Migrations

```bash
# Generate migration from entity changes
npm run typeorm migration:generate -w @wt-ros/api -- -n MigrationName

# Run pending migrations
npm run db:migrate

# Revert last migration
npm run typeorm migration:revert -w @wt-ros/api
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test -w @wt-ros/api
npm test -w @wt-ros/web

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Structure

```typescript
// api/src/__tests__/work-item.test.ts
import { WorkItemResolver } from '../resolvers/WorkItemResolver';
import { WorkItemRepository } from '../repositories/WorkItemRepository';

describe('WorkItemResolver', () => {
  let resolver: WorkItemResolver;
  let repository: jest.Mocked<WorkItemRepository>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findWithFilters: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    resolver = new WorkItemResolver(repository);
  });

  describe('workItem', () => {
    it('should return work item by id', async () => {
      const mockItem = { id: '123', title: 'Test' };
      repository.findById.mockResolvedValue(mockItem);

      const result = await resolver.workItem('123', mockContext);

      expect(result).toEqual(mockItem);
      expect(repository.findById).toHaveBeenCalledWith('123');
    });

    it('should return null for non-existent item', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await resolver.workItem('999', mockContext);

      expect(result).toBeNull();
    });
  });

  describe('workItems', () => {
    it('should fetch work items with filters', async () => {
      repository.findWithFilters.mockResolvedValue({
        items: [{ id: '1' }, { id: '2' }],
        totalCount: 2,
        hasNextPage: false,
      });

      const result = await resolver.workItems(
        { priorities: ['P0'] },
        { first: 50 },
        { field: 'priority', direction: 'ASC' }
      );

      expect(result.edges).toHaveLength(2);
      expect(result.pageInfo.totalCount).toBe(2);
    });

    it('should resolve in under 100ms', async () => {
      const start = performance.now();

      await resolver.workItems({}, { first: 100 }, {});

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});
```

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit Tests | `**/src/__tests__/*.test.ts` | Test individual functions/classes |
| Integration Tests | `**/src/__tests__/*.integration.ts` | Test component interactions |
| E2E Tests | `e2e/` | Full user flow testing |

---

## Deployment

### Docker Production Build

```dockerfile
# api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/wt_ros_prod
REDIS_URL=redis://redis-host:6379
JWT_SECRET=<secure-random-string>
CORS_ORIGIN=https://your-domain.com
```

### Health Checks

```bash
# API health endpoint
GET /health

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

### Monitoring

Recommended monitoring setup:
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack or Datadog
- **Tracing**: OpenTelemetry
- **Alerts**: PagerDuty or Opsgenie

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Start if not running
docker-compose up -d postgres

# Check logs
docker-compose logs postgres
```

#### Redis Connection Failed

```
Error: Redis connection to localhost:6379 failed
```

**Solution:**
```bash
# Check if Redis is running
docker-compose ps redis

# Start if not running
docker-compose up -d redis

# Test connection
redis-cli ping
```

#### GraphQL Schema Errors

```
Error: Cannot determine GraphQL output type for 'WorkItem'
```

**Solution:**
1. Ensure TypeORM entities have `@ObjectType()` decorator
2. Ensure fields have `@Field()` decorator
3. Run `npm run build -w @wt-ros/common` to rebuild types

#### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::4000
```

**Solution:**
```bash
# Find process using port
lsof -i :4000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=4001 npm run dev:api
```

#### Module Not Found

```
Error: Cannot find module '@wt-ros/common'
```

**Solution:**
```bash
# Build common package first
npm run build -w @wt-ros/common

# Then start the service
npm run dev:api
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# API-specific debugging
DEBUG=wt-ros:api npm run dev:api

# Database query logging
DEBUG=typeorm:* npm run dev:api
```

### Performance Issues

#### Slow Grid Loading

1. Check Redis cache hit rate
2. Verify DataLoader is batching queries
3. Check database indexes exist
4. Enable query logging to find slow queries

```typescript
// Enable query logging
createConnection({
  logging: ['query', 'error'],
  maxQueryExecutionTime: 100, // Log queries > 100ms
});
```

#### High Memory Usage

1. Check for memory leaks with `--inspect` flag
2. Monitor with `node --inspect npm run dev:api`
3. Open Chrome DevTools at `chrome://inspect`

---

## Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add tests
chore: update dependencies
```

### Pull Request Guidelines

1. Update documentation for new features
2. Add tests for new functionality
3. Ensure all tests pass
4. Update MULTI_AGENT_PLAN.md if architecture changes
5. Request review from appropriate agent owner

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
- [ ] Performance requirements met (<100ms for grid operations)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/wt-ros/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/wt-ros/discussions)
- **Slack**: #wt-ros-support

---

## Acknowledgments

Built with the 5-Agent Swarm Architecture:
- **Agent-Core**: Data architecture and API design
- **Agent-UI**: Frontend components and user experience
- **Agent-Sync**: Integration and AI synthesis
- **Agent-Glue**: Cross-system connectivity
- **Agent-Strategist**: Quality and innovation assurance

---

*Last Updated: January 2024*
