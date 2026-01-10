-- WT-ROS Seed Data Script
-- Run this AFTER init-db.sql to populate the database with realistic dummy data
-- Usage: psql -U wt_ros -d wt_ros < scripts/seed-data.sql
-- This script is idempotent - safe to run multiple times

-- Clear existing seed data before re-inserting
DELETE FROM activities WHERE id LIKE 'a1000000-0000-0000-0000-%';
DELETE FROM line_comments WHERE id LIKE 'f0000000-0000-0000-0000-%';
DELETE FROM work_updates WHERE id LIKE 'e0000000-0000-0000-0000-%';
DELETE FROM work_items WHERE id LIKE 'd0000000-0000-0000-0000-%';

-- =====================================================
-- WORK ITEMS - Platform Engineering Group
-- =====================================================

-- P0 Critical Items
INSERT INTO work_items (
  id, title, description, dri_id, team_id, group_id,
  target_date, original_target_date, priority, status, health,
  needs_help, at_risk, stale, drift_score, last_activity_at,
  ai_suggested_update, artifacts
) VALUES
(
  'd0000000-0000-0000-0000-000000000001',
  'Critical Security Vulnerability Fix (CVE-2024-1234)',
  'Address critical security vulnerability in authentication module. Requires immediate patching of JWT validation logic and session handling.',
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '3 days',
  NOW() + INTERVAL '3 days',
  'P0', 'IN_PROGRESS', 'RED',
  FALSE, TRUE, FALSE, 0.85, NOW() - INTERVAL '2 hours',
  'Made progress on JWT validation fix. Completed initial patch, currently running security tests. Expecting to deploy hotfix by EOD tomorrow.',
  '[{"type": "GITHUB_PR", "url": "https://github.com/org/repo/pull/456", "title": "fix: patch JWT validation vulnerability"}]'
),
(
  'd0000000-0000-0000-0000-000000000002',
  'Database Connection Pool Exhaustion',
  'Production database experiencing connection pool exhaustion during peak hours. Need to optimize connection handling and implement connection pooling improvements.',
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '5 days',
  NOW() + INTERVAL '7 days',
  'P0', 'IN_PROGRESS', 'YELLOW',
  TRUE, FALSE, FALSE, 0.45, NOW() - INTERVAL '1 day',
  NULL,
  '[{"type": "JIRA_TICKET", "url": "https://jira.company.com/browse/PLAT-123", "title": "PLAT-123: DB Pool Exhaustion"}]'
);

-- P1 High Priority Items
INSERT INTO work_items (
  id, title, description, dri_id, team_id, group_id,
  target_date, original_target_date, priority, status, health,
  needs_help, at_risk, stale, drift_score, last_activity_at,
  ai_suggested_update, artifacts
) VALUES
(
  'd0000000-0000-0000-0000-000000000003',
  'OAuth2 SSO Integration for Enterprise Customers',
  'Implement OAuth2-based Single Sign-On to support enterprise customer requirements. Includes SAML fallback and SCIM provisioning.',
  'c0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days',
  'P1', 'IN_PROGRESS', 'GREEN',
  FALSE, FALSE, FALSE, 0.25, NOW() - INTERVAL '6 hours',
  'Authorization code flow implementation complete. Started work on token refresh logic. Integration tests passing. On track for target date.',
  '[{"type": "GITHUB_PR", "url": "https://github.com/org/repo/pull/789", "title": "feat: OAuth2 authorization code flow"}, {"type": "GOOGLE_DOC", "url": "https://docs.google.com/document/d/abc123", "title": "OAuth2 SSO Technical Design"}]'
),
(
  'd0000000-0000-0000-0000-000000000004',
  'API Rate Limiting Implementation',
  'Implement tiered rate limiting for public API. Include per-user, per-IP, and per-organization limits with configurable thresholds.',
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '10 days',
  NOW() + INTERVAL '10 days',
  'P1', 'NOT_STARTED', 'UNKNOWN',
  FALSE, FALSE, FALSE, NULL, NULL,
  NULL,
  '[]'
),
(
  'd0000000-0000-0000-0000-000000000005',
  'Migrate Legacy Billing Service',
  'Migrate billing service from monolith to microservice architecture. Ensure zero downtime during migration.',
  'c0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '21 days',
  NOW() + INTERVAL '14 days',
  'P1', 'BLOCKED', 'RED',
  TRUE, TRUE, FALSE, 0.78, NOW() - INTERVAL '3 days',
  'Blocked on infrastructure provisioning. DevOps team needs to set up new Kubernetes namespace. Have completed code refactoring and local testing.',
  '[{"type": "SLACK_THREAD", "url": "https://company.slack.com/archives/C123/p1234567890", "title": "Discussion: Billing migration blockers"}]'
);

