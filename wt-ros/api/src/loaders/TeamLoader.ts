import DataLoader from 'dataloader';
import { In } from 'typeorm';
import { Team } from '../entities/Team.entity';
import { AppDataSource } from '../config/data-source';

/**
 * DataLoader for batching Team queries by ID.
 * Prevents N+1 queries when resolving team relationships.
 */
export const createTeamLoader = (): DataLoader<string, Team | null> => {
  return new DataLoader<string, Team | null>(
    async (teamIds: readonly string[]) => {
      const teamRepository = AppDataSource.getRepository(Team);

      // Filter out null/undefined values
      const validIds = teamIds.filter((id): id is string => id != null);

      if (validIds.length === 0) {
        return teamIds.map(() => null);
      }

      const teams = await teamRepository.find({
        where: { id: In(validIds) },
      });

      // Create a map for O(1) lookup
      const teamMap = new Map<string, Team>();
      teams.forEach((team) => {
        teamMap.set(team.id, team);
      });

      // Return teams in the same order as requested IDs
      return teamIds.map((id) => (id ? teamMap.get(id) || null : null));
    },
    {
      cacheKeyFn: (key) => key || 'null',
      batchScheduleFn: (callback) => setTimeout(callback, 0),
    }
  );
};

/**
 * DataLoader for batching Team queries by group ID.
 * Returns all teams belonging to a group.
 */
export const createTeamsByGroupLoader = (): DataLoader<string, Team[]> => {
  return new DataLoader<string, Team[]>(
    async (groupIds: readonly string[]) => {
      const teamRepository = AppDataSource.getRepository(Team);

      const teams = await teamRepository.find({
        where: { groupId: In([...groupIds]) },
        order: { name: 'ASC' },
      });

      // Group teams by groupId
      const teamsByGroup = new Map<string, Team[]>();
      groupIds.forEach((id) => teamsByGroup.set(id, []));

      teams.forEach((team) => {
        const groupTeams = teamsByGroup.get(team.groupId);
        if (groupTeams) {
          groupTeams.push(team);
        }
      });

      return groupIds.map((id) => teamsByGroup.get(id) || []);
    }
  );
};
