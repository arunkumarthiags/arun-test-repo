import { Repository, SelectQueryBuilder, Brackets, QueryDeepPartialEntity } from 'typeorm';
import { WorkItem } from '../entities/WorkItem.entity';
import { AppDataSource } from '../config/data-source';
import {
  WorkItemFilters,
  PaginationInput,
  SortInput,
  WorkItemConnection,
  WorkItemEdge,
  PageInfo,
  Priority,
  WorkStatus,
  HealthStatus,
} from '@wt-ros/common';

/**
 * Default pagination limit
 */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Cursor encoding/decoding utilities
 */
export const encodeCursor = (id: string, sortValue: string | number | Date): string => {
  const payload = JSON.stringify({ id, sortValue: String(sortValue) });
  return Buffer.from(payload).toString('base64');
};

export const decodeCursor = (cursor: string): { id: string; sortValue: string } => {
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    throw new Error('Invalid cursor format');
  }
};

/**
 * WorkItem Repository with cursor-based pagination and filtering
 */
export class WorkItemRepository {
  private repository: Repository<WorkItem>;

  constructor() {
    this.repository = AppDataSource.getRepository(WorkItem);
  }

  /**
   * Get a single work item by ID
   */
  async findById(id: string): Promise<WorkItem | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Get work items with cursor-based pagination and filtering
   * Optimized for <100ms grid queries
   */
  async findWithPagination(
    filters?: WorkItemFilters,
    pagination?: PaginationInput,
    sort?: SortInput
  ): Promise<WorkItemConnection> {
    const limit = Math.min(pagination?.limit || DEFAULT_LIMIT, MAX_LIMIT);
    const sortField = sort?.field || 'createdAt';
    const sortDirection = sort?.direction || 'DESC';

    // Build base query
    let query = this.repository
      .createQueryBuilder('workItem')
      .select();

    // Apply filters
    query = this.applyFilters(query, filters);

    // Apply cursor-based pagination
    if (pagination?.cursor) {
      const { id, sortValue } = decodeCursor(pagination.cursor);
      query = this.applyCursorPagination(query, sortField, sortDirection, sortValue, id);
    }

    // Apply sorting
    query = query.orderBy(`workItem.${sortField}`, sortDirection);
    // Secondary sort by ID for stable ordering
    query = query.addOrderBy('workItem.id', sortDirection);

    // Fetch one extra to determine hasNextPage
    query = query.take(limit + 1);

    // Execute query with timing
    const startTime = Date.now();
    const [items, totalCount] = await Promise.all([
      query.getMany(),
      this.getFilteredCount(filters),
    ]);
    const queryTime = Date.now() - startTime;

    // Log slow queries
    if (queryTime > 100) {
      console.warn(`Slow query detected: ${queryTime}ms for work items query`);
    }

    // Determine pagination info
    const hasNextPage = items.length > limit;
    const resultItems = hasNextPage ? items.slice(0, limit) : items;

    // Build edges with cursors
    const edges: WorkItemEdge[] = resultItems.map((item) => ({
      cursor: encodeCursor(item.id, this.getSortValue(item, sortField)),
      node: item,
    }));

    // Build page info
    const pageInfo: PageInfo = {
      hasNextPage,
      hasPreviousPage: !!pagination?.cursor,
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
    };

    return {
      edges,
      pageInfo,
      totalCount,
    };
  }

  /**
   * Apply filters to query builder
   */
  private applyFilters(
    query: SelectQueryBuilder<WorkItem>,
    filters?: WorkItemFilters
  ): SelectQueryBuilder<WorkItem> {
    if (!filters) return query;

    // Group filter
    if (filters.groupIds?.length) {
      query = query.andWhere('workItem.groupId IN (:...groupIds)', {
        groupIds: filters.groupIds,
      });
    }

    // Team filter
    if (filters.teamIds?.length) {
      query = query.andWhere('workItem.teamId IN (:...teamIds)', {
        teamIds: filters.teamIds,
      });
    }

    // DRI filter
    if (filters.driIds?.length) {
      query = query.andWhere('workItem.driId IN (:...driIds)', {
        driIds: filters.driIds,
      });
    }

    // Priority filter
    if (filters.priorities?.length) {
      query = query.andWhere('workItem.priority IN (:...priorities)', {
        priorities: filters.priorities,
      });
    }

    // Status filter
    if (filters.statuses?.length) {
      query = query.andWhere('workItem.status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    }

    // Health filter
    if (filters.health?.length) {
      query = query.andWhere('workItem.health IN (:...health)', {
        health: filters.health,
      });
    }

    // Boolean flags
    if (filters.needsHelp !== undefined) {
      query = query.andWhere('workItem.needsHelp = :needsHelp', {
        needsHelp: filters.needsHelp,
      });
    }

    if (filters.atRisk !== undefined) {
      query = query.andWhere('workItem.atRisk = :atRisk', {
        atRisk: filters.atRisk,
      });
    }

    if (filters.stale !== undefined) {
      query = query.andWhere('workItem.stale = :stale', {
        stale: filters.stale,
      });
    }

    // Search query (title and description)
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      query = query.andWhere(
        new Brackets((qb) => {
          qb.where('workItem.title ILIKE :searchTerm', { searchTerm })
            .orWhere('workItem.description ILIKE :searchTerm', { searchTerm });
        })
      );
    }

    // Target date range
    if (filters.targetDateRange) {
      if (filters.targetDateRange.start) {
        query = query.andWhere('workItem.targetDate >= :startDate', {
          startDate: filters.targetDateRange.start,
        });
      }
      if (filters.targetDateRange.end) {
        query = query.andWhere('workItem.targetDate <= :endDate', {
          endDate: filters.targetDateRange.end,
        });
      }
    }

    return query;
  }

  /**
   * Apply cursor-based pagination
   */
  private applyCursorPagination(
    query: SelectQueryBuilder<WorkItem>,
    sortField: string,
    sortDirection: 'ASC' | 'DESC',
    sortValue: string,
    id: string
  ): SelectQueryBuilder<WorkItem> {
    const operator = sortDirection === 'DESC' ? '<' : '>';
    const equalOperator = sortDirection === 'DESC' ? '<=' : '>=';

    // For cursor pagination, we need to handle the case where sortValue might be equal
    query = query.andWhere(
      new Brackets((qb) => {
        qb.where(`workItem.${sortField} ${operator} :sortValue`, { sortValue })
          .orWhere(
            new Brackets((innerQb) => {
              innerQb
                .where(`workItem.${sortField} = :sortValue`, { sortValue })
                .andWhere(`workItem.id ${operator} :cursorId`, { cursorId: id });
            })
          );
      })
    );

    return query;
  }

  /**
   * Get sort value from work item based on field
   */
  private getSortValue(item: WorkItem, field: string): string {
    const value = (item as unknown as Record<string, unknown>)[field];
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value ?? '');
  }