-- P2 Medium Priority Items
INSERT INTO work_items (
  id, title, description, dri_id, team_id, group_id,
  target_date, original_target_date, priority, status, health,
  needs_help, at_risk, stale, drift_score, last_activity_at,
  ai_suggested_update, artifacts
) VALUES
(
  'd0000000-0000-0000-0000-000000000006',
  'Dashboard Performance Optimization',
  'Optimize main dashboard load time. Target: reduce initial load from 3.2s to under 1s. Implement lazy loading and code splitting.',
  'c0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days',
  'P2', 'IN_PROGRESS', 'GREEN',
  FALSE, FALSE, FALSE, 0.15, NOW() - INTERVAL '4 hours',
  'Implemented code splitting for main dashboard components. Load time reduced to 1.8s. Working on lazy loading for charts. Expecting to hit target by end of week.',
  '[{"type": "GITHUB_PR", "url": "https://github.com/org/repo/pull/892", "title": "perf: implement code splitting for dashboard"}]'
),
(
  'd0000000-0000-0000-0000-000000000007',
  'Add GraphQL Subscriptions Support',
  'Implement WebSocket-based GraphQL subscriptions for real-time updates. Priority: work item changes and notification events.',
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '18 days',
  NOW() + INTERVAL '18 days',
  'P2', 'NOT_STARTED', 'UNKNOWN',
  FALSE, FALSE, FALSE, NULL, NULL,
  NULL,
  '[{"type": "CONFLUENCE_PAGE", "url": "https://confluence.company.com/display/PLAT/GraphQL+Subscriptions", "title": "GraphQL Subscriptions RFC"}]'
),
(
  'd0000000-0000-0000-0000-000000000008',
  'Implement Dark Mode Theme',
  'Add dark mode support across all UI components. Include system preference detection and user toggle.',
  'c0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '12 days',
  NOW() + INTERVAL '12 days',
  'P2', 'IN_PROGRESS', 'GREEN',
  FALSE, FALSE, FALSE, 0.20, NOW() - INTERVAL '1 day',
  NULL,
  '[{"type": "FIGMA_FILE", "url": "https://figma.com/file/xyz123", "title": "Dark Mode Design System"}]'
);

-- P3 Low Priority Items
INSERT INTO work_items (
  id, title, description, dri_id, team_id, group_id,
  target_date, original_target_date, priority, status, health,
  needs_help, at_risk, stale, drift_score, last_activity_at,
  ai_suggested_update, artifacts
) VALUES
(
  'd0000000-0000-0000-0000-000000000009',
  'Update API Documentation',
  'Update OpenAPI spec and developer documentation for v2 API endpoints. Include examples and migration guide.',
  'c0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days',
  'P3', 'NOT_STARTED', 'UNKNOWN',
  FALSE, FALSE, TRUE, NULL, NOW() - INTERVAL '10 days',
  NULL,
  '[]'
),
(
  'd0000000-0000-0000-0000-000000000010',
  'Refactor Legacy Test Suite',
  'Modernize test suite from Jest 27 to 29. Update mocking patterns and improve test coverage.',
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '45 days',
  NOW() + INTERVAL '45 days',
  'P3', 'COMPLETE', 'GREEN',
  FALSE, FALSE, FALSE, 0.10, NOW() - INTERVAL '2 days',
  NULL,
  '[{"type": "GITHUB_PR", "url": "https://github.com/org/repo/pull/750", "title": "chore: upgrade Jest to v29"}]'
);

