import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Float } from 'type-graphql';
import type { IWorkUpdate } from '@wt-ros/common';
import { User } from './User.entity';
import { WorkItem } from './WorkItem.entity';
import { LineComment } from './LineComment.entity';

/**
 * WorkUpdate Entity
 * Represents a weekly update for a work item.
 */
@ObjectType()
@Entity('work_updates')
@Index(['workItemId'])
@Index(['authorId'])
@Index(['week'])
@Index(['workItemId', 'week'], { unique: true }) // One update per work item per week
@Index(['createdAt'])
@Index(['isAiGenerated'])
export class WorkUpdate implements IWorkUpdate {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  workItemId!: string;

  @Field()
  @Column({ type: 'text' })
  content!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  authorId!: string;

  @Field()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Field()
  @Column({ type: 'varchar', length: 10 }) // Format: "2024-W01"
  week!: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  isAiGenerated!: boolean;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  aiConfidence!: number | null;

  // Relations
  @Field(() => WorkItem)
  @ManyToOne(() => WorkItem, (workItem) => workItem.updates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workItemId' })
  workItem!: WorkItem;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.workUpdates)
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Field(() => [LineComment])
  @OneToMany(() => LineComment, (comment) => comment.update)
  lineComments!: LineComment[];
}
