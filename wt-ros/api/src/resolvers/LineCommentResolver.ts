/**
 * LineComment GraphQL Resolver
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
  Int,
} from 'type-graphql';

import { LineComment } from '../entities/LineComment.entity';
import { User } from '../entities/User.entity';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { AppDataSource } from '../config/data-source';
import { GraphQLContext } from './WorkItemResolver';

// ============================================
// INPUT TYPES
// ============================================

@InputType()
export class LineCommentInput {
  @Field(() => Int)
  startOffset!: number;

  @Field(() => Int)
  endOffset!: number;

  @Field()
  content!: string;

  @Field(() => [ID], { nullable: true })
  mentionIds?: string[];
}

// ============================================
// RESOLVER
// ============================================

@Resolver(() => LineComment)
export class LineCommentResolver {
  private get repository() {
    return AppDataSource.getRepository(LineComment);
  }

  private get workUpdateRepository() {
    return AppDataSource.getRepository(WorkUpdate);
  }

  // ----------------------------------------
  // QUERIES
  // ----------------------------------------

  /**
   * Get a single line comment by ID
   */
  @Query(() => LineComment, { nullable: true })
  async lineComment(
    @Arg('id', () => ID) id: string
  ): Promise<LineComment | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Get all comments for a work update
   */
  @Query(() => [LineComment])
  async lineComments(
    @Arg('updateId', () => ID) updateId: string
  ): Promise<LineComment[]> {
    return this.repository.find({
      where: { updateId },
      order: { startOffset: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get unresolved comments for a work update
   */
  @Query(() => [LineComment])
  async unresolvedComments(
    @Arg('updateId', () => ID) updateId: string
  ): Promise<LineComment[]> {
    return this.repository.find({
      where: { updateId, resolved: false },
      order: { startOffset: 'ASC', createdAt: 'ASC' },
    });
  }

  // ----------------------------------------
  // MUTATIONS
  // ----------------------------------------

  /**
   * Add a line comment to a work update
   */
  @Mutation(() => LineComment)
  async addLineComment(
    @Arg('updateId', () => ID) updateId: string,
    @Arg('input') input: LineCommentInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<LineComment> {
    // Verify work update exists
    const workUpdate = await this.workUpdateRepository.findOne({ where: { id: updateId } });
    if (!workUpdate) {
      throw new Error('Work update not found');
    }

    const lineComment = this.repository.create({
      updateId,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      content: input.content,
      authorId: ctx.userId,
      mentionIds: input.mentionIds ?? [],
      resolved: false,
    });

    const saved = await this.repository.save(lineComment);

    // TODO: Send notifications to mentioned users
    // await notificationService.notifyMentions(input.mentionIds, lineComment);

    return saved;
  }

  /**
   * Update a line comment
   */
  @Mutation(() => LineComment)
  async updateLineComment(
    @Arg('commentId', () => ID) commentId: string,
    @Arg('content') content: string
  ): Promise<LineComment> {
    await this.repository.update(commentId, { content });
    const updated = await this.repository.findOne({ where: { id: commentId } });
    if (!updated) {
      throw new Error('Line comment not found');
    }
    return updated;
  }

  /**
   * Resolve a line comment
   */
  @Mutation(() => LineComment)
  async resolveLineComment(
    @Arg('commentId', () => ID) commentId: string
  ): Promise<LineComment> {
    await this.repository.update(commentId, { resolved: true });
    const lineComment = await this.repository.findOne({ where: { id: commentId } });
    if (!lineComment) {
      throw new Error('Line comment not found');
    }
    return lineComment;
  }

  /**
   * Unresolve a line comment
   */
  @Mutation(() => LineComment)
  async unresolveLineComment(
    @Arg('commentId', () => ID) commentId: string
  ): Promise<LineComment> {
    await this.repository.update(commentId, { resolved: false });
    const lineComment = await this.repository.findOne({ where: { id: commentId } });
    if (!lineComment) {
      throw new Error('Line comment not found');
    }
    return lineComment;
  }

  /**
   * Delete a line comment
   */
  @Mutation(() => Boolean)
  async deleteLineComment(
    @Arg('commentId', () => ID) commentId: string
  ): Promise<boolean> {
    const result = await this.repository.delete(commentId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Resolve all comments for a work update
   */
  @Mutation(() => Boolean)
  async resolveAllComments(
    @Arg('updateId', () => ID) updateId: string
  ): Promise<boolean> {
    const result = await this.repository.update(
      { updateId, resolved: false },
      { resolved: true }
    );
    return (result.affected ?? 0) > 0;
  }

  // ----------------------------------------
  // FIELD RESOLVERS
  // ----------------------------------------

  @FieldResolver(() => User)
  async author(
    @Root() lineComment: LineComment,
    @Ctx() ctx: GraphQLContext
  ): Promise<User | null> {
    return ctx.userLoader.load(lineComment.authorId);
  }

  @FieldResolver(() => [User])
  async mentions(
    @Root() lineComment: LineComment,
    @Ctx() ctx: GraphQLContext
  ): Promise<User[]> {
    if (!lineComment.mentionIds || lineComment.mentionIds.length === 0) {
      return [];
    }
    return ctx.userLoader.loadMany(lineComment.mentionIds) as Promise<User[]>;
  }

  @FieldResolver(() => WorkUpdate)
  async update(
    @Root() lineComment: LineComment
  ): Promise<WorkUpdate | null> {
    return this.workUpdateRepository.findOne({ where: { id: lineComment.updateId } });
  }
}
