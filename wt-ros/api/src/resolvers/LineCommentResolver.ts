/**
 * LineComment GraphQL Resolver
 */
import {
  Resolver,
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
import { Service } from 'typedi';

import { LineComment } from '../entities/LineComment.entity';
import { User } from '../entities/User.entity';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { LineCommentRepository } from '../repositories/LineCommentRepository';
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

@Service()
@Resolver(() => LineComment)
export class LineCommentResolver {
  constructor(private readonly lineCommentRepository: LineCommentRepository) {}

  /**
   * Add a line comment to a work update
   */
  @Mutation(() => LineComment)
  async addLineComment(
    @Arg('updateId', () => ID) updateId: string,
    @Arg('input') input: LineCommentInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<LineComment> {
    const lineComment = await this.lineCommentRepository.create({
      updateId,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      content: input.content,
      authorId: ctx.userId,
      mentionIds: input.mentionIds ?? [],
      resolved: false,
    });

    // TODO: Send notifications to mentioned users
    // await notificationService.notifyMentions(input.mentionIds, lineComment);

    return lineComment;
  }

  /**
   * Resolve a line comment
   */
  @Mutation(() => LineComment)
  async resolveLineComment(
    @Arg('commentId', () => ID) commentId: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<LineComment> {
    const lineComment = await this.lineCommentRepository.resolve(commentId);
    return lineComment;
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
}
