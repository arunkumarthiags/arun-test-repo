/**
 * DataLoader exports and context type definition
 */

import DataLoader from 'dataloader';
import { User } from '../entities/User.entity';
import { Team } from '../entities/Team.entity';
import { Group } from '../entities/Group.entity';
import { WorkItem } from '../entities/WorkItem.entity';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { LineComment } from '../entities/LineComment.entity';
import { Artifact } from '../entities/Artifact.entity';

import { createUserLoader, createUserByEmailLoader, createUsersByIdsLoader } from './UserLoader';
import { createTeamLoader, createTeamsByGroupLoader } from './TeamLoader';
import { createGroupLoader, createAllGroupsLoader } from './GroupLoader';
import {
  createWorkItemLoader,
  createChildWorkItemsLoader,
  createWorkUpdatesLoader,
  createArtifactsLoader,
} from './WorkItemLoader';
import {
  createLineCommentLoader,
  createLineCommentsByUpdateLoader,
  createUnresolvedCommentsLoader,
} from './LineCommentLoader';

/**
 * Interface for all DataLoaders available in the context
 */
export interface Loaders {
  // User loaders
  userLoader: DataLoader<string, User | null>;
  userByEmailLoader: DataLoader<string, User | null>;
  usersByIdsLoader: DataLoader<string[], User[]>;

  // Team loaders
  teamLoader: DataLoader<string, Team | null>;
  teamsByGroupLoader: DataLoader<string, Team[]>;

  // Group loaders
  groupLoader: DataLoader<string, Group | null>;
  allGroupsLoader: DataLoader<string, Group[]>;

  // WorkItem loaders
  workItemLoader: DataLoader<string, WorkItem | null>;
  childWorkItemsLoader: DataLoader<string, WorkItem[]>;
  workUpdatesLoader: DataLoader<string, WorkUpdate[]>;
  artifactsLoader: DataLoader<string, Artifact[]>;

  // LineComment loaders
  lineCommentLoader: DataLoader<string, LineComment | null>;
  lineCommentsByUpdateLoader: DataLoader<string, LineComment[]>;
  unresolvedCommentsLoader: DataLoader<string, LineComment[]>;
}

/**
 * Create all DataLoaders for a request.
 * Should be called once per request to ensure proper caching.
 */
export const createLoaders = (): Loaders => ({
  // User loaders
  userLoader: createUserLoader(),
  userByEmailLoader: createUserByEmailLoader(),
  usersByIdsLoader: createUsersByIdsLoader(),

  // Team loaders
  teamLoader: createTeamLoader(),
  teamsByGroupLoader: createTeamsByGroupLoader(),

  // Group loaders
  groupLoader: createGroupLoader(),
  allGroupsLoader: createAllGroupsLoader(),

  // WorkItem loaders
  workItemLoader: createWorkItemLoader(),
  childWorkItemsLoader: createChildWorkItemsLoader(),
  workUpdatesLoader: createWorkUpdatesLoader(),
  artifactsLoader: createArtifactsLoader(),

  // LineComment loaders
  lineCommentLoader: createLineCommentLoader(),
  lineCommentsByUpdateLoader: createLineCommentsByUpdateLoader(),
  unresolvedCommentsLoader: createUnresolvedCommentsLoader(),
});

// Re-export individual loaders
export * from './UserLoader';
export * from './TeamLoader';
export * from './GroupLoader';
export * from './WorkItemLoader';
export * from './LineCommentLoader';
