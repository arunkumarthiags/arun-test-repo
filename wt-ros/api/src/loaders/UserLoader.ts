import DataLoader from 'dataloader';
import { In } from 'typeorm';
import { User } from '../entities/User.entity';
import { AppDataSource } from '../config/data-source';

/**
 * DataLoader for batching User queries.
 * Prevents N+1 queries when resolving user relationships.
 */
export const createUserLoader = (): DataLoader<string, User | null> => {
  return new DataLoader<string, User | null>(
    async (userIds: readonly string[]) => {
      const userRepository = AppDataSource.getRepository(User);

      const users = await userRepository.find({
        where: { id: In([...userIds]) },
      });

      // Create a map for O(1) lookup
      const userMap = new Map<string, User>();
      users.forEach((user) => {
        userMap.set(user.id, user);
      });

      // Return users in the same order as requested IDs
      return userIds.map((id) => userMap.get(id) || null);
    },
    {
      // Cache keys are strings (UUIDs)
      cacheKeyFn: (key) => key,
      // Batch within the same tick
      batchScheduleFn: (callback) => setTimeout(callback, 0),
    }
  );
};

/**
 * DataLoader for batching User queries by email.
 */
export const createUserByEmailLoader = (): DataLoader<string, User | null> => {
  return new DataLoader<string, User | null>(
    async (emails: readonly string[]) => {
      const userRepository = AppDataSource.getRepository(User);

      const users = await userRepository.find({
        where: { email: In([...emails]) },
      });

      const userMap = new Map<string, User>();
      users.forEach((user) => {
        userMap.set(user.email, user);
      });

      return emails.map((email) => userMap.get(email) || null);
    }
  );
};

/**
 * Batch load multiple users by their IDs.
 * Used for loading mentioned users in comments.
 */
export const createUsersByIdsLoader = (): DataLoader<string[], User[], string> => {
  return new DataLoader<string[], User[], string>(
    async (idArrays: readonly string[][]) => {
      const userRepository = AppDataSource.getRepository(User);

      // Flatten all IDs and deduplicate
      const allIds = [...new Set(idArrays.flat())];

      if (allIds.length === 0) {
        return idArrays.map(() => []);
      }

      const users = await userRepository.find({
        where: { id: In(allIds) },
      });

      const userMap = new Map<string, User>();
      users.forEach((user) => {
        userMap.set(user.id, user);
      });

      // Return arrays of users for each input array
      return idArrays.map((ids) =>
        ids.map((id) => userMap.get(id)).filter((u): u is User => u !== undefined)
      );
    },
    {
      // Use JSON as cache key for arrays
      cacheKeyFn: (ids) => JSON.stringify([...ids].sort()),
    }
  );
};
