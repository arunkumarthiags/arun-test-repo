/**
 * WorkItemTools - MCP Tool Definitions for WT-ROS
 * Defines the schema and metadata for all exposed MCP tools
 */

import { z } from 'zod';
import {
  WorkStatus,
  HealthStatus,
  ArtifactType,
  Priority,
} from '@wt-ros/common';

/**
 * Zod schemas for input validation
 */

// Date range schema
const DateRangeSchema = z.object({
  start: z.string().datetime().describe('Start date in ISO 8601 format'),
  end: z.string().datetime().describe('End date in ISO 8601 format'),
});

// Work item filters schema
export const WorkItemFiltersSchema = z.object({
  groupIds: z.array(z.string()).optional().describe('Filter by group IDs'),
  teamIds: z.array(z.string()).optional().describe('Filter by team IDs'),
  driIds: z.array(z.string()).optional().describe('Filter by DRI (owner) IDs'),
  priorities: z
    .array(z.enum(['P0', 'P1', 'P2', 'P3']))
    .optional()
    .describe('Filter by priorities (P0-P3)'),
  statuses: z
    .array(z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'CANCELLED']))
    .optional()
    .describe('Filter by work statuses'),
  health: z
    .array(z.enum(['GREEN', 'YELLOW', 'RED', 'UNKNOWN']))
    .optional()
    .describe('Filter by health statuses'),
  needsHelp: z.boolean().optional().describe('Filter items that need help'),
  atRisk: z.boolean().optional().describe('Filter items that are at risk'),
  stale: z.boolean().optional().describe('Filter stale items'),
  searchQuery: z.string().optional().describe('Full-text search query'),
  targetDateRange: DateRangeSchema.optional().describe('Filter by target date range'),
});

// Get work items input schema
export const GetWorkItemsInputSchema = z.object({
  filters: WorkItemFiltersSchema.optional().describe('Optional filters to apply'),
  limit: z.number().min(1).max(100).optional().describe('Maximum items to return (1-100)'),
  cursor: z.string().optional().describe('Pagination cursor for next page'),
});

// Update work status input schema
export const UpdateWorkStatusInputSchema = z.object({
  workItemId: z.string().describe('The ID of the work item to update'),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'CANCELLED'])
    .optional()
    .describe('New status for the work item'),
  health: z
    .enum(['GREEN', 'YELLOW', 'RED', 'UNKNOWN'])
    .optional()
    .describe('New health status for the work item'),
});

// Create work update input schema
export const CreateWorkUpdateInputSchema = z.object({
  workItemId: z.string().describe('The ID of the work item to add update to'),
  content: z.string().min(1).describe('The content of the weekly update'),
});

// Link artifact input schema
export const LinkArtifactInputSchema = z.object({
  workItemId: z.string().describe('The ID of the work item to link artifact to'),
  url: z.string().url().describe('The URL of the artifact to link'),
  type: z
    .enum([
      'JIRA_TICKET',
      'GITHUB_PR',
      'GITHUB_ISSUE',
      'SLACK_THREAD',
      'GOOGLE_DOC',
      'CONFLUENCE_PAGE',
      'FIGMA_FILE',
    ])
    .describe('The type of artifact being linked'),
  title: z.string().optional().describe('Optional title for the artifact'),
});

// Get stale items input schema
export const GetStaleItemsInputSchema = z.object({
  threshold: z
    .number()
    .min(1)
    .max(90)
    .optional()
    .describe('Days without activity to consider stale (default: 7)'),
});

/**
 * MCP Tool definitions
 * These define the tools exposed by the MCP server
 */
