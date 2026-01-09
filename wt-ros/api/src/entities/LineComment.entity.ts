import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from 'type-graphql';
import type { ILineComment } from '@wt-ros/common';
import { User } from './User.entity';
import { WorkUpdate } from './WorkUpdate.entity';

/**
 * LineComment Entity
 * Represents a comment on a specific text range within a WorkUpdate.
 */
@ObjectType()
@Entity('line_comments')
@Index(['updateId'])
@Index(['authorId'])
@Index(['resolved'])
@Index(['createdAt'])
export class LineComment implements ILineComment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  updateId!: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  startOffset!: number;

  @Field(() => Int)
  @Column({ type: 'int' })
  endOffset!: number;

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
  @Column({ type: 'boolean', default: false })
  resolved!: boolean;

  @Field(() => [String])
  @Column({ type: 'uuid', array: true, default: [] })
  mentionIds!: string[];

  // Relations
  @ManyToOne(() => WorkUpdate, (update) => update.lineComments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'updateId' })
  update!: WorkUpdate;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.lineComments)
  @JoinColumn({ name: 'authorId' })
  author!: User;

  // Resolved mentions (loaded via DataLoader)
  @Field(() => [User])
  mentions!: User[];
}
