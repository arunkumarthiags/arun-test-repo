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
import { Priority, WorkStatus, HealthStatus, IArtifact } from '@wt-ros/common';
import { registerEnumType } from 'type-graphql';
import GraphQLJSON from 'graphql-type-json';
import { User } from './User.entity';
import { Team } from './Team.entity';
import { Group } from './Group.entity';
import { WorkUpdate } from './WorkUpdate.entity';
import { Artifact } from './Artifact.entity';

// Register enums for GraphQL
registerEnumType(Priority, {
  name: 'Priority',
  description: 'Priority level (P0 = highest)',
});

registerEnumType(WorkStatus, {
  name: 'WorkStatus',
  description: 'Current status of a work item',
});

registerEnumType(HealthStatus, {
  name: 'HealthStatus',
  description: 'Health status of a work item',
});

/**
 * WorkItem Entity
 * The core entity representing a piece of work in the tracking system.
 */
@ObjectType()
@Entity('work_items')
@Index(['groupId', 'priority', 'targetDate']) // Composite index for grid queries
@Index(['driId'])
@Index(['teamId'])
@Index(['groupId'])
@Index(['status'])
@Index(['health'])
@Index(['parentWorkItemId'])
@Index(['lastActivityAt'])
@Index(['stale'])
@Index(['atRisk'])
@Index(['needsHelp'])
export class WorkItem {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // Ownership
  @Field(() => ID)
  @Column({ type: 'uuid' })
  driId!: string;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  teamId!: string | null;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  groupId!: string;

  // Dates
  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  targetDate!: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  originalTargetDate!: Date | null;

  // Status & Priority
  @Field(() => Priority)
  @Column({
    type: 'enum',
    enum: Priority,
    default: Priority.P2,
  })
  priority!: Priority;

  @Field(() => WorkStatus)
  @Column({
    type: 'enum',
    enum: WorkStatus,
    default: WorkStatus.NOT_STARTED,
  })
  status!: WorkStatus;

  @Field(() => HealthStatus)
  @Column({
    type: 'enum',
    enum: HealthStatus,
    default: HealthStatus.UNKNOWN,
  })
  health!: HealthStatus;

  // Flags
  @Field()
  @Column({ type: 'boolean', default: false })
  needsHelp!: boolean;

  @Field()
  @Column({ type: 'boolean', default: false })
  atRisk!: boolean;

  @Field()
  @Column({ type: 'boolean', default: false })
  stale!: boolean;

  // JSONB artifacts (denormalized for quick access)
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true, default: [] })
  artifacts!: IArtifact[];

  // Parent/Child relationship
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  parentWorkItemId!: string | null;

  // AI-generated fields
  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  aiSuggestedUpdate!: string | null;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  driftScore!: number | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastActivityAt!: Date | null;

  // Timestamps
  @Field()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  // Relations - loaded via DataLoader
  @Field(() => User)
  @ManyToOne(() => User, (user) => user.workItems)
  @JoinColumn({ name: 'driId' })
  dri!: User;

  @Field(() => Team, { nullable: true })
  @ManyToOne(() => Team, (team) => team.workItems, { nullable: true })
  @JoinColumn({ name: 'teamId' })
  team!: Team | null;

  @Field(() => Group)
  @ManyToOne(() => Group, (group) => group.workItems)
  @JoinColumn({ name: 'groupId' })
  group!: Group;

  @Field(() => WorkItem, { nullable: true })
  @ManyToOne(() => WorkItem, (workItem) => workItem.childWorkItems, {
    nullable: true,
  })
  @JoinColumn({ name: 'parentWorkItemId' })
  parentWorkItem!: WorkItem | null;

  @Field(() => [WorkItem])
  @OneToMany(() => WorkItem, (workItem) => workItem.parentWorkItem)
  childWorkItems!: WorkItem[];

  @Field(() => [WorkUpdate])
  @OneToMany(() => WorkUpdate, (update) => update.workItem)
  updates!: WorkUpdate[];

  @OneToMany(() => Artifact, (artifact) => artifact.workItem)
  artifactEntities!: Artifact[];
}
