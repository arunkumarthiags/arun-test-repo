import { Repository, QueryDeepPartialEntity } from 'typeorm';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { AppDataSource } from '../config/data-source';

/**
 * Get current ISO week string in format "YYYY-WXX"
 */
export const getCurrentWeek = (): string => {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

/**
 * WorkUpdate Repository
 */
export class WorkUpdateRepository {
  private repository: Repository<WorkUpdate>;

  constructor() {
    this.repository = AppDataSource.getRepository(WorkUpdate);
  }

  /**
   * Get a single work update by ID
   */
  async findById(id: string): Promise<WorkUpdate | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Get all updates for a work item
   */
  async findByWorkItemId(workItemId: string): Promise<WorkUpdate[]> {
    return this.repository.find({
      where: { workItemId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get update for a specific work item and week
   */
  async findByWorkItemAndWeek(workItemId: string, week: string): Promise<WorkUpdate | null> {
    return this.repository.findOne({
      where: { workItemId, week },
    });
  }

  /**
   * Get latest update for a work item
   */
  async findLatestByWorkItemId(workItemId: string): Promise<WorkUpdate | null> {
    return this.repository.findOne({
      where: { workItemId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all updates for a specific week
   */
  async findByWeek(week: string): Promise<WorkUpdate[]> {
    return this.repository.find({
      where: { week },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get AI-generated updates for review
   */
  async findAiGeneratedUpdates(): Promise<WorkUpdate[]> {
    return this.repository.find({
      where: { isAiGenerated: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a new work update
   */
  async create(data: Partial<WorkUpdate>): Promise<WorkUpdate> {
    const week = data.week || getCurrentWeek();
    const workUpdate = this.repository.create({
      ...data,
      week,
    });
    return this.repository.save(workUpdate);
  }

  /**
   * Update a work update
   */
  async update(id: string, data: Partial<WorkUpdate>): Promise<WorkUpdate | null> {
    await this.repository.update(id, data as QueryDeepPartialEntity<WorkUpdate>);
    return this.findById(id);
  }

  /**
   * Delete a work update
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Check similarity between updates (for repeated update detection)
   */
  async checkSimilarity(
    workItemId: string,
    newContent: string,
    lastN: number = 3
  ): Promise<number> {
    const recentUpdates = await this.repository.find({
      where: { workItemId },
      order: { createdAt: 'DESC' },
      take: lastN,
    });

    if (recentUpdates.length === 0) return 0;

    // Simple Jaccard similarity calculation
    const newWords = new Set(newContent.toLowerCase().split(/\s+/));

    let maxSimilarity = 0;
    for (const update of recentUpdates) {
      const existingWords = new Set(update.content.toLowerCase().split(/\s+/));
      const intersection = new Set([...newWords].filter(x => existingWords.has(x)));
      const union = new Set([...newWords, ...existingWords]);
      const similarity = intersection.size / union.size;
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }
}

// Export singleton instance
export const workUpdateRepository = new WorkUpdateRepository();
