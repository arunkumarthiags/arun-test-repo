/**
 * useWorkItemMutation - React Query hooks for work item mutations
 *
 * Features:
 * - Optimistic updates for <100ms perceived latency
 * - Automatic cache invalidation
 * - Rollback on error
 * - Toast notifications
 * - Robust error handling
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IWorkItem,
  UpdateWorkItemInput,
  CreateWorkUpdateInput,
  LineCommentInput,
  IWorkUpdate,
  ILineComment,
} from '@wt-ros/common';
import { useSetAtom } from 'jotai';

import {
  graphqlClient,
  UPDATE_WORK_ITEM_MUTATION,
  CREATE_WORK_UPDATE_MUTATION,
  ACCEPT_AI_SUGGESTED_UPDATE_MUTATION,
  ADD_LINE_COMMENT_MUTATION,
  RESOLVE_LINE_COMMENT_MUTATION,
  parseGraphQLError,
  GraphQLRequestError,
} from '@/lib/graphql-client';
import { workItemsKeys } from './useWorkItems';
import { addNotificationAtom } from '../stores/gridStore';

/**
 * Helper to format error messages for user display
 */
function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Unable to connect to server. Please check your connection.';
    }
    return error.message;
  }

  const parsed = parseGraphQLError(error);
  if (parsed.isNetworkError) {
    return 'Unable to connect to server. Please check your connection.';
  }
  return parsed.message;
}

// ============================================
// TYPES
// ============================================

interface UpdateWorkItemResponse {
  updateWorkItem: IWorkItem;
}

interface CreateWorkUpdateResponse {
  createWorkUpdate: IWorkUpdate;
}

interface AcceptAiUpdateResponse {
  acceptAiSuggestedUpdate: IWorkUpdate;
}

interface AddLineCommentResponse {
  addLineComment: ILineComment;
}

interface ResolveLineCommentResponse {
  resolveLineComment: ILineComment;
}

// ============================================
// UPDATE WORK ITEM
// ============================================

/**
 * Mutation hook for updating work items with optimistic updates
 *
 * @example
 * ```tsx
 * const { mutate } = useUpdateWorkItem();
 * mutate({ id: 'work-item-1', input: { status: 'COMPLETE' } });
 * ```
 */
export function useUpdateWorkItem() {
  const queryClient = useQueryClient();
  const addNotification = useSetAtom(addNotificationAtom);

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateWorkItemInput;
    }) => {
      const response = await graphqlClient.request<UpdateWorkItemResponse>(
        UPDATE_WORK_ITEM_MUTATION,
        { id, input }
      );
      return response.updateWorkItem;
    },

    // Optimistic update for instant feedback
    onMutate: async ({ id, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: workItemsKeys.all });

      // Snapshot current data
      const previousData = queryClient.getQueriesData({
        queryKey: workItemsKeys.lists(),
      });

      // Optimistically update the cache
      queryClient.setQueriesData(
        { queryKey: workItemsKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              workItems: {
                ...page.workItems,
                edges: page.workItems.edges.map((edge: any) => {
                  if (edge.node.id === id) {
                    return {
                      ...edge,
                      node: {
                        ...edge.node,
                        ...input,
                        updatedAt: new Date(),
                      },
                    };
                  }
                  return edge;
                }),
              },
            })),
          };
        }
      );

      // Also update the detail query if it exists
      queryClient.setQueryData(workItemsKeys.detail(id), (old: any) => {
        if (!old?.workItem) return old;
        return {
          workItem: {
            ...old.workItem,
            ...input,
            updatedAt: new Date(),
          },
        };
      });

      return { previousData };
    },

    // Rollback on error
    onError: (err, { id }, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      addNotification({
        message: `Failed to update work item: ${formatErrorMessage(err)}`,
        severity: 'error',
      });
    },

    // Refetch on success to ensure consistency
    onSuccess: (data, { id }) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: workItemsKeys.detail(id) });

      addNotification({
        message: 'Work item updated successfully',
        severity: 'success',
        autoHideDuration: 2000,
      });
    },
  });
}

// ============================================
// BULK UPDATE WORK ITEMS
// ============================================

/**
 * Mutation hook for bulk updating multiple work items
 *
 * @example
 * ```tsx
 * const { mutate } = useBulkUpdateWorkItems();
 * mutate({ ids: ['id1', 'id2'], input: { status: 'COMPLETE' } });
 * ```
 */
export function useBulkUpdateWorkItems() {
  const queryClient = useQueryClient();
  const addNotification = useSetAtom(addNotificationAtom);

  return useMutation({
    mutationFn: async ({
      ids,
      input,
    }: {
      ids: string[];
      input: UpdateWorkItemInput;
    }) => {
      // Execute updates in parallel
      const results = await Promise.all(
        ids.map((id) =>
          graphqlClient.request<UpdateWorkItemResponse>(
            UPDATE_WORK_ITEM_MUTATION,
            { id, input }
          )
        )
      );
      return results.map((r) => r.updateWorkItem);
    },

    onMutate: async ({ ids, input }) => {
      await queryClient.cancelQueries({ queryKey: workItemsKeys.all });

      const previousData = queryClient.getQueriesData({
        queryKey: workItemsKeys.lists(),
      });

      // Optimistically update all items
      queryClient.setQueriesData(
        { queryKey: workItemsKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              workItems: {
                ...page.workItems,
                edges: page.workItems.edges.map((edge: any) => {
                  if (ids.includes(edge.node.id)) {
                    return {
                      ...edge,
                      node: {
                        ...edge.node,
                        ...input,
                        updatedAt: new Date(),
                      },
                    };
                  }
                  return edge;
                }),
              },
            })),
          };
        }
      );

      return { previousData };
    },

    onError: (err, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      addNotification({
        message: `Failed to update work items: ${formatErrorMessage(err)}`,
        severity: 'error',
      });
    },

    onSuccess: (data, { ids }) => {
      queryClient.invalidateQueries({ queryKey: workItemsKeys.lists() });

      addNotification({
        message: `${ids.length} work items updated successfully`,
        severity: 'success',
        autoHideDuration: 2000,
      });
    },
  });
}

