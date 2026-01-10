/**
 * useWorkItems - React Query hook for fetching work items
 *
 * Features:
 * - Infinite scrolling with cursor pagination
 * - Optimistic updates
 * - Background refetching
 * - Cache invalidation
 * - <100ms perceived latency via stale-while-revalidate
 * - Graceful fallback to mock data when API is unavailable
 */
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WorkItemFilters,
  WorkItemConnection,
  IWorkItem,
  SortInput,
  PaginationInput,
  Priority,
  WorkStatus,
  HealthStatus,
  ArtifactType,
} from '@wt-ros/common';
import {
  graphqlClient,
  WORK_ITEMS_QUERY,
  WORK_ITEM_QUERY,
  parseGraphQLError,
  GraphQLRequestError,
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
  /** Fall back to mock data if API is unavailable (default: true) */
  useMockFallback?: boolean;
}

interface UseWorkItemsResult {
  workItems: IWorkItem[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: GraphQLRequestError | null;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
  /** Whether currently using mock data */
  isUsingMockData: boolean;
  /** Total count of items */
  totalCount: number;
  /** The raw query data */
  data: ReturnType<typeof useInfiniteQuery<WorkItemsQueryResponse>>['data'];
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
  try {
    const response = await graphqlClient.request<WorkItemsQueryResponse>(
      WORK_ITEMS_QUERY,
      variables
    );
    return response;
  } catch (error) {
    const parsedError = parseGraphQLError(error);
    throw parsedError;
  }
}

async function fetchWorkItem(id: string): Promise<WorkItemQueryResponse> {
  try {
    const response = await graphqlClient.request<WorkItemQueryResponse>(
      WORK_ITEM_QUERY,
      { id }
    );
    return response;
  } catch (error) {
    const parsedError = parseGraphQLError(error);
    throw parsedError;
  }
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetch work items with infinite scrolling
 *
 * Attempts to fetch from the API first. If the API is unavailable,
 * falls back to mock data for development/offline scenarios.
 *
 * @example
 * ```tsx
 * const { workItems, isLoading, isError, isUsingMockData } = useWorkItems({
 *   filters: { health: [HealthStatus.RED] },
 *   sort: { field: 'priority', direction: 'ASC' },
 * });
 * ```
 */
export function useWorkItems(options: UseWorkItemsOptions = {}): UseWorkItemsResult {
  const {
    filters,
    sort,
    pageSize = 50,
    enabled = true,
    useMockFallback = true,
  } = options;

  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [apiError, setApiError] = useState<GraphQLRequestError | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 2;

  const query = useInfiniteQuery<WorkItemsQueryResponse, GraphQLRequestError>({
    queryKey: workItemsKeys.list(filters, sort),
    queryFn: async ({ pageParam }) => {
      try {
        const response = await fetchWorkItems({
          filters,
          sort,
          pagination: {
            cursor: pageParam as string | undefined,
            limit: pageSize,
          },
        });

        // Reset mock data state on successful API call
        setIsUsingMockData(false);
        setApiError(null);
        retryCountRef.current = 0;

        return response;
      } catch (error) {
        const parsedError = error as GraphQLRequestError;
        setApiError(parsedError);

        // If it's a network error and we have mock fallback enabled
        if (parsedError.isNetworkError && useMockFallback) {
          retryCountRef.current++;

          if (retryCountRef.current >= maxRetries) {
            // Fall back to mock data
            setIsUsingMockData(true);
            return getMockWorkItemsResponse(pageSize, pageParam as string | undefined);
          }
        }

        throw error;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.workItems?.pageInfo?.hasNextPage) {
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
    // Retry configuration
    retry: (failureCount, error) => {
      // Don't retry on GraphQL errors (validation, etc.)
      if (error.isGraphQLError) return false;
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    // Placeholder data from previous query for instant rendering
    placeholderData: (previousData) => previousData,
  });

  // Flatten paginated results into a single array
  const workItems: IWorkItem[] = query.data?.pages?.flatMap(
    (page) => page.workItems?.edges?.map((edge) => edge.node) ?? []
  ) ?? [];

  // Calculate total count
  const totalCount = query.data?.pages?.[0]?.workItems?.totalCount ?? 0;

  return {
    ...query,
    workItems,
    isUsingMockData,
    error: apiError,
    totalCount,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

/**
 * Fetch a single work item by ID
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError } = useWorkItem('work-item-id');
 * ```
 */
export function useWorkItem(id: string, enabled = true) {
  return useQuery({
    queryKey: workItemsKeys.detail(id),
    queryFn: () => fetchWorkItem(id),
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const parsedError = error as unknown as GraphQLRequestError;
      if (parsedError?.isGraphQLError) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Prefetch a work item for instant detail panel opening
 */
export function usePrefetchWorkItem() {
  const queryClient = useQueryClient();

  return useCallback(
    async (id: string) => {
      await queryClient.prefetchQuery({
        queryKey: workItemsKeys.detail(id),
        queryFn: () => fetchWorkItem(id),
        staleTime: 30 * 1000,
      });
    },
    [queryClient]
  );
}

// ============================================
// MOCK DATA GENERATION
// ============================================

/**
 * Generate a mock WorkItemsQueryResponse for development/offline use
 */
function getMockWorkItemsResponse(
  pageSize: number,
  cursor?: string
): WorkItemsQueryResponse {
  const startIndex = cursor ? parseInt(cursor, 10) : 0;
  const mockItems = generateMockWorkItems(pageSize, startIndex);
  const nextCursor = startIndex + pageSize;
  const totalCount = 100; // Simulated total

  return {
    workItems: {
      edges: mockItems.map((item, index) => ({
        cursor: String(startIndex + index),
        node: item,
      })),
      pageInfo: {
        hasNextPage: nextCursor < totalCount,
        hasPreviousPage: startIndex > 0,
        startCursor: String(startIndex),
        endCursor: String(nextCursor - 1),
      },
      totalCount,
    },
  };
}

/**
 * Generate mock work items for development/testing
 */
export function generateMockWorkItems(count: number, startIndex: number = 0): IWorkItem[] {
  const priorities: Priority[] = [Priority.P0, Priority.P1, Priority.P2, Priority.P3];
  const statuses: WorkStatus[] = [
    WorkStatus.NOT_STARTED,
    WorkStatus.IN_PROGRESS,
    WorkStatus.BLOCKED,
    WorkStatus.COMPLETE,
    WorkStatus.CANCELLED,
  ];
  const healthStatuses: HealthStatus[] = [
    HealthStatus.GREEN,
    HealthStatus.YELLOW,
    HealthStatus.RED,
    HealthStatus.UNKNOWN,
  ];

  return Array.from({ length: count }, (_, i) => {
    const index = startIndex + i;
    return {
      id: `work-item-${index + 1}`,
      title: `Work Item ${index + 1}: ${mockTitles[index % mockTitles.length]}`,
      description: `Description for work item ${index + 1}`,
      driId: `user-${(index % 5) + 1}`,
      teamId: `team-${(index % 3) + 1}`,
      groupId: `group-${(index % 2) + 1}`,
      targetDate: new Date(Date.now() + (index - 10) * 24 * 60 * 60 * 1000),
      originalTargetDate: new Date(Date.now() + (index - 15) * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - index * 60 * 60 * 1000),
      priority: priorities[index % priorities.length],
      status: statuses[index % statuses.length],
      health: healthStatuses[index % healthStatuses.length],
      needsHelp: index % 7 === 0,
      atRisk: index % 5 === 0,
      stale: index % 11 === 0,
      parentWorkItemId: null,
      artifacts: [
        {
          id: `artifact-${index}-1`,
          type: ArtifactType.GITHUB_PR,
          url: `https://github.com/org/repo/pull/${index + 100}`,
          title: `PR #${index + 100}`,
          lastActivityAt: new Date(),
          metadata: {},
        },
      ],
      aiSuggestedUpdate:
        index % 3 === 0
          ? `AI-generated update suggestion for work item ${index + 1}`
          : null,
      driftScore: Math.random() * 0.5,
      lastActivityAt: new Date(Date.now() - index * 2 * 60 * 60 * 1000),
    };
  });
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