export const MCP_TOOLS = [
  {
    name: 'get_work_items',
    description:
      'Retrieve work items from the WT-ROS system with optional filters. Returns a list of work items matching the criteria including their status, health, priority, and linked artifacts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filters: {
          type: 'object',
          description: 'Optional filters to narrow down results',
          properties: {
            groupIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by group IDs',
            },
            teamIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by team IDs',
            },
            driIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by DRI (owner) IDs',
            },
            priorities: {
              type: 'array',
              items: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              description: 'Filter by priorities',
            },
            statuses: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'CANCELLED'],
              },
              description: 'Filter by work statuses',
            },
            health: {
              type: 'array',
              items: { type: 'string', enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'] },
              description: 'Filter by health statuses',
            },
            needsHelp: { type: 'boolean', description: 'Filter items needing help' },
            atRisk: { type: 'boolean', description: 'Filter at-risk items' },
            stale: { type: 'boolean', description: 'Filter stale items' },
            searchQuery: { type: 'string', description: 'Full-text search query' },
          },
        },
        limit: {
          type: 'number',
          description: 'Maximum items to return (1-100, default: 50)',
          minimum: 1,
          maximum: 100,
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor for fetching next page',
        },
      },
    },
  },
  {
    name: 'update_work_status',
    description:
      'Update the status and/or health of a work item. At least one of status or health must be provided. Status tracks progress (NOT_STARTED, IN_PROGRESS, BLOCKED, COMPLETE, CANCELLED) while health indicates project condition (GREEN, YELLOW, RED, UNKNOWN).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workItemId: {
          type: 'string',
          description: 'The unique ID of the work item to update',
        },
        status: {
          type: 'string',
          enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'CANCELLED'],
          description: 'New status for the work item',
        },
        health: {
          type: 'string',
          enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'],
          description: 'New health status for the work item',
        },
      },
      required: ['workItemId'],
    },
  },
  {
    name: 'create_work_update',
    description:
      'Add a weekly update to a work item. Updates are time-stamped entries that describe progress, blockers, or changes. These updates appear in the work item timeline and are used for executive reviews.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workItemId: {
          type: 'string',
          description: 'The unique ID of the work item to add update to',
        },
        content: {
          type: 'string',
          description: 'The content of the update (supports markdown)',
        },
      },
      required: ['workItemId', 'content'],
    },
  },
  {
    name: 'link_artifact',
    description:
      'Connect an artifact URL to a work item. Artifacts are external resources like Jira tickets, GitHub PRs/issues, Slack threads, Google Docs, Confluence pages, or Figma files. The system will automatically track activity on linked artifacts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workItemId: {
          type: 'string',
          description: 'The unique ID of the work item to link artifact to',
        },
        url: {
          type: 'string',
          description: 'The full URL of the artifact',
        },
        type: {
          type: 'string',
          enum: [
            'JIRA_TICKET',
            'GITHUB_PR',
            'GITHUB_ISSUE',
            'SLACK_THREAD',
            'GOOGLE_DOC',
            'CONFLUENCE_PAGE',
            'FIGMA_FILE',
          ],
          description: 'The type of artifact being linked',
        },
        title: {
          type: 'string',
          description: 'Optional human-readable title for the artifact',
        },
      },
      required: ['workItemId', 'url', 'type'],
    },
  },
  {
    name: 'get_stale_items',
    description:
      'Get all work items that have not had any activity for a specified number of days. Stale items may need attention or status updates. Default threshold is 7 days.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        threshold: {
          type: 'number',
          description: 'Number of days without activity to consider an item stale (default: 7)',
          minimum: 1,
          maximum: 90,
        },
      },
    },
  },
] as const;

/**
 * Tool name type for type safety
 */
export type MCPToolName = (typeof MCP_TOOLS)[number]['name'];

/**
 * Get tool definition by name
 */
export function getToolByName(name: string) {
  return MCP_TOOLS.find((tool) => tool.name === name);
}

/**
 * Validation functions using Zod schemas
 */
export function validateGetWorkItemsInput(input: unknown) {
  return GetWorkItemsInputSchema.safeParse(input);
}

export function validateUpdateWorkStatusInput(input: unknown) {
  return UpdateWorkStatusInputSchema.safeParse(input);
}

export function validateCreateWorkUpdateInput(input: unknown) {
  return CreateWorkUpdateInputSchema.safeParse(input);
}

export function validateLinkArtifactInput(input: unknown) {
  return LinkArtifactInputSchema.safeParse(input);
}

export function validateGetStaleItemsInput(input: unknown) {
  return GetStaleItemsInputSchema.safeParse(input);
}
