import DataLoader from 'dataloader';
import { In } from 'typeorm';
import { WorkItem } from '../entities/WorkItem.entity';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { Artifact } from '../entities/Artifact.entity';
import { AppDataSource } from '../config/data-source';

/**
 * DataLoader for batching WorkItem queries by ID.
 */
export const createWorkItemLoader = (): DataLoader<string, WorkItem | null> => {
  return new DataLoader<string, WorkItem | null>(
    async (workItemIds: readonly string[]) => {
      const workItemRepository = AppDataSource.getRepository(WorkItem);

      const workItems = await workItemRepository.find({
        where: { id: In([...workItemIds]) },
      });

      const workItemMap = new Map<string, WorkItem>();
      workItems.forEach((item) => {
        workItemMap.set(item.id, item);
      });

      return workItemIds.map((id) => workItemMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      batchScheduleFn: (callback) => setTimeout(callback, 0),
    }
  );
};

/**
 * DataLoader for batching child WorkItems by parent ID.
 */
export const createChildWorkItemsLoader = (): DataLoader<string, WorkItem[]> => {
  return new DataLoader<string, WorkItem[]>(
    async (parentIds: readonly string[]) => {
      const workItemRepository = AppDataSource.getRepository(WorkItem);

      const children = await workItemRepository.find({
        where: { parentWorkItemId: In([...parentIds]) },
        order: { priority: 'ASC', createdAt: 'DESC' },
      });

      // Group children by parentWorkItemId
      const childrenByParent = new Map<string, WorkItem[]>();
      parentIds.forEach((id) => childrenByParent.set(id, []));

      children.forEach((child) => {
        if (child.parentWorkItemId) {
          const parentChildren = childrenByParent.get(child.parentWorkItemId);
          if (parentChildren) {
            parentChildren.push(child);
          }
        }
      });

      return parentIds.map((id) => childrenByParent.get(id) || []);
    }
  );
};

/**
 * DataLoader for batching WorkUpdates by WorkItem ID.
 */
export const createWorkUpdatesLoader = (): DataLoader<string, WorkUpdate[]> => {
  return new DataLoader<string, WorkUpdate[]>(
    async (workItemIds: readonly string[]) => {
      const workUpdateRepository = AppDataSource.getRepository(WorkUpdate);

      const updates = await workUpdateRepository.find({
        where: { workItemId: In([...workItemIds]) },
        order: { createdAt: 'DESC' },
      });

      // Group updates by workItemId
      const updatesByWorkItem = new Map<string, WorkUpdate[]>();
      workItemIds.forEach((id) => updatesByWorkItem.set(id, []));

      updates.forEach((update) => {
        const workItemUpdates = updatesByWorkItem.get(update.workItemId);
        if (workItemUpdates) {
          workItemUpdates.push(update);
        }
      });

      return workItemIds.map((id) => updatesByWorkItem.get(id) || []);
    }
  );
};

/**
 * DataLoader for batching Artifacts by WorkItem ID.
 */
export const createArtifactsLoader = (): DataLoader<string, Artifact[]> => {
  return new DataLoader<string, Artifact[]>(
    async (workItemIds: readonly string[]) => {
      const artifactRepository = AppDataSource.getRepository(Artifact);

      const artifacts = await artifactRepository.find({
        where: { workItemId: In([...workItemIds]) },
        order: { lastActivityAt: 'DESC' },
      });

      // Group artifacts by workItemId
      const artifactsByWorkItem = new Map<string, Artifact[]>();
      workItemIds.forEach((id) => artifactsByWorkItem.set(id, []));

      artifacts.forEach((artifact) => {
        const workItemArtifacts = artifactsByWorkItem.get(artifact.workItemId);
        if (workItemArtifacts) {
          workItemArtifacts.push(artifact);
        }
      });

      return workItemIds.map((id) => artifactsByWorkItem.get(id) || []);
    }
  );
};
