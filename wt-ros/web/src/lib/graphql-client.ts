/**
 * GraphQL client configuration for WT-ROS API
 */
import { GraphQLClient, ClientError } from 'graphql-request';

// API URL - ensure it points to the correct GraphQL endpoint
const API_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/graphql`
  : 'http://localhost:4000/graphql';

/**
 * Get authorization headers for GraphQL requests
 */
function getHeaders(): HeadersInit {
  if (typeof window === 'undefined') {
    return {};
  }

  const token = localStorage.getItem('wt-ros-token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  return {};
}

/**
 * GraphQL client with proper error handling
 */
export const graphqlClient = new GraphQLClient(API_URL, {
  headers: getHeaders,
});

/**
 * Error types for better error handling
 */
export interface GraphQLRequestError {
  message: string;
  code?: string;
  isNetworkError: boolean;
  isGraphQLError: boolean;
  originalError?: Error;
}

/**
 * Parse GraphQL errors into a consistent format
 */
export function parseGraphQLError(error: unknown): GraphQLRequestError {
  if (error instanceof ClientError) {
    // GraphQL error (validation, resolver errors, etc.)
    const firstError = error.response?.errors?.[0];
    return {
      message: firstError?.message || 'GraphQL request failed',
      code: firstError?.extensions?.code as string | undefined,
      isNetworkError: false,
      isGraphQLError: true,
      originalError: error,
    };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Network error (server unreachable)
    return {
      message: 'Unable to connect to API server. Please check your connection.',
      isNetworkError: true,
      isGraphQLError: false,
      originalError: error as Error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      isNetworkError: error.message.includes('network') || error.message.includes('fetch'),
      isGraphQLError: false,
      originalError: error,
    };
  }

  return {
    message: 'An unexpected error occurred',
    isNetworkError: false,
    isGraphQLError: false,
  };
}

/**
 * Check if the API is reachable
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(API_URL.replace('/graphql', '/health'), {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Safe GraphQL request wrapper with error handling
 */
export async function safeRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data: T | null; error: GraphQLRequestError | null }> {
  try {
    const data = await graphqlClient.request<T>(query, variables);
    return { data, error: null };
  } catch (error) {
    return { data: null, error: parseGraphQLError(error) };
  }
}

/**
 * GraphQL queries for work items
 */
export const WORK_ITEMS_QUERY = /* GraphQL */ `
  query WorkItems($filters: WorkItemFilters, $pagination: PaginationInput, $sort: SortInput) {
    workItems(filters: $filters, pagination: $pagination, sort: $sort) {
      edges {
        cursor
        node {
          id
          title
          description
          driId
          dri {
            id
            displayName
            avatarUrl
          }
          teamId
          team {
            id
            name
          }
          groupId
          group {
            id
            name
          }
          targetDate
          originalTargetDate
          priority
          status
          health
          needsHelp
          atRisk
          stale
          artifacts {
            id
            type
            url
            title
          }
          aiSuggestedUpdate
          driftScore
          lastActivityAt
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const WORK_ITEM_QUERY = /* GraphQL */ `
  query WorkItem($id: ID!) {
    workItem(id: $id) {
      id
      title
      description
      driId
      dri {
        id
        displayName
        avatarUrl
      }
      teamId
      team {
        id
        name
      }
      groupId
      group {
        id
        name
      }
      targetDate
      originalTargetDate
      priority
      status
      health
      needsHelp
      atRisk
      stale
      artifacts {
        id
        type
        url
        title
      }
      updates {
        id
        content
        authorId
        author {
          id
          displayName
          avatarUrl
        }
        week
        isAiGenerated
        aiConfidence
        lineComments {
          id
          startOffset
          endOffset
          content
          authorId
          author {
            id
            displayName
            avatarUrl
          }
          resolved
          createdAt
        }
        createdAt
      }
      aiSuggestedUpdate
      driftScore
      lastActivityAt
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_WORK_ITEM_MUTATION = /* GraphQL */ `
  mutation UpdateWorkItem($id: ID!, $input: UpdateWorkItemInput!) {
    updateWorkItem(id: $id, input: $input) {
      id
      title
      description
      driId
      teamId
      targetDate
      priority
      status
      health
      needsHelp
      atRisk
      updatedAt
    }
  }
`;

export const CREATE_WORK_UPDATE_MUTATION = /* GraphQL */ `
  mutation CreateWorkUpdate($workItemId: ID!, $input: CreateWorkUpdateInput!) {
    createWorkUpdate(workItemId: $workItemId, input: $input) {
      id
      content
      authorId
      week
      isAiGenerated
      aiConfidence
      createdAt
    }
  }
`;

export const ACCEPT_AI_SUGGESTED_UPDATE_MUTATION = /* GraphQL */ `
  mutation AcceptAiSuggestedUpdate($workItemId: ID!) {
    acceptAiSuggestedUpdate(workItemId: $workItemId) {
      id
      content
      isAiGenerated
      aiConfidence
      createdAt
    }
  }
`;

export const ADD_LINE_COMMENT_MUTATION = /* GraphQL */ `
  mutation AddLineComment($updateId: ID!, $input: LineCommentInput!) {
    addLineComment(updateId: $updateId, input: $input) {
      id
      startOffset
      endOffset
      content
      authorId
      resolved
      createdAt
    }
  }
`;

export const RESOLVE_LINE_COMMENT_MUTATION = /* GraphQL */ `
  mutation ResolveLineComment($commentId: ID!) {
    resolveLineComment(commentId: $commentId) {
      id
      resolved
    }
  }
`;

export const USERS_QUERY = /* GraphQL */ `
  query Users($searchQuery: String) {
    users(searchQuery: $searchQuery) {
      id
      email
      displayName
      avatarUrl
    }
  }
`;

/**
 * AI Insights Queries
 */
export const EXECUTIVE_SUMMARY_QUERY = /* GraphQL */ `
  query ExecutiveSummary($groupId: ID) {
    executiveSummary(groupId: $groupId) {
      summary
      highlights
      metrics {
        total
        notStarted
        inProgress
        blocked
        complete
        cancelled
        healthGreen
        healthYellow
        healthRed
        healthUnknown
        priorityP0
        priorityP1
        priorityP2
        priorityP3
        atRisk
        needsHelp
        stale
        overdue
        completionRate
        healthScore
      }
      attentionItems {
        id
        title
        reason
        urgency
        priority
        daysOverdue
        teamName
      }
      generatedAt
    }
  }
`;

export const RISK_ANALYSIS_QUERY = /* GraphQL */ `
  query RiskAnalysis($groupId: ID) {
    riskAnalysis(groupId: $groupId) {
      overallRisk
      riskScore
      riskItems {
        id
        title
        riskFactors
        riskScore
        priority
        targetDate
        daysToTarget
      }
      patterns {
        type
        description
        affectedCount
        severity
      }
      recommendations
      generatedAt
    }
  }
`;

export const ASK_AI_QUERY = /* GraphQL */ `
  query AskAI($question: String!, $groupId: ID) {
    askAI(question: $question, groupId: $groupId) {
      response
      relatedItemIds
      queriedAt
    }
  }
`;
