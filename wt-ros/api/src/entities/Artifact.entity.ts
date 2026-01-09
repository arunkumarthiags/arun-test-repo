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
import { ObjectType, Field, ID } from 'type-graphql';
import { ArtifactType } from '@wt-ros/common';
import { registerEnumType } from 'type-graphql';
import { WorkItem } from './WorkItem.entity';
import GraphQLJSON from 'graphql-type-json';

// Register the enum for GraphQL
registerEnumType(ArtifactType, {
  name: 'ArtifactType',
  description: 'Type of artifact connected to a work item',
});

/**
 * Artifact Entity
 * Represents a connected artifact (Jira ticket, GitHub PR, etc.) linked to a WorkItem.
 */
@ObjectType()
@Entity('artifacts')
@Index(['workItemId'])
@Index(['type'])
@Index(['url'], { unique: true })
export class Artifact {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  workItemId!: string;

  @Field(() => ArtifactType)
  @Column({
    type: 'enum',
    enum: ArtifactType,
  })
  type!: ArtifactType;

  @Field()
  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  title!: string | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastActivityAt!: Date | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata!: Record<string, unknown>;

  @Field()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => WorkItem, (workItem) => workItem.artifactEntities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workItemId' })
  workItem!: WorkItem;
}
