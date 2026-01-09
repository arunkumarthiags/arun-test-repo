import DataLoader from 'dataloader';
import { In } from 'typeorm';
import { LineComment } from '../entities/LineComment.entity';
import { AppDataSource } from '../config/data-source';

/**
 * DataLoader for batching LineComment queries by ID.
 */
export const createLineCommentLoader = (): DataLoader<string, LineComment | null> => {
  return new DataLoader<string, LineComment | null>(
    async (commentIds: readonly string[]) => {
      const commentRepository = AppDataSource.getRepository(LineComment);

      const comments = await commentRepository.find({
        where: { id: In([...commentIds]) },
      });

      const commentMap = new Map<string, LineComment>();
      comments.forEach((comment) => {
        commentMap.set(comment.id, comment);
      });

      return commentIds.map((id) => commentMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      batchScheduleFn: (callback) => setTimeout(callback, 0),
    }
  );
};

/**
 * DataLoader for batching LineComments by WorkUpdate ID.
 */
export const createLineCommentsByUpdateLoader = (): DataLoader<string, LineComment[]> => {
  return new DataLoader<string, LineComment[]>(
    async (updateIds: readonly string[]) => {
      const commentRepository = AppDataSource.getRepository(LineComment);

      const comments = await commentRepository.find({
        where: { updateId: In([...updateIds]) },
        order: { startOffset: 'ASC', createdAt: 'ASC' },
      });

      // Group comments by updateId
      const commentsByUpdate = new Map<string, LineComment[]>();
      updateIds.forEach((id) => commentsByUpdate.set(id, []));

      comments.forEach((comment) => {
        const updateComments = commentsByUpdate.get(comment.updateId);
        if (updateComments) {
          updateComments.push(comment);
        }
      });

      return updateIds.map((id) => commentsByUpdate.get(id) || []);
    }
  );
};

/**
 * DataLoader for batching unresolved LineComments by WorkUpdate ID.
 */
export const createUnresolvedCommentsLoader = (): DataLoader<string, LineComment[]> => {
  return new DataLoader<string, LineComment[]>(
    async (updateIds: readonly string[]) => {
      const commentRepository = AppDataSource.getRepository(LineComment);

      const comments = await commentRepository.find({
        where: {
          updateId: In([...updateIds]),
          resolved: false,
        },
        order: { startOffset: 'ASC', createdAt: 'ASC' },
      });

      // Group comments by updateId
      const commentsByUpdate = new Map<string, LineComment[]>();
      updateIds.forEach((id) => commentsByUpdate.set(id, []));

      comments.forEach((comment) => {
        const updateComments = commentsByUpdate.get(comment.updateId);
        if (updateComments) {
          updateComments.push(comment);
        }
      });

      return updateIds.map((id) => commentsByUpdate.get(id) || []);
    }
  );
};
