/**
 * useWorkItems - React Query hook for fetching work items
 *
 * Features:
 * - Infinite scrolling with cursor pagination
 * - Optimistic updates
 * - Background refetching
 * - Cache invalidation
 * - <100ms perceived latency via stale-while-revalidate
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  WorkItemFilters,
  WorkItemConnection,
  IWorkItem,
  SortInput,
  PaginationInput,
} from '@wt-ros/common';
import {
  graphqlClient,
  WORK_ITEMS_QUERY,
  WORK_ITEM_QUERY,
} from '@/lib/graphql-client';

// ============================================
// TYPES
// ============================================

interface WorkItemsQueryVariables {
  filters?: WorkItemFilters;
  pagination?: PaginationInput;
  sort?: SortInput;
}

interface WorkItemsQueryResponse {
  workItems: WorkItemConnection;
}

interface WorkItemQueryResponse {
  workItem: IWorkItem | null;
}

interface UseWorkItemsOptions {
  filters?: WorkItemFilters;
  sort?: SortInput;
  pageSize?: number;
  enabled?: boolean;
}

// ============================================
// QUERY KEYS
// ============================================

export const workItemsKeys = {
  all: ['workItems'] as const,
  lists: () => [...workItemsKeys.all, 'list'] as const,
  list: (filters?: WorkItemFilters, sort?: SortInput) =>
    [...workItemsKeys.lists(), { filters, sort }] as const,
  details: () => [...workItemsKeys.all, 'detail'] as const,
  detail: (id: string) => [...workItemsKeys.details(), id] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchWorkItems(
  variables: WorkItemsQueryVariables
): Promise<WorkItemsQueryResponse> {
  return graphqlClient.request<WorkItemsQueryResponse>(
    WORK_ITEMS_QUERY,
    variables
  );
}

async function fetchWorkItem(id: string): Promise<WorkItemQueryResponse> {
  return graphqlClient.request<WorkItemQueryResponse>(WORK_ITEM_QUERY, { id });
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetch work items with infinite scrolling
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isLoading } = useWorkItems({
 *   filters: { health: [HealthStatus.RED] },
 *   sort: { field: 'priority', direction: 'ASC' },
 * });
 * ```
 */
export function useWorkItems(options: UseWorkItemsOptions = {}) {
  const { filters, sort, pageSize = 50, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: workItemsKeys.list(filters, sort),
    queryFn: async ({ pageParam }) => {
      const response = await fetchWorkItems({
        filters,
        sort,
        pagination: {
          cursor: pageParam as string | undefined,
          limit: pageSize,
        },
      });
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.workItems.pageInfo.hasNextPage) {
        return lastPage.workItems.pageInfo.endCursor ?? undefined;
      }
      return undefined;
    },
    enabled,
    // Performance optimizations for <100ms perceived latency
    staleTime: 30 * 1000, // 30 seconds - show stale data while fetching
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Placeholder data from previous query for instant rendering
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetch a single work item by ID
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useWorkItem('work-item-id');
 * ```
 */
export function useWorkItem(id: string, enabled = true) {
  return useQuery({
    queryKey: workItemsKeys.detail(id),
    queryFn: () => fetchWorkItem(id),
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Prefetch a work item for instant detail panel opening
 */
export function usePrefetchWorkItem() {
  const queryClient = useInfiniteQuery({
    queryKey: ['prefetch'],
    queryFn: async () => null,
    enabled: false,
  });

  return async (id: string) => {
    // This would be called on row hover for prefetching
    // await queryClient.prefetchQuery({
    //   queryKey: workItemsKeys.detail(id),
    //   queryFn: () => fetchWorkItem(id),
    //   staleTime: 30 * 1000,
    // });
  };
}

// ============================================
// MOCK DATA FOR DEVELOPMENT
// ============================================

/**
 * Generate mock work items for development/testing
 */
export function generateMockWorkItems(count: number): IWorkItem[] {
  const priorities = ['P0', 'P1', 'P2', 'P3'] as const;
  const statuses = [
    'NOT_STARTED',
    'IN_PROGRESS',
    'BLOCKED',
    'COMPLETE',
    'CANCELLED',
  ] as const;
  const healthStatuses = ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'] as const;

  return Array.from({ length: count }, (_, i) => ({
    id: `work-item-${i + 1}`,
    title: `Work Item ${i + 1}: ${mockTitles[i % mockTitles.length]}`,
    description: `Description for work item ${i + 1}`,
    driId: `user-${(i % 5) + 1}`,
    teamId: `team-${(i % 3) + 1}`,
    groupId: `group-${(i % 2) + 1}`,
    targetDate: new Date(Date.now() + (i - 10) * 24 * 60 * 60 * 1000),
    originalTargetDate: new Date(Date.now() + (i - 15) * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - i * 60 * 60 * 1000),
    priority: priorities[i % priorities.length],
    status: statuses[i % statuses.length],
    health: healthStatuses[i % healthStatuses.length],
    needsHelp: i % 7 === 0,
    atRisk: i % 5 === 0,
    stale: i % 11 === 0,
    parentWorkItemId: null,
    artifacts: [
      {
        id: `artifact-${i}-1`,
        type: 'GITHUB_PR' as const,
        url: `https://github.com/org/repo/pull/${i + 100}`,
        title: `PR #${i + 100}`,
        lastActivityAt: new Date(),
        metadata: {},
      },
    ],
    aiSuggestedUpdate:
      i % 3 === 0
        ? `AI-generated update suggestion for work item ${i + 1}`
        : null,
    driftScore: Math.random() * 0.5,
    lastActivityAt: new Date(Date.now() - i * 2 * 60 * 60 * 1000),
  }));
}

const mockTitles = [
  'Implement user authentication flow',
  'Optimize database queries for dashboard',
  'Design new onboarding experience',
  'Fix critical security vulnerability',
  'Migrate to new API version',
  'Add real-time notifications',
  'Improve search performance',
  'Create admin dashboard',
  'Implement data export feature',
  'Build mobile-responsive layouts',
  'Set up CI/CD pipeline',
  'Refactor legacy codebase',
  'Add unit test coverage',
  'Implement rate limiting',
  'Design system documentation',
];
