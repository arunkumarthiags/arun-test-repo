/**
 * WorkItemHandler - Tool implementations for MCP Server
 * Handles all work item operations exposed via MCP tools
 */

import {
  IWorkItem,
  IWorkUpdate,
  IArtifact,
  WorkItemFilters,
  WorkStatus,
  HealthStatus,
  ArtifactType,
  Priority,
} from '@wt-ros/common';

// API configuration - in production, these would come from environment
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/graphql';
const API_KEY = process.env.API_KEY || '';

/**
 * GraphQL client helper
 */
async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
  }

  return result.data as T;
}

/**
 * Handler result wrapper for consistent MCP responses
 */
export interface HandlerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Input types for handlers
 */
export interface GetWorkItemsInput {
  filters?: WorkItemFilters;
  limit?: number;
  cursor?: string;
}

export interface UpdateWorkStatusInput {
  workItemId: string;
  status?: WorkStatus;
  health?: HealthStatus;
}

export interface CreateWorkUpdateInput {
  workItemId: string;
  content: string;
}

export interface LinkArtifactInput {
  workItemId: string;
  url: string;
  type: ArtifactType;
  title?: string;
}

export interface GetStaleItemsInput {
  threshold?: number; // Days without activity, defaults to 7
}

/**
 * WorkItemHandler class - implements all MCP tool operations
 */
export class WorkItemHandler {
  /**
   * Get work items with optional filters
   */
  async getWorkItems(input: GetWorkItemsInput): Promise<HandlerResult<IWorkItem[]>> {
    try {
      const query = `
        query GetWorkItems($filters: WorkItemFilters, $pagination: PaginationInput) {
          workItems(filters: $filters, pagination: $pagination) {
            edges {
              node {
                id
                title
                description
                driId
                teamId
                groupId
                targetDate
                originalTargetDate
                createdAt
                updatedAt
                priority
                status
                health
                needsHelp
                atRisk
                stale
                parentWorkItemId
                aiSuggestedUpdate
                driftScore
                lastActivityAt
                artifacts {
                  id
                  type
                  url
                  title
                  lastActivityAt
                  metadata
                }
              }
            }
            totalCount
          }
        }
      `;

      const variables = {
        filters: input.filters || {},
        pagination: {
          cursor: input.cursor,
          limit: input.limit || 50,
        },
      };

      const result = await graphqlRequest<{
        workItems: {
          edges: Array<{ node: IWorkItem }>;
          totalCount: number;
        };
      }>(query, variables);

      return {
        success: true,
        data: result.workItems.edges.map((edge) => edge.node),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get work items',
      };
    }
  }

  /**
   * Update work item status and/or health
   */
  async updateWorkStatus(input: UpdateWorkStatusInput): Promise<HandlerResult<IWorkItem>> {
    try {
      if (!input.status && !input.health) {
        return {
          success: false,
          error: 'At least one of status or health must be provided',
        };
      }

      const query = `
        mutation UpdateWorkItem($id: ID!, $input: UpdateWorkItemInput!) {
          updateWorkItem(id: $id, input: $input) {
            id
            title
            description
            driId
            teamId
            groupId
            targetDate
            originalTargetDate
            createdAt
            updatedAt
            priority
            status
            health
            needsHelp
            atRisk
            stale
            parentWorkItemId
            aiSuggestedUpdate
            driftScore
            lastActivityAt
          }
        }
      `;

      const updateInput: Record<string, unknown> = {};
      if (input.status) updateInput.status = input.status;
      if (input.health) updateInput.health = input.health;

      const variables = {
        id: input.workItemId,
        input: updateInput,
      };

      const result = await graphqlRequest<{
        updateWorkItem: IWorkItem;
      }>(query, variables);

      return {
        success: true,
        data: result.updateWorkItem,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update work status',
      };
    }
  }

