import { Repository, QueryDeepPartialEntity } from 'typeorm';
import { LineComment } from '../entities/LineComment.entity';
import { AppDataSource } from '../config/data-source';

/**
 * LineComment Repository
 */
export class LineCommentRepository {
  private repository: Repository<LineComment>;

  constructor() {
    this.repository = AppDataSource.getRepository(LineComment);
  }

  /**
   * Get a single comment by ID
   */
  async findById(id: string): Promise<LineComment | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Get all comments for an update
   */
  async findByUpdateId(updateId: string): Promise<LineComment[]> {
    return this.repository.find({
      where: { updateId },
      order: { startOffset: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get unresolved comments for an update
   */
  async findUnresolvedByUpdateId(updateId: string): Promise<LineComment[]> {
    return this.repository.find({
      where: { updateId, resolved: false },
      order: { startOffset: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get comments by author
   */
  async findByAuthorId(authorId: string): Promise<LineComment[]> {
    return this.repository.find({
      where: { authorId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get comments that overlap with a text range
   */
  async findOverlapping(
    updateId: string,
    startOffset: number,
    endOffset: number
  ): Promise<LineComment[]> {
    return this.repository
      .createQueryBuilder('comment')
      .where('comment.updateId = :updateId', { updateId })
      .andWhere('comment.startOffset < :endOffset', { endOffset })
      .andWhere('comment.endOffset > :startOffset', { startOffset })
      .orderBy('comment.startOffset', 'ASC')
      .getMany();
  }

  /**
   * Create a new comment
   */
  async create(data: Partial<LineComment>): Promise<LineComment> {
    const comment = this.repository.create(data);
    return this.repository.save(comment);
  }

  /**
   * Update a comment
   */
  async update(id: string, data: Partial<LineComment>): Promise<LineComment | null> {
    await this.repository.update(id, data as QueryDeepPartialEntity<LineComment>);
    return this.findById(id);
  }

  /**
   * Resolve a comment
   */
  async resolve(id: string): Promise<LineComment | null> {
    return this.update(id, { resolved: true });
  }

  /**
   * Unresolve a comment
   */
  async unresolve(id: string): Promise<LineComment | null> {
    return this.update(id, { resolved: false });
  }

  /**
   * Delete a comment
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Get count of unresolved comments for an update
   */
  async getUnresolvedCount(updateId: string): Promise<number> {
    return this.repository.count({
      where: { updateId, resolved: false },
    });
  }

  /**
   * Resolve all comments for an update
   */
  async resolveAllForUpdate(updateId: string): Promise<void> {
    await this.repository.update(
      { updateId, resolved: false },
      { resolved: true }
    );
  }
}

// Export singleton instance
export const lineCommentRepository = new LineCommentRepository();
