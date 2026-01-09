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
import { Service } from 'typedi';

import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { WorkItem } from '../entities/WorkItem.entity';
import { User } from '../entities/User.entity';
import { LineComment } from '../entities/LineComment.entity';
import { WorkUpdateRepository } from '../repositories/WorkUpdateRepository';
import { WorkItemRepository } from '../repositories/WorkItemRepository';
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
// RESOLVER
// ============================================

@Service()
@Resolver(() => WorkUpdate)
export class WorkUpdateResolver {
  constructor(
    private readonly workUpdateRepository: WorkUpdateRepository,
    private readonly workItemRepository: WorkItemRepository
  ) {}

  /**
   * Create a new work update
   */
  @Mutation(() => WorkUpdate)
  async createWorkUpdate(
    @Arg('workItemId', () => ID) workItemId: string,
    @Arg('input') input: CreateWorkUpdateInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkUpdate> {
    // Get current week in ISO format (YYYY-Www)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    const week = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;

    const workUpdate = await this.workUpdateRepository.create({
      workItemId,
      content: input.content,
      authorId: ctx.userId,
      week,
      isAiGenerated: input.isAiGenerated ?? false,
      aiConfidence: input.aiConfidence ?? null,
    });

    // Update the work item's lastActivityAt
    await this.workItemRepository.update(workItemId, {
      // lastActivityAt will be set by the repository
    });

    return workUpdate;
  }

  /**
   * Accept an AI-suggested update and publish it
   */
  @Mutation(() => WorkUpdate)
  async acceptAiSuggestedUpdate(
    @Arg('workItemId', () => ID) workItemId: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<WorkUpdate> {
    const workItem = await this.workItemRepository.findById(workItemId);
    if (!workItem) {
      throw new Error('Work item not found');
    }

    if (!workItem.aiSuggestedUpdate) {
      throw new Error('No AI suggestion available');
    }

    // Create the update from the AI suggestion
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    const week = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;

    const workUpdate = await this.workUpdateRepository.create({
      workItemId,
      content: workItem.aiSuggestedUpdate,
      authorId: ctx.userId,
      week,
      isAiGenerated: true,
      aiConfidence: 0.85, // Default confidence for accepted suggestions
    });

    // Clear the AI suggestion
    await this.workItemRepository.update(workItemId, {
      // Clear aiSuggestedUpdate - handled by repository
    });

    return workUpdate;
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
    return this.workUpdateRepository.findLineComments(workUpdate.id);
  }
}