  /**
   * Get total count with filters applied
   */
  private async getFilteredCount(filters?: WorkItemFilters): Promise<number> {
    let query = this.repository.createQueryBuilder('workItem');
    query = this.applyFilters(query, filters);
    return query.getCount();
  }

  /**
   * Get stale work items (no activity for threshold days)
   */
  async findStale(thresholdDays: number = 7): Promise<WorkItem[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

    return this.repository
      .createQueryBuilder('workItem')
      .where('workItem.lastActivityAt < :threshold', { threshold: thresholdDate })
      .orWhere('workItem.lastActivityAt IS NULL')
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      })
      .orderBy('workItem.lastActivityAt', 'ASC', 'NULLS FIRST')
      .getMany();
  }

  /**
   * Get drifting work items (drift score above threshold)
   */
  async findDrifting(threshold: number = 0.7): Promise<WorkItem[]> {
    return this.repository
      .createQueryBuilder('workItem')
      .where('workItem.driftScore >= :threshold', { threshold })
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      })
      .orderBy('workItem.driftScore', 'DESC')
      .getMany();
  }

  /**
   * Get work items for executive breakfast board
   * P0/P1 items that are at risk, need help, or have RED health
   */
  async findExecBreakfastItems(week?: string): Promise<WorkItem[]> {
    let query = this.repository
      .createQueryBuilder('workItem')
      .where('workItem.priority IN (:...priorities)', {
        priorities: [Priority.P0, Priority.P1],
      })
      .andWhere(
        new Brackets((qb) => {
          qb.where('workItem.atRisk = true')
            .orWhere('workItem.needsHelp = true')
            .orWhere('workItem.health = :redHealth', { redHealth: HealthStatus.RED });
        })
      )
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      });

    if (week) {
      // Filter by updates in the specified week
      query = query
        .leftJoin('workItem.updates', 'update')
        .andWhere('update.week = :week', { week });
    }

    return query
      .orderBy('workItem.priority', 'ASC')
      .addOrderBy('workItem.targetDate', 'ASC')
      .getMany();
  }

  /**
   * Get work items for a specific group
   */
  async findByGroup(groupId: string, week?: string): Promise<WorkItem[]> {
    let query = this.repository
      .createQueryBuilder('workItem')
      .where('workItem.groupId = :groupId', { groupId })
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      });

    if (week) {
      query = query
        .leftJoin('workItem.updates', 'update')
        .andWhere('update.week = :week', { week });
    }

    return query
      .orderBy('workItem.priority', 'ASC')
      .addOrderBy('workItem.targetDate', 'ASC')
      .getMany();
  }

  /**
   * Create a new work item
   */
  async create(data: Partial<WorkItem>): Promise<WorkItem> {
    const workItem = this.repository.create({
      ...data,
      originalTargetDate: data.targetDate, // Set original target date on creation
    });
    return this.repository.save(workItem);
  }

  /**
   * Update a work item
   */
  async update(id: string, data: Partial<WorkItem>): Promise<WorkItem | null> {
    await this.repository.update(id, data as QueryDeepPartialEntity<WorkItem>);
    return this.findById(id);
  }

  /**
   * Delete a work item
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Mark work item as stale
   */
  async markStale(id: string): Promise<WorkItem | null> {
    return this.update(id, { stale: true });
  }

  /**
   * Mark work item as at risk
   */
  async markAtRisk(id: string): Promise<WorkItem | null> {
    return this.update(id, { atRisk: true });
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(id: string, activityAt: Date = new Date()): Promise<void> {
    await this.repository.update(id, {
      lastActivityAt: activityAt,
      stale: false, // Reset stale flag on activity
    });
  }

  /**
   * Set AI suggested update
   */
  async setAiSuggestedUpdate(id: string, suggestion: string): Promise<WorkItem | null> {
    return this.update(id, { aiSuggestedUpdate: suggestion });
  }

  /**
   * Set drift score
   */
  async setDriftScore(id: string, score: number): Promise<WorkItem | null> {
    return this.update(id, { driftScore: score });
  }
}

// Export singleton instance
export const workItemRepository = new WorkItemRepository();
