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
import type { IGroup } from '@wt-ros/common';
import { WorkItem } from './WorkItem.entity';
import { Team } from './Team.entity';
import { User } from './User.entity';

/**
 * Group Entity
 * Represents an organizational group (e.g., department, division).
 */
@ObjectType()
@Entity('groups')
@Index(['name'], { unique: true })
@Index(['leadId'])
export class Group implements IGroup {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  leadId!: string;

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
  @Field(() => User)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'leadId' })
  lead!: User;

  @OneToMany(() => Team, (team) => team.group)
  teams!: Team[];

  @OneToMany(() => WorkItem, (workItem) => workItem.group)
  workItems!: WorkItem[];
}