-- =====================================================
-- WORK ITEMS - Knowledge Discovery Group
-- =====================================================

INSERT INTO work_items (
  id, title, description, dri_id, team_id, group_id,
  target_date, original_target_date, priority, status, health,
  needs_help, at_risk, stale, drift_score, last_activity_at,
  ai_suggested_update, artifacts
) VALUES
(
  'd0000000-0000-0000-0000-000000000011',
  'Implement Semantic Search with Embeddings',
  'Replace keyword search with semantic search using vector embeddings. Integrate with OpenAI embeddings API and implement vector similarity search.',
  'c0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000002',
  NOW() + INTERVAL '21 days',
  NOW() + INTERVAL '21 days',
  'P1', 'IN_PROGRESS', 'GREEN',
  FALSE, FALSE, FALSE, 0.30, NOW() - INTERVAL '5 hours',
  'Completed embedding generation pipeline. Vector database (pgvector) integration in progress. Initial relevance testing shows 40% improvement over keyword search.',
  '[{"type": "GITHUB_PR", "url": "https://github.com/org/repo/pull/901", "title": "feat: add embedding generation service"}, {"type": "GOOGLE_DOC", "url": "https://docs.google.com/document/d/semantic123", "title": "Semantic Search Technical Design"}]'
),
(
  'd0000000-0000-0000-0000-000000000012',
  'Search Results Personalization',
  'Implement personalized search results based on user behavior and preferences. Include A/B testing framework.',
  'c0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000002',
  NOW() + INTERVAL '35 days',
  NOW() + INTERVAL '28 days',
  'P2', 'IN_PROGRESS', 'YELLOW',
  FALSE, TRUE, FALSE, 0.65, NOW() - INTERVAL '2 days',
  'User behavior tracking implemented. Working on recommendation model. Slipped 1 week due to data pipeline issues.',
  '[]'
),
(
  'd0000000-0000-0000-0000-000000000013',
  'Knowledge Graph Integration',
  'Build knowledge graph from document corpus to enable entity-based search and recommendations.',
  'c0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000002',
  NOW() + INTERVAL '60 days',
  NOW() + INTERVAL '60 days',
  'P2', 'NOT_STARTED', 'UNKNOWN',
  FALSE, FALSE, FALSE, NULL, NULL,
  NULL,
  '[{"type": "CONFLUENCE_PAGE", "url": "https://confluence.company.com/display/KD/Knowledge+Graph", "title": "Knowledge Graph Architecture"}]'
);

-- =====================================================
-- WORK ITEMS - Safety & Compliance Group
-- =====================================================

INSERT INTO work_items (
  id, title, description, dri_id, team_id, group_id,
  target_date, original_target_date, priority, status, health,
  needs_help, at_risk, stale, drift_score, last_activity_at,
  ai_suggested_update, artifacts
) VALUES
(
  'd0000000-0000-0000-0000-000000000014',
  'SOC 2 Type II Compliance Audit',
  'Prepare for and pass SOC 2 Type II compliance audit. Includes documentation, control implementation, and evidence collection.',
  'c0000000-0000-0000-0000-000000000001',
  NULL,
  'a0000000-0000-0000-0000-000000000003',
  NOW() + INTERVAL '45 days',
  NOW() + INTERVAL '45 days',
  'P1', 'IN_PROGRESS', 'GREEN',
  FALSE, FALSE, FALSE, 0.22, NOW() - INTERVAL '1 day',
  'Completed 85% of control documentation. Evidence collection ongoing. Auditor kickoff scheduled for next month.',
  '[{"type": "GOOGLE_DOC", "url": "https://docs.google.com/spreadsheets/d/soc2audit", "title": "SOC 2 Control Matrix"}]'
),
(
  'd0000000-0000-0000-0000-000000000015',
  'GDPR Data Deletion Pipeline',
  'Implement automated data deletion pipeline for GDPR right-to-erasure requests. Must complete within 30 days of request.',
  'c0000000-0000-0000-0000-000000000002',
  NULL,
  'a0000000-0000-0000-0000-000000000003',
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days',
  'P1', 'IN_PROGRESS', 'YELLOW',
  TRUE, FALSE, FALSE, 0.40, NOW() - INTERVAL '8 hours',
  'Core deletion logic implemented. Working on cross-service coordination. Need help with backup purge strategy.',
  '[{"type": "GITHUB_PR", "url": "https://github.com/org/repo/pull/823", "title": "feat: GDPR data deletion service"}]'
);

