/**
 * WorkUpdate GraphQL Resolver
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
} from 'type-graphql';

import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { WorkItem } from '../entities/WorkItem.entity';
import { User } from '../entities/User.entity';
import { LineComment } from '../entities/LineComment.entity';
import { AppDataSource } from '../config/data-source';
import { GraphQLContext } from './WorkItemResolver';

// ============================================
// INPUT TYPES
// ============================================

@InputType()
export class CreateWorkUpdateInput {
  @Field()
  content!: string;

  @Field({ nullable: true, defaultValue: false })
  isAiGenerated?: boolean;

  @Field({ nullable: true })
  aiConfidence?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current ISO week string in format "YYYY-WXX"
 */
function getCurrentWeek(): string {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

// ============================================
// RESOLVER
// ============================================

@Resolver(() => WorkUpdate)
export class WorkUpdateResolver {
  private get repository() {
    return AppDataSource.getRepository(WorkUpdate);
  }

  private get workItemRepository() {
    return AppDataSource.getRepository(WorkItem);
  }

  private get lineCommentRepository() {
    return AppDataSource.getRepository(LineComment);
  }

  // ----------------------------------------
  // QUERIES
  // ----------------------------------------

  /**
   * Get a single work update by ID
   */
  @Query(() => WorkUpdate, { nullable: true })
  async workUpdate(
    @Arg('id', () => ID) id: string
  ): Promise<WorkUpdate | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Get all updates for a work item
   */
  @Query(() => [WorkUpdate])
  async workUpdates(
    @Arg('workItemId', () => ID) workItemId: string
  ): Promise<WorkUpdate[]> {
    return this.repository.find({
      where: { workItemId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get updates for a specific week
   */
  @Query(() => [WorkUpdate])
  async weeklyUpdates(
    @Arg('week', { nullable: true }) week?: string
  ): Promise<WorkUpdate[]> {
    const targetWeek = week || getCurrentWeek();
    return this.repository.find({
      where: { week: targetWeek },
      order: { createdAt: 'DESC' },
    });
  }

  // ----------------------------------------
  // MUTATIONS
  // ----------------------------------------

  /**
   * Create a new work update
   */
  @Mutation(() => WorkUpdate)
  async createWorkUpdate(
    @Arg('workItemId', () => ID) workItemId: string,
    @Arg('input') input: CreateWorkUpdateInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkUpdate> {
    // Verify work item exists
    const workItem = await this.workItemRepository.findOne({ where: { id: workItemId } });
    if (!workItem) {
      throw new Error('Work item not found');
    }

    const week = getCurrentWeek();

    const workUpdate = this.repository.create({
      workItemId,
      content: input.content,
      authorId: ctx.userId,
      week,
      isAiGenerated: input.isAiGenerated ?? false,
      aiConfidence: input.aiConfidence ?? null,
    });

    const saved = await this.repository.save(workUpdate);

    // Update the work item's lastActivityAt
    await this.workItemRepository.update(workItemId, {
      lastActivityAt: new Date(),
      stale: false,
    });

    return saved;
  }

  /**
   * Accept an AI-suggested update and publish it
   */
  @Mutation(() => WorkUpdate)
  async acceptAiSuggestedUpdate(
    @Arg('workItemId', () => ID) workItemId: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkUpdate> {
    const workItem = await this.workItemRepository.findOne({ where: { id: workItemId } });
    if (!workItem) {
      throw new Error('Work item not found');
    }

    if (!workItem.aiSuggestedUpdate) {
      throw new Error('No AI suggestion available');
    }

    const week = getCurrentWeek();

    const workUpdate = this.repository.create({
      workItemId,
      content: workItem.aiSuggestedUpdate,
      authorId: ctx.userId,
      week,
      isAiGenerated: true,
      aiConfidence: 0.85, // Default confidence for accepted suggestions
    });

    const saved = await this.repository.save(workUpdate);

    // Clear the AI suggestion and update last activity
    await this.workItemRepository.update(workItemId, {
      aiSuggestedUpdate: null,
      lastActivityAt: new Date(),
      stale: false,
    });

    return saved;
  }

  /**
   * Update an existing work update
   */
  @Mutation(() => WorkUpdate)
  async updateWorkUpdate(
    @Arg('id', () => ID) id: string,
    @Arg('content') content: string
  ): Promise<WorkUpdate> {
    await this.repository.update(id, { content });
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) {
      throw new Error('Work update not found');
    }
    return updated;
  }

  /**
   * Delete a work update
   */
  @Mutation(() => Boolean)
  async deleteWorkUpdate(
    @Arg('id', () => ID) id: string
  ): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ----------------------------------------
  // FIELD RESOLVERS
  // ----------------------------------------

  @FieldResolver(() => User)
  async author(
    @Root() workUpdate: WorkUpdate,
    @Ctx() ctx: GraphQLContext
  ): Promise<User | null> {
    return ctx.userLoader.load(workUpdate.authorId);
  }

  @FieldResolver(() => WorkItem)
  async workItem(
    @Root() workUpdate: WorkUpdate,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkItem | null> {
    return ctx.workItemLoader.load(workUpdate.workItemId);
  }

  @FieldResolver(() => [LineComment])
  async lineComments(@Root() workUpdate: WorkUpdate): Promise<LineComment[]> {
    return this.lineCommentRepository.find({
      where: { updateId: workUpdate.id },
      order: { startOffset: 'ASC', createdAt: 'ASC' },
    });
  }
}
