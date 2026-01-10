import { Repository, QueryDeepPartialEntity } from 'typeorm';
import { Artifact } from '../entities/Artifact.entity';
import { AppDataSource } from '../config/data-source';
import { ArtifactType } from '@wt-ros/common';

/**
 * Artifact Repository
 */
export class ArtifactRepository {
  private repository: Repository<Artifact>;

  constructor() {
    this.repository = AppDataSource.getRepository(Artifact);
  }

  /**
   * Get a single artifact by ID
   */
  async findById(id: string): Promise<Artifact | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Get artifact by URL (unique constraint)
   */
  async findByUrl(url: string): Promise<Artifact | null> {
    return this.repository.findOne({ where: { url } });
  }

  /**
   * Get all artifacts for a work item
   */
  async findByWorkItemId(workItemId: string): Promise<Artifact[]> {
    return this.repository.find({
      where: { workItemId },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Get artifacts by type for a work item
   */
  async findByWorkItemAndType(workItemId: string, type: ArtifactType): Promise<Artifact[]> {
    return this.repository.find({
      where: { workItemId, type },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Get all artifacts of a specific type
   */
  async findByType(type: ArtifactType): Promise<Artifact[]> {
    return this.repository.find({
      where: { type },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Get artifacts with no recent activity
   */
  async findStale(thresholdDays: number = 7): Promise<Artifact[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

    return this.repository
      .createQueryBuilder('artifact')
      .where('artifact.lastActivityAt < :threshold', { threshold: thresholdDate })
      .orWhere('artifact.lastActivityAt IS NULL')
      .orderBy('artifact.lastActivityAt', 'ASC', 'NULLS FIRST')
      .getMany();
  }

  /**
   * Create a new artifact
   */
  async create(data: Partial<Artifact>): Promise<Artifact> {
    const artifact = this.repository.create(data);
    return this.repository.save(artifact);
  }

  /**
   * Update an artifact
   */
  async update(id: string, data: Partial<Artifact>): Promise<Artifact | null> {
    await this.repository.update(id, data as QueryDeepPartialEntity<Artifact>);
    return this.findById(id);
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(id: string, activityAt: Date = new Date()): Promise<void> {
    await this.repository.update(id, { lastActivityAt: activityAt });
  }

  /**
   * Update metadata
   */
  async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<Artifact | null> {
    const artifact = await this.findById(id);
    if (!artifact) return null;

    const mergedMetadata = { ...artifact.metadata, ...metadata };
    return this.update(id, { metadata: mergedMetadata });
  }

  /**
   * Delete an artifact
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Delete all artifacts for a work item
   */
  async deleteByWorkItemId(workItemId: string): Promise<number> {
    const result = await this.repository.delete({ workItemId });
    return result.affected ?? 0;
  }

  /**
   * Link an artifact to a work item (create if not exists)
   */
  async linkToWorkItem(
    workItemId: string,
    url: string,
    type: ArtifactType,
    title?: string
  ): Promise<Artifact> {
    // Check if artifact already exists
    let artifact = await this.findByUrl(url);

    if (artifact) {
      // Update the work item association
      artifact = await this.update(artifact.id, { workItemId, title }) as Artifact;
    } else {
      // Create new artifact
      artifact = await this.create({
        workItemId,
        url,
        type,
        title,
      });
    }

    return artifact;
  }
}

// Export singleton instance
export const artifactRepository = new ArtifactRepository();