-- =====================================================
-- WORK UPDATES
-- =====================================================

INSERT INTO work_updates (id, work_item_id, content, author_id, week, is_ai_generated, ai_confidence) VALUES
-- Updates for Security Vulnerability Fix
(
  'e0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  '<p><strong>Progress this week:</strong></p><ul><li>Identified root cause of JWT validation vulnerability</li><li>Implemented initial patch for token validation</li><li>Added comprehensive test coverage for edge cases</li></ul><p><strong>Blockers:</strong> None</p><p><strong>Next steps:</strong> Complete security review and deploy hotfix</p>',
  'c0000000-0000-0000-0000-000000000001',
  '2024-W02',
  FALSE,
  NULL
),
(
  'e0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000001',
  '<p><strong>Progress this week:</strong></p><ul><li>Security review completed - approved for deployment</li><li>Staged hotfix in production canary</li><li>Monitoring shows no regressions</li></ul><p><strong>Next steps:</strong> Full production rollout tomorrow</p>',
  'c0000000-0000-0000-0000-000000000001',
  '2024-W03',
  TRUE,
  0.92
),

-- Updates for OAuth2 SSO
(
  'e0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000003',
  '<p><strong>Progress this week:</strong></p><ul><li>Completed OAuth2 authorization code flow implementation</li><li>Added PKCE support for enhanced security</li><li>Integration tests passing with Okta and Azure AD</li></ul><p><strong>Risks:</strong> None identified</p><p><strong>Next steps:</strong> Implement token refresh and session management</p>',
  'c0000000-0000-0000-0000-000000000002',
  '2024-W02',
  FALSE,
  NULL
),

-- Updates for Billing Migration
(
  'e0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005',
  '<p><strong>Progress this week:</strong></p><ul><li>Completed code refactoring for microservice architecture</li><li>All unit tests passing</li><li>Local integration testing complete</li></ul><p><strong>Blockers:</strong> Waiting on DevOps for Kubernetes namespace provisioning. ETA unknown.</p><p><strong>Risks:</strong> May slip further if infrastructure not ready this week</p>',
  'c0000000-0000-0000-0000-000000000002',
  '2024-W03',
  FALSE,
  NULL
),

-- Updates for Dashboard Performance
(
  'e0000000-0000-0000-0000-000000000005',
  'd0000000-0000-0000-0000-000000000006',
  '<p><strong>Progress this week:</strong></p><ul><li>Implemented code splitting - bundle size reduced by 45%</li><li>Added lazy loading for chart components</li><li>Initial load time down from 3.2s to 1.8s</li></ul><p><strong>Next steps:</strong> Optimize image loading and implement service worker caching</p>',
  'c0000000-0000-0000-0000-000000000002',
  '2024-W03',
  TRUE,
  0.88
),

-- Updates for Semantic Search
(
  'e0000000-0000-0000-0000-000000000006',
  'd0000000-0000-0000-0000-000000000011',
  '<p><strong>Progress this week:</strong></p><ul><li>Set up embedding generation pipeline using OpenAI ada-002</li><li>Integrated pgvector extension for similarity search</li><li>Built initial indexing for 100k documents</li></ul><p><strong>Preliminary results:</strong> 40% improvement in search relevance (measured by click-through rate)</p><p><strong>Next steps:</strong> Scale indexing to full corpus, optimize query performance</p>',
  'c0000000-0000-0000-0000-000000000003',
  '2024-W03',
  FALSE,
  NULL
);

-- =====================================================
-- LINE COMMENTS
-- =====================================================

