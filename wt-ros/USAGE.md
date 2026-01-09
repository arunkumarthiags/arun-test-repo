# WT-ROS Usage Guide

A practical guide to using the AI-Native Work Tracking System.

---

## Table of Contents

1. [Running with Dummy Data](#running-with-dummy-data)
2. [Getting Started](#getting-started)
3. [Your First Work Item](#your-first-work-item)
4. [Daily Workflows](#daily-workflows)
5. [Weekly Status Updates](#weekly-status-updates)
6. [Using AI Features](#using-ai-features)
7. [Collaboration](#collaboration)
8. [Keyboard Shortcuts Reference](#keyboard-shortcuts-reference)
9. [Chrome Extension](#chrome-extension)
10. [MCP Integration with Claude](#mcp-integration-with-claude)
11. [Tips & Best Practices](#tips--best-practices)

---

## Running with Dummy Data

Follow these steps to run the application with pre-populated sample data.

### Prerequisites

Make sure you have installed:
- Docker and Docker Compose
- Node.js >= 20.0.0
- npm >= 10.0.0

### Quick Start (Recommended)

```bash
# 1. Navigate to the wt-ros directory
cd wt-ros

# 2. Start the database and cache services
docker-compose up -d postgres redis

# 3. Wait for services to be healthy (about 10-15 seconds)
docker-compose ps

# 4. The init-db.sql runs automatically and creates:
#    - 3 Groups (Platform Engineering, Knowledge Discovery, Safety & Compliance)
#    - 3 Teams (Backend, Frontend, Search)
#    - 3 Users (Alice, Bob, Carol)

# 5. Load the dummy work items and updates
docker exec -i wt-ros-postgres psql -U wt_ros -d wt_ros < scripts/seed-data.sql

# 6. Install dependencies and start the app
npm install
npm run build -w @wt-ros/common
npm run dev

# 7. Open the app
open http://localhost:3000
```

### What's in the Dummy Data?

The seed data includes realistic work items across three groups:

**Platform Engineering (8 items)**
| Priority | Title | Status | Health |
|----------|-------|--------|--------|
| P0 | Critical Security Vulnerability Fix | In Progress | Red |
| P0 | Database Connection Pool Exhaustion | In Progress | Yellow |
| P1 | OAuth2 SSO Integration | In Progress | Green |
| P1 | API Rate Limiting | Not Started | Unknown |
| P1 | Migrate Legacy Billing Service | Blocked | Red |
| P2 | Dashboard Performance Optimization | In Progress | Green |
| P2 | GraphQL Subscriptions Support | Not Started | Unknown |
| P2 | Implement Dark Mode | In Progress | Green |
| P3 | Update API Documentation | Not Started | Stale |
| P3 | Refactor Legacy Test Suite | Complete | Green |

**Knowledge Discovery (3 items)**
| Priority | Title | Status | Health |
|----------|-------|--------|--------|
| P1 | Semantic Search with Embeddings | In Progress | Green |
| P2 | Search Results Personalization | In Progress | Yellow |
| P2 | Knowledge Graph Integration | Not Started | Unknown |

**Safety & Compliance (2 items)**
| Priority | Title | Status | Health |
|----------|-------|--------|--------|
| P1 | SOC 2 Type II Compliance Audit | In Progress | Green |
| P1 | GDPR Data Deletion Pipeline | In Progress | Yellow |

**Also includes:**
- 6 Weekly status updates (mix of human and AI-generated)
- 3 Line comments with @mentions
- 6 Activity records (GitHub PRs, Slack threads, Jira tickets)

### Alternative: Docker-Only Setup

If you prefer to run everything in Docker:

```bash
# Start all services
docker-compose up -d

# Load seed data
docker exec -i wt-ros-postgres psql -U wt_ros -d wt_ros < scripts/seed-data.sql

# Access the app at http://localhost:3000
```

### Resetting the Data

To reset and start fresh:

```bash
# Stop all services and remove volumes
docker-compose down -v

# Start fresh (init-db.sql runs automatically)
docker-compose up -d postgres redis

# Reload seed data
docker exec -i wt-ros-postgres psql -U wt_ros -d wt_ros < scripts/seed-data.sql
```

### Test Users

The dummy data includes three test users you can work with:

| Name | Email | Team | Role |
|------|-------|------|------|
| Alice Engineer | alice@example.com | Backend | DRI on security/infra items |
| Bob Manager | bob@example.com | Frontend | DRI on UI/SSO items |
| Carol Lead | carol@example.com | Search | DRI on search/discovery items |

---

## Getting Started

### Step 1: Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

You'll see the main work tracking dashboard with a high-density grid view.

### Step 2: Understand the Interface

The interface has three main areas:

```
+------------------------------------------------------------------+
|  Header: Logo, Search bar, + New button, Settings                |
+------------------------------------------------------------------+
|  Filters: Group | Status | Priority | Health | Clear All         |
+------------------------------------------------------------------+
|                                                                  |
|  Work Grid:                                                      |
|  +----+------+--------+---------------------------+--------+     |
|  | P  | Health| DRI   | Title                     | Status |     |
|  +----+------+--------+---------------------------+--------+     |
|  | P0 |  Red | Alice  | Critical Security Fix     | In Prog|     |
|  | P1 | Yellow| Bob   | User Auth Flow            | Blocked|     |
|  | P2 | Green| Carol  | Dashboard Redesign        | Complete|    |
|  +----+------+--------+---------------------------+--------+     |
|                                                                  |
+------------------------------------------------------------------+
```

### Step 3: Set Your Filters

Start by filtering to see work relevant to you:

1. Click the **Group** dropdown and select your team's group
2. Optionally filter by **Status** (e.g., "In Progress", "Blocked")
3. Use the search box to find specific items by title

---

## Your First Work Item

### Creating a New Work Item

**Method 1: Using the Button**
1. Click the **[+ New]** button in the header
2. Fill in the form fields (see below)
3. Click **Create**

**Method 2: Using Keyboard**
1. Press `C` anywhere in the app
2. Fill in the form fields
3. Press `Cmd+Enter` to create

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Clear, specific name | "Implement OAuth2 SSO for Enterprise" |
| **Priority** | P0 (Critical) to P3 (Low) | P1 |
| **Group** | Organizational group | "Platform Team" |
| **DRI** | Directly Responsible Individual | Your name |
| **Target Date** | Expected completion | 2024-02-15 |

### Optional But Recommended

| Field | Description |
|-------|-------------|
| **Description** | Detailed scope and acceptance criteria |
| **Team** | Sub-team within the group |
| **Artifacts** | Links to related docs, PRs, issues |

---

## Daily Workflows

### Checking Your Work Items

1. Open the app
2. Press `/` to focus the search box
3. Type your name to find items where you're the DRI
4. Or use filters: set DRI filter to yourself

### Updating Status

**Quick Status Update:**
1. Find the work item in the grid
2. Double-click the **Status** cell
3. Select the new status from dropdown
4. Press `Enter` to save

**Available Statuses:**
- `Not Started` - Work hasn't begun
- `In Progress` - Currently being worked on
- `Blocked` - Cannot proceed (add blocker details)
- `Complete` - Work is finished
- `Cancelled` - Work is no longer needed

### Updating Health

Health indicates overall project confidence:

| Health | When to Use |
|--------|-------------|
| **Green** | On track, no concerns |
| **Yellow** | Minor concerns, needs monitoring |
| **Red** | At risk, needs attention |
| **Unknown** | Not yet assessed |

To update:
1. Double-click the **Health** cell
2. Select the appropriate status
3. Press `Enter`

### Flagging Items

Use flags to communicate status:

- **Needs Help**: Click the flag icon and select "Request Help"
- **At Risk**: System auto-flags, or manually set via detail panel
- **Stale**: Auto-flagged when no activity for 7+ days

---

## Weekly Status Updates

### Writing an Update

1. Click on a work item row to open the detail panel
2. Navigate to the **Updates** tab
3. Click **Write Update** or scroll to the editor
4. Write your status update using the rich text editor

### What to Include in Updates

A good weekly update includes:

```markdown
## Progress This Week
- Completed X feature
- Made progress on Y component
- Fixed bugs A, B, C

## Blockers
- Waiting on API access from Security team
- Need design review for new screens

## Next Week
- Complete integration testing
- Start documentation

## Risks
- May slip if API access delayed
```

### Using the Rich Text Editor

The editor supports:
- **Bold**: `Cmd+B` or click B button
- **Italic**: `Cmd+I` or click I button
- **Lists**: Click list button or type `- ` at line start
- **Links**: `Cmd+K` or click link button
- **@Mentions**: Type `@` and select a person
- **Code**: Use backticks \`code\`

---

## Using AI Features

### AI-Suggested Updates

The system automatically generates update suggestions by analyzing:
- Your GitHub activity (PRs, commits, issues)
- Slack conversations
- Linked document changes

**To use AI suggestions:**
1. Open a work item's detail panel
2. Look for the **AI Suggested Update** section
3. Review the suggestion
4. Click **Accept & Publish** to use as-is
5. Or click **Edit** to modify before publishing
6. Click **Dismiss** to write your own

### Understanding AI Confidence

AI suggestions include a confidence score:
- **High (80%+)**: Suggestion based on strong activity signals
- **Medium (50-80%)**: Some activity detected, may need additions
- **Low (<50%)**: Limited activity data, review carefully

### Drift Detection

The system automatically detects when work items are "drifting":

- **What it measures**: Alignment between strategy docs and actual code changes
- **Alert threshold**: Drift score > 0.7
- **What to do**: Review flagged items and update status or scope

Drifting items appear with a warning indicator in the grid.

---

## Collaboration

### Adding Comments to Updates

**Line-Level Comments (Google Docs style):**
1. Open a work update
2. Select the specific text you want to comment on
3. Press `Cmd+Shift+C` or click the comment icon
4. Type your comment
5. Click **Comment**

**Resolving Comments:**
1. Click on highlighted text with a comment
2. Read the thread
3. Reply if needed
4. Click **Resolve** when addressed

### @Mentioning Teammates

In any text field:
1. Type `@`
2. Start typing the person's name
3. Select from the dropdown
4. They'll receive a notification

### Linking Artifacts

Connect work items to source materials:

1. Open the work item detail panel
2. Go to **Artifacts** tab
3. Click **Link Artifact**
4. Paste the URL:
   - GitHub PR/Issue: `https://github.com/org/repo/pull/123`
   - Slack thread: Use "Copy link" from Slack
   - Google Doc: Share link from Google Docs
   - Jira ticket: Jira URL
   - Confluence: Page URL
   - Figma: File or frame URL
5. Click **Link** - the system auto-detects the type

---

## Keyboard Shortcuts Reference

### Navigation

| Shortcut | Action |
|----------|--------|
| `Arrow Up/Down` | Move between rows |
| `Enter` | Open detail panel |
| `Escape` | Close panel / Clear selection |
| `/` | Focus search box |
| `Tab` | Move between columns |

### Actions

| Shortcut | Action |
|----------|--------|
| `C` | Create new work item |
| `R` | Refresh data |
| `Space` | Toggle row selection |
| `Cmd+A` | Select all rows |
| `Delete` | Delete selected items |
| `X` | Expand/collapse row |

### Command Palette

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Arrow Up/Down` | Navigate options |
| `Enter` | Select option |
| `Escape` | Close palette |

### Editing

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Save and close |
| `Cmd+B` | Bold text |
| `Cmd+I` | Italic text |
| `Cmd+K` | Insert link |
| `Cmd+Shift+C` | Add line comment |

---

## Chrome Extension

The Chrome Extension automatically tracks your activity across work tools.

### Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `wt-ros/chrome-extension/dist` folder

### Supported Sites

The extension monitors activity on:
- GitHub (PRs, issues, commits)
- Jira (tickets, boards)
- Slack (threads, channels)
- Google Docs (document edits)
- Confluence (page updates)
- Figma (design files)

### How It Works

1. Extension detects when you're on a supported site
2. Captures relevant activity (what you worked on, not content)
3. Links activity to matching work items
4. Activity feeds into AI-suggested updates

### Privacy

- Only tracks metadata (URLs, timestamps, titles)
- Does not capture message content or document text
- Data stays within your organization's system

---

## MCP Integration with Claude

The system exposes an MCP (Model Context Protocol) server for Claude integration.

### Setup

1. Ensure the MCP server is running:
   ```bash
   npm run dev -w @wt-ros/mcp-server
   ```

2. Configure Claude to use the MCP server

### Available Commands in Claude

Once connected, you can ask Claude:

**Query work items:**
```
"Show me all P0 work items that are blocked"
"What's the status of the OAuth implementation?"
"List work items for the Platform team"
```

**Update work:**
```
"Mark the OAuth work item as complete"
"Update the security fix to status In Progress"
"Flag the API migration as at risk"
```

**Get summaries:**
```
"Summarize this week's progress for Platform team"
"What items are stale and need attention?"
"Show items with high drift scores"
```

---

## Tips & Best Practices

### For DRIs (Directly Responsible Individuals)

1. **Update regularly**: At minimum, weekly updates prevent "stale" flags
2. **Link artifacts early**: Connect PRs and docs as you create them
3. **Flag blockers promptly**: Use the "Needs Help" flag immediately
4. **Review AI suggestions**: They save time but may miss context

### For Managers

1. **Use filters effectively**: Create saved filter views for your team
2. **Check drift scores**: High drift items need attention
3. **Review flagged items daily**: Blocked and at-risk items
4. **Use bulk actions**: Update multiple items efficiently

### For Executives

1. **Use P0/P1 filter**: Focus on critical items
2. **Check health distribution**: Quick view of portfolio health
3. **Review stale items**: Items without updates may be stuck
4. **Use Command Palette**: Quick access to common views

### General Tips

1. **Use keyboard navigation**: Much faster than mouse
2. **Trust AI suggestions**: They improve over time
3. **Keep titles specific**: "Fix bug" is bad, "Fix auth timeout on login" is good
4. **Add descriptions**: Future you will thank present you
5. **Close completed items promptly**: Keeps the grid clean

---

## Quick Reference Card

```
+---------------------------+---------------------------+
|  CREATE                   |  NAVIGATE                 |
|  C - New work item        |  Arrow keys - Move rows   |
|  Cmd+Enter - Save         |  Enter - Open detail      |
|                           |  / - Search               |
+---------------------------+---------------------------+
|  VIEW                     |  EDIT                     |
|  Cmd+K - Command palette  |  Double-click - Edit cell |
|  R - Refresh              |  Space - Select row       |
|  X - Expand row           |  Delete - Remove item     |
+---------------------------+---------------------------+
|  COLLABORATE              |  FILTER                   |
|  @ - Mention someone      |  Use dropdowns in toolbar |
|  Cmd+Shift+C - Comment    |  Combine multiple filters |
|                           |  Search by title/desc     |
+---------------------------+---------------------------+
```

---

## Getting Help

- **In-app help**: Press `?` to see keyboard shortcuts
- **Command palette**: Press `Cmd+K` and type "help"
- **Documentation**: See full README.md for technical details
- **Support**: Contact #wt-ros-support on Slack

---

*Last Updated: January 2024*
