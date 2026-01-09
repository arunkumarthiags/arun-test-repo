/**
 * GraphQL client configuration for WT-ROS API
 */
import { GraphQLClient } from 'graphql-request';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';

export const graphqlClient = new GraphQLClient(API_URL, {
  headers: () => {
    // Add auth headers when available
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('wt-ros-token')
      : null;

    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

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