INSERT INTO line_comments (id, update_id, start_offset, end_offset, content, author_id, resolved, mention_ids) VALUES
(
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000004',
  150,
  200,
  'Can you escalate the infrastructure request? This is blocking a P1 item.',
  'c0000000-0000-0000-0000-000000000003',
  FALSE,
  ARRAY['c0000000-0000-0000-0000-000000000002']::UUID[]
),
(
  'f0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000001',
  0,
  50,
  'Great progress! Make sure to update the security runbook with the new validation logic.',
  'c0000000-0000-0000-0000-000000000002',
  TRUE,
  ARRAY['c0000000-0000-0000-0000-000000000001']::UUID[]
),
(
  'f0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000006',
  200,
  280,
  'Impressive improvement! Do we have benchmarks against competitors?',
  'c0000000-0000-0000-0000-000000000001',
  FALSE,
  ARRAY['c0000000-0000-0000-0000-000000000003']::UUID[]
);

-- =====================================================
-- ACTIVITIES (for AI synthesis)
-- =====================================================

INSERT INTO activities (id, work_item_id, source, action, actor_id, actor_name, content, url, metadata, occurred_at) VALUES
-- GitHub activities
(
  'a1000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'GITHUB_PR',
  'opened',
  'c0000000-0000-0000-0000-000000000001',
  'Alice Engineer',
  'fix: patch JWT validation vulnerability',
  'https://github.com/org/repo/pull/456',
  '{"additions": 245, "deletions": 89, "files_changed": 12}',
  NOW() - INTERVAL '2 days'
),
(
  'a1000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000001',
  'GITHUB_PR',
  'review_approved',
  'c0000000-0000-0000-0000-000000000002',
  'Bob Manager',
  'LGTM! Security team has reviewed.',
  'https://github.com/org/repo/pull/456',
  '{"review_state": "approved"}',
  NOW() - INTERVAL '1 day'
),
(
  'a1000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000003',
  'GITHUB_PR',
  'opened',
  'c0000000-0000-0000-0000-000000000002',
  'Bob Manager',
  'feat: OAuth2 authorization code flow',
  'https://github.com/org/repo/pull/789',
  '{"additions": 892, "deletions": 45, "files_changed": 23}',
  NOW() - INTERVAL '3 days'
),

-- Slack activities
(
  'a1000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005',
  'SLACK_THREAD',
  'message',
  'c0000000-0000-0000-0000-000000000002',
  'Bob Manager',
  'Still waiting on DevOps for the K8s namespace. @devops any update?',
  'https://company.slack.com/archives/C123/p1234567890',
  '{"channel": "#platform-eng", "thread_ts": "1234567890.123456"}',
  NOW() - INTERVAL '3 days'
),
(
  'a1000000-0000-0000-0000-000000000005',
  'd0000000-0000-0000-0000-000000000002',
  'SLACK_THREAD',
  'message',
  'c0000000-0000-0000-0000-000000000001',
  'Alice Engineer',
  'Seeing connection pool warnings again. Investigating with increased logging.',
  'https://company.slack.com/archives/C456/p9876543210',
  '{"channel": "#incidents", "thread_ts": "9876543210.654321"}',
  NOW() - INTERVAL '1 day'
),

-- Jira activities
(
  'a1000000-0000-0000-0000-000000000006',
  'd0000000-0000-0000-0000-000000000002',
  'JIRA_TICKET',
  'status_change',
  'c0000000-0000-0000-0000-000000000001',
  'Alice Engineer',
  'Moved to In Progress',
  'https://jira.company.com/browse/PLAT-123',
  '{"from_status": "To Do", "to_status": "In Progress"}',
  NOW() - INTERVAL '4 days'
);

-- =====================================================
-- Summary
-- =====================================================
-- Total seed data:
-- - 15 Work Items (across 3 groups, various priorities/statuses)
-- - 6 Work Updates (mix of human and AI-generated)
-- - 3 Line Comments
-- - 6 Activities (GitHub, Slack, Jira)

SELECT 'Seed data loaded successfully!' AS status;
SELECT
  (SELECT COUNT(*) FROM work_items) AS work_items,
  (SELECT COUNT(*) FROM work_updates) AS work_updates,
  (SELECT COUNT(*) FROM line_comments) AS line_comments,
  (SELECT COUNT(*) FROM activities) AS activities;
