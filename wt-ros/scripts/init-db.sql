-- WT-ROS Database Initialization Script
-- This script sets up the initial database schema and extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Create enums
CREATE TYPE priority_enum AS ENUM ('P0', 'P1', 'P2', 'P3');
CREATE TYPE work_status_enum AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'CANCELLED');
CREATE TYPE health_status_enum AS ENUM ('GREEN', 'YELLOW', 'RED', 'UNKNOWN');
CREATE TYPE artifact_type_enum AS ENUM (
  'JIRA_TICKET',
  'GITHUB_PR',
  'GITHUB_ISSUE',
  'SLACK_THREAD',
  'GOOGLE_DOC',
  'CONFLUENCE_PAGE',
  'FIGMA_FILE'
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  lead_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for groups.lead_id after users table exists
ALTER TABLE groups ADD CONSTRAINT fk_groups_lead
  FOREIGN KEY (lead_id) REFERENCES users(id) ON DELETE SET NULL;

-- Work Items table
CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Ownership
  dri_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,

  -- Dates
  target_date TIMESTAMP WITH TIME ZONE,
  original_target_date TIMESTAMP WITH TIME ZONE,

  -- Status
  priority priority_enum NOT NULL DEFAULT 'P2',
  status work_status_enum NOT NULL DEFAULT 'NOT_STARTED',
  health health_status_enum NOT NULL DEFAULT 'UNKNOWN',

  -- Flags
  needs_help BOOLEAN NOT NULL DEFAULT FALSE,
  at_risk BOOLEAN NOT NULL DEFAULT FALSE,
  stale BOOLEAN NOT NULL DEFAULT FALSE,

  -- Relationships
  parent_work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  artifacts JSONB DEFAULT '[]'::JSONB,

  -- AI Generated
  ai_suggested_update TEXT,
  drift_score DECIMAL(3, 2),
  last_activity_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work Updates table
CREATE TABLE IF NOT EXISTS work_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  week VARCHAR(10) NOT NULL, -- Format: 2024-W01
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Line Comments table
CREATE TABLE IF NOT EXISTS line_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  update_id UUID NOT NULL REFERENCES work_updates(id) ON DELETE CASCADE,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  mention_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities table (for sync engine)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  source artifact_type_enum NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255) NOT NULL,
  content TEXT,
  url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
-- Work Items indexes
CREATE INDEX idx_work_items_group_priority_date
  ON work_items(group_id, priority, target_date);
CREATE INDEX idx_work_items_dri ON work_items(dri_id);
CREATE INDEX idx_work_items_team ON work_items(team_id);
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_health ON work_items(health);
CREATE INDEX idx_work_items_flags
  ON work_items(needs_help, at_risk, stale) WHERE needs_help OR at_risk OR stale;
CREATE INDEX idx_work_items_parent ON work_items(parent_work_item_id);
CREATE INDEX idx_work_items_last_activity ON work_items(last_activity_at);
CREATE INDEX idx_work_items_title_search ON work_items USING gin(title gin_trgm_ops);

-- Work Updates indexes
CREATE INDEX idx_work_updates_work_item ON work_updates(work_item_id);
CREATE INDEX idx_work_updates_week ON work_updates(week);
CREATE INDEX idx_work_updates_author ON work_updates(author_id);

-- Line Comments indexes
CREATE INDEX idx_line_comments_update ON line_comments(update_id);
CREATE INDEX idx_line_comments_author ON line_comments(author_id);
CREATE INDEX idx_line_comments_resolved ON line_comments(resolved) WHERE NOT resolved;

-- Activities indexes
CREATE INDEX idx_activities_work_item ON activities(work_item_id);
CREATE INDEX idx_activities_source ON activities(source);
CREATE INDEX idx_activities_occurred_at ON activities(occurred_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_work_items_updated_at
  BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert seed data for development
INSERT INTO groups (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Platform Engineering'),
  ('a0000000-0000-0000-0000-000000000002', 'Knowledge Discovery'),
  ('a0000000-0000-0000-0000-000000000003', 'Safety & Compliance');

INSERT INTO teams (id, name, group_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Backend', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Frontend', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'Search', 'a0000000-0000-0000-0000-000000000002');

INSERT INTO users (id, email, display_name, team_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'alice@example.com', 'Alice Engineer', 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'bob@example.com', 'Bob Manager', 'b0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@example.com', 'Carol Lead', 'b0000000-0000-0000-0000-000000000003');

-- Update group leads
UPDATE groups SET lead_id = 'c0000000-0000-0000-0000-000000000003'
  WHERE id = 'a0000000-0000-0000-0000-000000000002';