// ============================================
// CREATE WORK UPDATE
// ============================================

/**
 * Mutation hook for creating a work update
 *
 * @example
 * ```tsx
 * const { mutate } = useCreateWorkUpdate();
 * mutate({ workItemId: 'id', input: { content: 'Update content' } });
 * ```
 */
export function useCreateWorkUpdate() {
  const queryClient = useQueryClient();
  const addNotification = useSetAtom(addNotificationAtom);

  return useMutation({
    mutationFn: async ({
      workItemId,
      input,
    }: {
      workItemId: string;
      input: CreateWorkUpdateInput;
    }) => {
      const response = await graphqlClient.request<CreateWorkUpdateResponse>(
        CREATE_WORK_UPDATE_MUTATION,
        { workItemId, input }
      );
      return response.createWorkUpdate;
    },

    onSuccess: (data, { workItemId }) => {
      // Invalidate the work item detail to refetch with new update
      queryClient.invalidateQueries({
        queryKey: workItemsKeys.detail(workItemId),
      });

      addNotification({
        message: 'Update added successfully',
        severity: 'success',
        autoHideDuration: 2000,
      });
    },

    onError: (err) => {
      addNotification({
        message: `Failed to add update: ${formatErrorMessage(err)}`,
        severity: 'error',
      });
    },
  });
}

// ============================================
// ACCEPT AI SUGGESTED UPDATE
// ============================================

/**
 * Mutation hook for accepting an AI-suggested update
 *
 * @example
 * ```tsx
 * const { mutate } = useAcceptAiSuggestedUpdate();
 * mutate('work-item-id');
 * ```
 */
export function useAcceptAiSuggestedUpdate() {
  const queryClient = useQueryClient();
  const addNotification = useSetAtom(addNotificationAtom);

  return useMutation({
    mutationFn: async (workItemId: string) => {
      const response = await graphqlClient.request<AcceptAiUpdateResponse>(
        ACCEPT_AI_SUGGESTED_UPDATE_MUTATION,
        { workItemId }
      );
      return response.acceptAiSuggestedUpdate;
    },

    onMutate: async (workItemId) => {
      // Optimistically clear the AI suggestion
      queryClient.setQueriesData(
        { queryKey: workItemsKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              workItems: {
                ...page.workItems,
                edges: page.workItems.edges.map((edge: any) => {
                  if (edge.node.id === workItemId) {
                    return {
                      ...edge,
                      node: {
                        ...edge.node,
                        aiSuggestedUpdate: null,
                      },
                    };
                  }
                  return edge;
                }),
              },
            })),
          };
        }
      );
    },

    onSuccess: (data, workItemId) => {
      queryClient.invalidateQueries({
        queryKey: workItemsKeys.detail(workItemId),
      });

      addNotification({
        message: 'AI suggestion accepted and published',
        severity: 'success',
        autoHideDuration: 2000,
      });
    },

    onError: (err) => {
      addNotification({
        message: `Failed to accept AI suggestion: ${formatErrorMessage(err)}`,
        severity: 'error',
      });
    },
  });
}

// ============================================
// LINE COMMENTS
// ============================================

/**
 * Mutation hook for adding a line comment
 *
 * @example
 * ```tsx
 * const { mutate } = useAddLineComment();
 * mutate({
 *   updateId: 'update-id',
 *   input: { startOffset: 0, endOffset: 10, content: 'Comment' }
 * });
 * ```
 */
export function useAddLineComment() {
  const queryClient = useQueryClient();
  const addNotification = useSetAtom(addNotificationAtom);

  return useMutation({
    mutationFn: async ({
      updateId,
      input,
    }: {
      updateId: string;
      input: LineCommentInput;
    }) => {
      const response = await graphqlClient.request<AddLineCommentResponse>(
        ADD_LINE_COMMENT_MUTATION,
        { updateId, input }
      );
      return response.addLineComment;
    },

    onSuccess: () => {
      // Invalidate all work item details as we don't know which one
      queryClient.invalidateQueries({ queryKey: workItemsKeys.details() });

      addNotification({
        message: 'Comment added',
        severity: 'success',
        autoHideDuration: 2000,
      });
    },

    onError: (err) => {
      addNotification({
        message: `Failed to add comment: ${formatErrorMessage(err)}`,
        severity: 'error',
      });
    },
  });
}

/**
 * Mutation hook for resolving a line comment
 *
 * @example
 * ```tsx
 * const { mutate } = useResolveLineComment();
 * mutate('comment-id');
 * ```
 */
export function useResolveLineComment() {
  const queryClient = useQueryClient();
  const addNotification = useSetAtom(addNotificationAtom);

  return useMutation({
    mutationFn: async (commentId: string) => {
      const response = await graphqlClient.request<ResolveLineCommentResponse>(
        RESOLVE_LINE_COMMENT_MUTATION,
        { commentId }
      );
      return response.resolveLineComment;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workItemsKeys.details() });

      addNotification({
        message: 'Comment resolved',
        severity: 'success',
        autoHideDuration: 2000,
      });
    },

    onError: (err) => {
      addNotification({
        message: `Failed to resolve comment: ${formatErrorMessage(err)}`,
        severity: 'error',
      });
    },
  });
}
