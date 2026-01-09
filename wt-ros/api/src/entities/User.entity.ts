import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from 'type-graphql';
import type { IUser } from '@wt-ros/common';
import { WorkItem } from './WorkItem.entity';
import { WorkUpdate } from './WorkUpdate.entity';
import { LineComment } from './LineComment.entity';

/**
 * User Entity (Stub)
 * This is a simplified user entity for the work tracking system.
 * In production, this would integrate with your identity provider.
 */
@ObjectType()
@Entity('users')
@Index(['email'], { unique: true })
export class User implements IUser {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  displayName!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Field()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => WorkItem, (workItem) => workItem.dri)
  workItems!: WorkItem[];

  @OneToMany(() => WorkUpdate, (update) => update.author)
  workUpdates!: WorkUpdate[];

  @OneToMany(() => LineComment, (comment) => comment.author)
  lineComments!: LineComment[];
}
