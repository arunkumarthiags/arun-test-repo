/**
 * WorkItem GraphQL Resolver
 *
 * TypeGraphQL resolver with DataLoader integration for <100ms performance
 */
import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  FieldResolver,
  Root,
  ID,
  InputType,
  Field,
  ObjectType,
  Int,
  registerEnumType,
} from 'type-graphql';
import DataLoader from 'dataloader';

import { WorkItem } from '../entities/WorkItem.entity';
import { User } from '../entities/User.entity';
import { Team } from '../entities/Team.entity';
import { Group } from '../entities/Group.entity';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { Artifact } from '../entities/Artifact.entity';
import { AppDataSource } from '../config/data-source';
import { Priority, WorkStatus, HealthStatus } from '@wt-ros/common';
import { Brackets } from 'typeorm';

// Register enums with TypeGraphQL
registerEnumType(Priority, { name: 'Priority' });
registerEnumType(WorkStatus, { name: 'WorkStatus' });
registerEnumType(HealthStatus, { name: 'HealthStatus' });

// ============================================
// INPUT TYPES
// ============================================

@InputType()
export class CreateWorkItemInput {
  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID)
  driId!: string;

  @Field(() => ID, { nullable: true })
  teamId?: string;

  @Field(() => ID)
  groupId!: string;

  @Field({ nullable: true })
  targetDate?: Date;

  @Field(() => Priority)
  priority!: Priority;

  @Field(() => ID, { nullable: true })
  parentWorkItemId?: string;
}

@InputType()
export class UpdateWorkItemInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  driId?: string;

  @Field(() => ID, { nullable: true })
  teamId?: string;

  @Field({ nullable: true })
  targetDate?: Date;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field(() => WorkStatus, { nullable: true })
  status?: WorkStatus;

  @Field(() => HealthStatus, { nullable: true })
  health?: HealthStatus;

  @Field({ nullable: true })
  needsHelp?: boolean;

  @Field({ nullable: true })
  atRisk?: boolean;
}

@InputType()
export class WorkItemFiltersInput {
  @Field(() => [ID], { nullable: true })
  groupIds?: string[];

  @Field(() => [ID], { nullable: true })
  teamIds?: string[];

  @Field(() => [ID], { nullable: true })
  driIds?: string[];

  @Field(() => [Priority], { nullable: true })
  priorities?: Priority[];

  @Field(() => [WorkStatus], { nullable: true })
  statuses?: WorkStatus[];

  @Field(() => [HealthStatus], { nullable: true })
  health?: HealthStatus[];

  @Field({ nullable: true })
  needsHelp?: boolean;

  @Field({ nullable: true })
  atRisk?: boolean;

  @Field({ nullable: true })
  stale?: boolean;

  @Field({ nullable: true })
  searchQuery?: string;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 50 })
  first?: number;

  @Field({ nullable: true })
  after?: string;
}

@InputType()
export class SortInput {
  @Field({ defaultValue: 'priority' })
  field!: string;

  @Field({ defaultValue: 'ASC' })
  direction!: 'ASC' | 'DESC';
}

// ============================================
// OUTPUT TYPES
// ============================================

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage!: boolean;

  @Field({ nullable: true })
  endCursor?: string;

  @Field(() => Int)
  totalCount!: number;
}

@ObjectType()
export class WorkItemEdge {
  @Field(() => WorkItem)
  node!: WorkItem;

  @Field()
  cursor!: string;
}

@ObjectType()
export class WorkItemConnection {
  @Field(() => [WorkItemEdge])
  edges!: WorkItemEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;
}

// ============================================
// CONTEXT TYPE
// ============================================

export interface GraphQLContext {
  userId: string;
  userLoader: DataLoader<string, User>;
  teamLoader: DataLoader<string, Team>;
  groupLoader: DataLoader<string, Group>;
  workItemLoader: DataLoader<string, WorkItem>;
  redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
    del: (key: string) => Promise<void>;
  };
  req?: unknown;
  res?: unknown;
}

// ============================================
// RESOLVER
// ============================================

@Resolver(() => WorkItem)
export class WorkItemResolver {
  private get repository() {
    return AppDataSource.getRepository(WorkItem);
  }

