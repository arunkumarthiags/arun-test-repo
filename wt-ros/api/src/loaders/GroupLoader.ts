import DataLoader from 'dataloader';
import { In } from 'typeorm';
import { Group } from '../entities/Group.entity';
import { AppDataSource } from '../config/data-source';

/**
 * DataLoader for batching Group queries by ID.
 * Prevents N+1 queries when resolving group relationships.
 */
export const createGroupLoader = (): DataLoader<string, Group | null> => {
  return new DataLoader<string, Group | null>(
    async (groupIds: readonly string[]) => {
      const groupRepository = AppDataSource.getRepository(Group);

      const groups = await groupRepository.find({
        where: { id: In([...groupIds]) },
      });

      // Create a map for O(1) lookup
      const groupMap = new Map<string, Group>();
      groups.forEach((group) => {
        groupMap.set(group.id, group);
      });

      // Return groups in the same order as requested IDs
      return groupIds.map((id) => groupMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      batchScheduleFn: (callback) => setTimeout(callback, 0),
    }
  );
};

/**
 * DataLoader for loading all groups.
 * Used for dropdown selections and filters.
 */
export const createAllGroupsLoader = (): DataLoader<string, Group[]> => {
  return new DataLoader<string, Group[]>(
    async (keys: readonly string[]) => {
      const groupRepository = AppDataSource.getRepository(Group);

      const groups = await groupRepository.find({
        order: { name: 'ASC' },
      });

      // Return the same groups array for all keys (single query for all)
      return keys.map(() => groups);
    },
    {
      // All keys return the same result
      cacheKeyFn: () => 'all_groups',
    }
  );
};