  /**
   * Create a work update (weekly update) for a work item
   */
  async createWorkUpdate(input: CreateWorkUpdateInput): Promise<HandlerResult<IWorkUpdate>> {
    try {
      if (!input.content || input.content.trim().length === 0) {
        return {
          success: false,
          error: 'Update content cannot be empty',
        };
      }

      const query = `
        mutation CreateWorkUpdate($workItemId: ID!, $input: CreateWorkUpdateInput!) {
          createWorkUpdate(workItemId: $workItemId, input: $input) {
            id
            workItemId
            content
            authorId
            createdAt
            week
            isAiGenerated
            aiConfidence
          }
        }
      `;

      const variables = {
        workItemId: input.workItemId,
        input: {
          content: input.content,
          isAiGenerated: false,
        },
      };

      const result = await graphqlRequest<{
        createWorkUpdate: IWorkUpdate;
      }>(query, variables);

      return {
        success: true,
        data: result.createWorkUpdate,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create work update',
      };
    }
  }

  /**
   * Link an artifact (URL) to a work item
   */
  async linkArtifact(input: LinkArtifactInput): Promise<HandlerResult<IArtifact>> {
    try {
      // Validate URL format
      try {
        new URL(input.url);
      } catch {
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }

      const query = `
        mutation LinkArtifact($workItemId: ID!, $artifact: ArtifactInput!) {
          linkArtifact(workItemId: $workItemId, artifact: $artifact) {
            id
            type
            url
            title
            lastActivityAt
            metadata
          }
        }
      `;

      const variables = {
        workItemId: input.workItemId,
        artifact: {
          type: input.type,
          url: input.url,
          title: input.title,
        },
      };

      const result = await graphqlRequest<{
        linkArtifact: IArtifact;
      }>(query, variables);

      return {
        success: true,
        data: result.linkArtifact,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link artifact',
      };
    }
  }

  /**
   * Get all stale work items (no activity for threshold days)
   */
  async getStaleItems(input: GetStaleItemsInput): Promise<HandlerResult<IWorkItem[]>> {
    try {
      const threshold = input.threshold || 7;

      const query = `
        query GetStaleWorkItems($threshold: Int!) {
          staleWorkItems(threshold: $threshold) {
            id
            title
            description
            driId
            teamId
            groupId
            targetDate
            originalTargetDate
            createdAt
            updatedAt
            priority
            status
            health
            needsHelp
            atRisk
            stale
            parentWorkItemId
            aiSuggestedUpdate
            driftScore
            lastActivityAt
            artifacts {
              id
              type
              url
              title
              lastActivityAt
              metadata
            }
          }
        }
      `;

      const variables = { threshold };

      const result = await graphqlRequest<{
        staleWorkItems: IWorkItem[];
      }>(query, variables);

      return {
        success: true,
        data: result.staleWorkItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stale items',
      };
    }
  }

  /**
   * Helper: Detect artifact type from URL
   */
  static detectArtifactType(url: string): ArtifactType | null {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('jira') || urlLower.includes('atlassian.net/browse')) {
      return ArtifactType.JIRA_TICKET;
    }
    if (urlLower.includes('github.com') && urlLower.includes('/pull/')) {
      return ArtifactType.GITHUB_PR;
    }
    if (urlLower.includes('github.com') && urlLower.includes('/issues/')) {
      return ArtifactType.GITHUB_ISSUE;
    }
    if (urlLower.includes('slack.com')) {
      return ArtifactType.SLACK_THREAD;
    }
    if (urlLower.includes('docs.google.com')) {
      return ArtifactType.GOOGLE_DOC;
    }
    if (urlLower.includes('confluence') || urlLower.includes('atlassian.net/wiki')) {
      return ArtifactType.CONFLUENCE_PAGE;
    }
    if (urlLower.includes('figma.com')) {
      return ArtifactType.FIGMA_FILE;
    }

    return null;
  }
}

// Export singleton instance
export const workItemHandler = new WorkItemHandler();
