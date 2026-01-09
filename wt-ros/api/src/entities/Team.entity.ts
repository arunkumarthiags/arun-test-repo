import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from 'type-graphql';
import type { ITeam } from '@wt-ros/common';
import { WorkItem } from './WorkItem.entity';
import { Group } from './Group.entity';

/**
 * Team Entity
 * Represents a team within an organization group.
 */
@ObjectType()
@Entity('teams')
@Index(['groupId'])
@Index(['name', 'groupId'], { unique: true })
export class Team implements ITeam {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  groupId!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Group, (group) => group.teams)
  @JoinColumn({ name: 'groupId' })
  group!: Group;

  @OneToMany(() => WorkItem, (workItem) => workItem.team)
  workItems!: WorkItem[];
}