  private get updateRepository() {
    return AppDataSource.getRepository(WorkUpdate);
  }

  private get artifactRepository() {
    return AppDataSource.getRepository(Artifact);
  }

  // ----------------------------------------
  // QUERIES
  // ----------------------------------------

  /**
   * Get a single work item by ID
   */
  @Query(() => WorkItem, { nullable: true })
  async workItem(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkItem | null> {
    // Try cache first
    const cacheKey = `workItem:${id}`;
    const cached = await ctx.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const workItem = await this.repository.findOne({ where: { id } });

    if (workItem) {
      // Cache for 30 seconds
      await ctx.redis.set(cacheKey, JSON.stringify(workItem), { EX: 30 });
    }

    return workItem;
  }

  /**
   * Get paginated work items with filters
   * Optimized for <100ms response time
   */
  @Query(() => WorkItemConnection)
  async workItems(
    @Arg('filters', { nullable: true }) filters?: WorkItemFiltersInput,
    @Arg('pagination', { nullable: true }) pagination?: PaginationInput,
    @Arg('sort', { nullable: true }) sort?: SortInput,
    @Ctx() ctx?: GraphQLContext
  ): Promise<WorkItemConnection> {
    const first = pagination?.first ?? 50;
    const after = pagination?.after;

    // Build cache key from filters
    const cacheKey = `workItems:${JSON.stringify({ filters, first, after, sort })}`;

    if (ctx?.redis) {
      const cached = await ctx.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Build query
    let query = this.repository.createQueryBuilder('workItem');

    // Apply filters
    if (filters) {
      if (filters.groupIds?.length) {
        query = query.andWhere('workItem.groupId IN (:...groupIds)', {
          groupIds: filters.groupIds,
        });
      }

      if (filters.teamIds?.length) {
        query = query.andWhere('workItem.teamId IN (:...teamIds)', {
          teamIds: filters.teamIds,
        });
      }

      if (filters.driIds?.length) {
        query = query.andWhere('workItem.driId IN (:...driIds)', {
          driIds: filters.driIds,
        });
      }

      if (filters.priorities?.length) {
        query = query.andWhere('workItem.priority IN (:...priorities)', {
          priorities: filters.priorities,
        });
      }

      if (filters.statuses?.length) {
        query = query.andWhere('workItem.status IN (:...statuses)', {
          statuses: filters.statuses,
        });
      }

      if (filters.health?.length) {
        query = query.andWhere('workItem.health IN (:...health)', {
          health: filters.health,
        });
      }

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

      if (filters.searchQuery) {
        const searchTerm = `%${filters.searchQuery}%`;
        query = query.andWhere(
          new Brackets((qb) => {
            qb.where('workItem.title ILIKE :searchTerm', { searchTerm })
              .orWhere('workItem.description ILIKE :searchTerm', { searchTerm });
          })
        );
      }
    }

    // Apply cursor-based pagination
    if (after) {
      try {
        const decoded = Buffer.from(after, 'base64').toString('utf-8');
        const cursorMatch = decoded.match(/cursor:(.+)/);
        if (cursorMatch) {
          const cursorId = cursorMatch[1];
          // Simple cursor: items after the cursor ID
          query = query.andWhere('workItem.id > :cursorId', { cursorId });
        }
      } catch {
        // Invalid cursor, ignore
      }
    }

    // Apply sorting
    const sortField = sort?.field || 'priority';
    const sortDirection = sort?.direction || 'ASC';

    // Map sort field to proper column
    const sortFieldMap: Record<string, string> = {
      priority: 'workItem.priority',
      createdAt: 'workItem.createdAt',
      updatedAt: 'workItem.updatedAt',
      targetDate: 'workItem.targetDate',
      title: 'workItem.title',
    };

    const actualSortField = sortFieldMap[sortField] || 'workItem.priority';
    query = query.orderBy(actualSortField, sortDirection);
    query = query.addOrderBy('workItem.id', 'ASC'); // Secondary sort for stability

    // Get total count (without pagination)
    const totalCount = await query.clone().getCount();

    // Apply limit (fetch one extra to determine hasNextPage)
    query = query.take(first + 1);

    // Execute query
    const items = await query.getMany();

    // Determine pagination info
    const hasNextPage = items.length > first;
    const resultItems = hasNextPage ? items.slice(0, first) : items;

    // Build edges with cursors
    const edges: WorkItemEdge[] = resultItems.map((item) => ({
      node: item,
      cursor: Buffer.from(`cursor:${item.id}`).toString('base64'),
    }));

    const connection: WorkItemConnection = {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
        totalCount,
      },
    };

    // Cache for 30 seconds
    if (ctx?.redis) {
      await ctx.redis.set(cacheKey, JSON.stringify(connection), { EX: 30 });
    }

    return connection;
  }

  /**
   * Get work items for Exec Breakfast board
   */
  @Query(() => [WorkItem])
  async execBreakfastBoard(
    @Arg('week', { nullable: true }) _week?: string
  ): Promise<WorkItem[]> {
    return this.repository
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
      })
      .orderBy('workItem.priority', 'ASC')
      .addOrderBy('workItem.targetDate', 'ASC')
      .getMany();
  }

  /**
   * Get work items for a specific group board
   */
  @Query(() => [WorkItem])
  async groupBoard(
    @Arg('groupId', () => ID) groupId: string,
    @Arg('week', { nullable: true }) _week?: string
  ): Promise<WorkItem[]> {
    return this.repository
      .createQueryBuilder('workItem')
      .where('workItem.groupId = :groupId', { groupId })
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      })
      .orderBy('workItem.priority', 'ASC')
      .addOrderBy('workItem.targetDate', 'ASC')
      .getMany();
  }

  /**
   * Get stale work items (no activity for N days)
   */
  @Query(() => [WorkItem])
  async staleWorkItems(
    @Arg('threshold', () => Int, { defaultValue: 7 }) threshold: number
  ): Promise<WorkItem[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - threshold);

    return this.repository
      .createQueryBuilder('workItem')
      .where(
        new Brackets((qb) => {
          qb.where('workItem.lastActivityAt < :threshold', { threshold: thresholdDate })
            .orWhere('workItem.lastActivityAt IS NULL');
        })
      )
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      })
      .orderBy('workItem.lastActivityAt', 'ASC', 'NULLS FIRST')
      .getMany();
  }

  /**
   * Get work items with high drift scores
   */
  @Query(() => [WorkItem])
  async driftingWorkItems(
    @Arg('threshold', { defaultValue: 0.7 }) threshold: number
  ): Promise<WorkItem[]> {
    return this.repository
      .createQueryBuilder('workItem')
      .where('workItem.driftScore >= :threshold', { threshold })
      .andWhere('workItem.status NOT IN (:...completedStatuses)', {
        completedStatuses: [WorkStatus.COMPLETE, WorkStatus.CANCELLED],
      })
      .orderBy('workItem.driftScore', 'DESC')
      .getMany();
  }

  // ----------------------------------------
  // MUTATIONS
  // ----------------------------------------

  /**
   * Create a new work item
   */
  @Mutation(() => WorkItem)
  async createWorkItem(
    @Arg('input') input: CreateWorkItemInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkItem> {
    const workItem = this.repository.create({
      ...input,
      originalTargetDate: input.targetDate,
      status: WorkStatus.NOT_STARTED,
      health: HealthStatus.UNKNOWN,
      needsHelp: false,
      atRisk: false,
      stale: false,
    });

    const saved = await this.repository.save(workItem);

    // Invalidate list caches
    await this.invalidateListCaches(ctx);

    return saved;
  }

  /**
   * Update an existing work item
   */
  @Mutation(() => WorkItem)
  async updateWorkItem(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateWorkItemInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkItem> {
    await this.repository.update(id, input);
    const workItem = await this.repository.findOne({ where: { id } });

    if (!workItem) {
      throw new Error('Work item not found');
    }

    // Invalidate caches
    await ctx.redis.del(`workItem:${id}`);
    await this.invalidateListCaches(ctx);

    return workItem;
  }

  /**
   * Delete a work item
   */
  @Mutation(() => Boolean)
  async deleteWorkItem(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<boolean> {
    const result = await this.repository.delete(id);

    // Invalidate caches
    await ctx.redis.del(`workItem:${id}`);
    await this.invalidateListCaches(ctx);

    return (result.affected ?? 0) > 0;
  }

  /**
   * Trigger AI synthesis for a work item
   */
  @Mutation(() => WorkItem)
  async triggerSynthesis(
    @Arg('workItemId', () => ID) workItemId: string
  ): Promise<WorkItem> {
    // This would trigger the sync engine to generate an AI update
    // For now, we just return the work item
    const workItem = await this.repository.findOne({ where: { id: workItemId } });
    if (!workItem) {
      throw new Error('Work item not found');
    }

    // TODO: Trigger synthesis job
    // await synthesisQueue.add({ workItemId });

    return workItem;
  }

  /**
   * Flag a work item as at risk
   */
  @Mutation(() => WorkItem)
  async flagAsAtRisk(
    @Arg('workItemId', () => ID) workItemId: string,
    @Arg('reason') _reason: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkItem> {
    await this.repository.update(workItemId, {
      atRisk: true,
      health: HealthStatus.RED,
    });

    const workItem = await this.repository.findOne({ where: { id: workItemId } });

    if (!workItem) {
      throw new Error('Work item not found');
    }

    // TODO: Create a system update with the reason
    // await workUpdateRepository.create({
    //   workItemId,
    //   content: `Flagged as at risk: ${reason}`,
    //   isAiGenerated: false,
    // });

    await ctx.redis.del(`workItem:${workItemId}`);
    await this.invalidateListCaches(ctx);

    return workItem;
  }

  // ----------------------------------------
  // FIELD RESOLVERS (with DataLoader)
  // ----------------------------------------

  /**
   * Resolve DRI (owner) using DataLoader to batch queries
   */
  @FieldResolver(() => User)
  async dri(
    @Root() workItem: WorkItem,
    @Ctx() ctx: GraphQLContext
  ): Promise<User | null> {
    if (!workItem.driId) return null;
    return ctx.userLoader.load(workItem.driId);
  }

  /**
   * Resolve Team using DataLoader
   */
  @FieldResolver(() => Team, { nullable: true })
  async team(
    @Root() workItem: WorkItem,
    @Ctx() ctx: GraphQLContext
  ): Promise<Team | null> {
    if (!workItem.teamId) return null;
    return ctx.teamLoader.load(workItem.teamId);
  }

  /**
   * Resolve Group using DataLoader
   */
  @FieldResolver(() => Group)
  async group(
    @Root() workItem: WorkItem,
    @Ctx() ctx: GraphQLContext
  ): Promise<Group | null> {
    return ctx.groupLoader.load(workItem.groupId);
  }

  /**
   * Resolve parent work item using DataLoader
   */
  @FieldResolver(() => WorkItem, { nullable: true })
  async parentWorkItem(
    @Root() workItem: WorkItem,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkItem | null> {
    if (!workItem.parentWorkItemId) return null;
    return ctx.workItemLoader.load(workItem.parentWorkItemId);
  }

  /**
   * Resolve child work items
   */
  @FieldResolver(() => [WorkItem])
  async childWorkItems(@Root() workItem: WorkItem): Promise<WorkItem[]> {
    return this.repository.find({
      where: { parentWorkItemId: workItem.id },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Resolve work updates
   */
  @FieldResolver(() => [WorkUpdate])
  async updates(@Root() workItem: WorkItem): Promise<WorkUpdate[]> {
    return this.updateRepository.find({
      where: { workItemId: workItem.id },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Resolve artifacts
   */
  @FieldResolver(() => [Artifact])
  async artifactEntities(@Root() workItem: WorkItem): Promise<Artifact[]> {
    return this.artifactRepository.find({
      where: { workItemId: workItem.id },
    });
  }

  // ----------------------------------------
  // HELPERS
  // ----------------------------------------

  /**
   * Invalidate all list-related caches
   */
  private async invalidateListCaches(_ctx: GraphQLContext): Promise<void> {
    // In production, use Redis SCAN to find and delete matching keys
    // For now, we rely on TTL expiration
  }
}
