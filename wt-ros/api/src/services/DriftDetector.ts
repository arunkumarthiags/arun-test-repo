/**
 * DriftDetector - Main drift calculation engine
 * Agent-Strategist: Innovation Auditor
 *
 * Calculates drift scores by comparing strategy docs and code changes
 * to identify when stated goals diverge from actual implementation progress.
 */

import {
  DriftScore,
  DriftFactors,
  IWorkItem,
  IWorkUpdate,
  IActivity,
  WorkStatus,
  HealthStatus,
} from '@wt-ros/common';

/**
 * Configuration for the drift detector
 */
export interface DriftDetectorConfig {
  /** Threshold above which items are flagged (0-1) */
  alertThreshold: number;
  /** Weight for document update frequency factor (0-1) */
  docUpdateFrequencyWeight: number;
  /** Weight for code activity alignment factor (0-1) */
  codeActivityAlignmentWeight: number;
  /** Weight for status accuracy factor (0-1) */
  statusAccuracyWeight: number;
  /** Weight for date stability factor (0-1) */
  dateStabilityWeight: number;
  /** Days without activity before item is considered stale */
  staleThresholdDays: number;
  /** Number of days to analyze for update frequency */
  updateFrequencyDays: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_DRIFT_CONFIG: DriftDetectorConfig = {
  alertThreshold: 0.7,
  docUpdateFrequencyWeight: 0.25,
  codeActivityAlignmentWeight: 0.25,
  statusAccuracyWeight: 0.25,
  dateStabilityWeight: 0.25,
  staleThresholdDays: 7,
  updateFrequencyDays: 30,
};

/**
 * Repository interface for work items
 */
export interface IWorkItemRepository {
  findById(id: string): Promise<IWorkItem | null>;
  getDateHistory(workItemId: string): Promise<Date[]>;
}

/**
 * Repository interface for work updates
 */
export interface IWorkUpdateRepository {
  findByWorkItemId(workItemId: string, limit?: number): Promise<IWorkUpdate[]>;
  getUpdateFrequency(workItemId: string, dayRange: number): Promise<number>;
}

/**
 * Repository interface for activities
 */
export interface IActivityRepository {
  findByWorkItemId(workItemId: string, limit?: number): Promise<IActivity[]>;
  getActivityCount(workItemId: string, dayRange: number): Promise<number>;
}

/**
 * DriftDetector calculates drift scores to detect divergence between
 * strategy documentation and actual code/implementation activity.
 */
export class DriftDetector {
  private readonly config: DriftDetectorConfig;
  private readonly workItemRepo: IWorkItemRepository;
  private readonly workUpdateRepo: IWorkUpdateRepository;
  private readonly activityRepo: IActivityRepository;

  constructor(
    workItemRepo: IWorkItemRepository,
    workUpdateRepo: IWorkUpdateRepository,
    activityRepo: IActivityRepository,
    config: Partial<DriftDetectorConfig> = {}
  ) {
    this.workItemRepo = workItemRepo;
    this.workUpdateRepo = workUpdateRepo;
    this.activityRepo = activityRepo;
    this.config = { ...DEFAULT_DRIFT_CONFIG, ...config };

    // Validate weights sum to 1.0
    const weightSum =
      this.config.docUpdateFrequencyWeight +
      this.config.codeActivityAlignmentWeight +
      this.config.statusAccuracyWeight +
      this.config.dateStabilityWeight;

    if (Math.abs(weightSum - 1.0) > 0.001) {
      console.warn(
        `DriftDetector: Factor weights sum to ${weightSum}, expected 1.0. Scores may be skewed.`
      );
    }
  }

  /**
   * Calculate the drift score for a single work item
   */
  async calculateDrift(workItemId: string): Promise<DriftScore> {
    const workItem = await this.workItemRepo.findById(workItemId);

    if (!workItem) {
      throw new Error(`Work item not found: ${workItemId}`);
    }

    const [dateHistory, updates, activities, updateFrequency, activityCount] =
      await Promise.all([
        this.workItemRepo.getDateHistory(workItemId),
        this.workUpdateRepo.findByWorkItemId(workItemId, 10),
        this.activityRepo.findByWorkItemId(workItemId, 20),
        this.workUpdateRepo.getUpdateFrequency(
          workItemId,
          this.config.updateFrequencyDays
        ),
        this.activityRepo.getActivityCount(
          workItemId,
          this.config.updateFrequencyDays
        ),
      ]);

    const factors = this.calculateFactors(
      workItem,
      dateHistory,
      updates,
      activities,
      updateFrequency,
      activityCount
    );

    // Calculate weighted drift score (inverted - high factor values mean low drift)
    const rawScore =
      (1 - factors.docUpdateFrequency) * this.config.docUpdateFrequencyWeight +
      (1 - factors.codeActivityAlignment) * this.config.codeActivityAlignmentWeight +
      (1 - factors.statusAccuracy) * this.config.statusAccuracyWeight +
      (1 - factors.dateStability) * this.config.dateStabilityWeight;

    // Clamp score to 0-1 range
    const score = Math.max(0, Math.min(1, rawScore));

    return {
      workItemId,
      score,
      factors,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate individual drift factors
   */
  private calculateFactors(
    workItem: IWorkItem,
    dateHistory: Date[],
    updates: IWorkUpdate[],
    activities: IActivity[],
    updateFrequency: number,
    activityCount: number
  ): DriftFactors {
    return {
      docUpdateFrequency: this.calculateDocUpdateFrequency(
        updates,
        updateFrequency
      ),
      codeActivityAlignment: this.calculateCodeActivityAlignment(
        workItem,
        activities,
        activityCount
      ),
      statusAccuracy: this.calculateStatusAccuracy(
        workItem,
        activities,
        activityCount
      ),
      dateStability: this.calculateDateStability(workItem, dateHistory),
    };
  }

  /**
   * Calculate document update frequency factor (0-1)
   * Higher score = more frequent updates = less drift
   */
  private calculateDocUpdateFrequency(
    updates: IWorkUpdate[],
    updateFrequency: number
  ): number {
    if (updates.length === 0) {
      return 0;
    }

    const mostRecentUpdate = updates[0];
    const daysSinceUpdate = this.daysSince(mostRecentUpdate.createdAt);

    // Score based on recency of last update
    let recencyScore: number;
    if (daysSinceUpdate <= 7) {
      recencyScore = 1.0;
    } else if (daysSinceUpdate <= 14) {
      recencyScore = 0.7;
    } else if (daysSinceUpdate <= 21) {
      recencyScore = 0.4;
    } else {
      recencyScore = Math.max(0, 0.2 - (daysSinceUpdate - 21) * 0.01);
    }

    // Score based on update frequency (target: ~4 updates per month)
    const frequencyScore = Math.min(1, updateFrequency / 4);

    // Combine scores (60% recency, 40% frequency)
    return recencyScore * 0.6 + frequencyScore * 0.4;
  }

  /**
   * Calculate code activity alignment factor (0-1)
   * Higher score = activity matches stated status = less drift
   */
  private calculateCodeActivityAlignment(
    workItem: IWorkItem,
    activities: IActivity[],
    activityCount: number
  ): number {
    const isActive = workItem.status === WorkStatus.IN_PROGRESS;
    const hasRecentActivity = activities.length > 0 && activityCount > 0;

    if (!isActive) {
      // For non-active items, we don't expect activity
      if (workItem.status === WorkStatus.COMPLETE) {
        return 1.0;
      }
      if (workItem.status === WorkStatus.NOT_STARTED) {
        // No activity expected for not started items
        return activityCount === 0 ? 1.0 : 0.8;
      }
      if (workItem.status === WorkStatus.BLOCKED) {
        // Some activity might be expected for blocked items (discussions, attempts)
        return 0.7;
      }
      // CANCELLED status
      return 1.0;
    }

    // For IN_PROGRESS items, we expect activity
    if (!hasRecentActivity) {
      return 0.2;
    }

    // Check if activity is recent
    const mostRecentActivity = activities[0];
    const daysSinceActivity = this.daysSince(mostRecentActivity.occurredAt);

    if (daysSinceActivity <= 3) {
      return 1.0;
    } else if (daysSinceActivity <= 7) {
      return 0.8;
    } else if (daysSinceActivity <= 14) {
      return 0.5;
    } else {
      return Math.max(0.1, 0.3 - (daysSinceActivity - 14) * 0.02);
    }
  }

  /**
   * Calculate status accuracy factor (0-1)
   * Higher score = reported status matches reality = less drift
   */
  private calculateStatusAccuracy(
    workItem: IWorkItem,
    activities: IActivity[],
    activityCount: number
  ): number {
    const { status, health, lastActivityAt } = workItem;

    // Check for "green status with no activity" pattern
    if (health === HealthStatus.GREEN && status === WorkStatus.IN_PROGRESS) {
      const daysSinceActivity = lastActivityAt
        ? this.daysSince(lastActivityAt)
        : this.config.staleThresholdDays + 1;

      if (daysSinceActivity > this.config.staleThresholdDays) {
        // Green status but stale - low accuracy
        return 0.2;
      }

      if (activityCount === 0) {
        // Green + in progress but no activity
        return 0.3;
      }
    }

    // Check for BLOCKED status with no explanation
    if (status === WorkStatus.BLOCKED && activities.length === 0) {
      return 0.5;
    }

    // Check for health/status misalignment
    if (health === HealthStatus.RED && status === WorkStatus.IN_PROGRESS) {
      // Red health but still "in progress" might be accurate if there are blockers
      const hasRecentActivity =
        activities.length > 0 && this.daysSince(activities[0].occurredAt) <= 7;
      return hasRecentActivity ? 0.7 : 0.4;
    }

    // Default: assume status is accurate
    return 1.0;
  }

  /**
   * Calculate date stability factor (0-1)
   * Higher score = fewer date changes = less drift
   */
  private calculateDateStability(
    workItem: IWorkItem,
    dateHistory: Date[]
  ): number {
    // No target date set - neutral score
    if (!workItem.targetDate && !workItem.originalTargetDate) {
      return 1.0;
    }

    // No changes to date
    if (dateHistory.length <= 1) {
      return 1.0;
    }

    // Calculate penalty based on number of date changes
    const changeCount = dateHistory.length - 1;

    if (changeCount === 1) {
      return 0.8;
    } else if (changeCount === 2) {
      return 0.5;
    } else if (changeCount === 3) {
      return 0.3;
    } else {
      // More than 3 changes - significant instability
      return Math.max(0, 0.2 - (changeCount - 3) * 0.05);
    }
  }

  /**
   * Check if a drift score should trigger an alert
   */
  shouldAlert(driftScore: DriftScore): boolean {
    return driftScore.score >= this.config.alertThreshold;
  }

  /**
   * Calculate drift scores for multiple work items
   */
  async calculateBatchDrift(workItemIds: string[]): Promise<DriftScore[]> {
    const results: DriftScore[] = [];

    for (const id of workItemIds) {
      try {
        const score = await this.calculateDrift(id);
        results.push(score);
      } catch (error) {
        // Skip items that don't exist or have errors
        console.warn(`Failed to calculate drift for ${id}:`, error);
      }
    }

    return results;
  }

  /**
   * Get all work items with drift above threshold
   */
  async getDriftingWorkItems(workItemIds: string[]): Promise<DriftScore[]> {
    const scores = await this.calculateBatchDrift(workItemIds);
    return scores.filter((score) => this.shouldAlert(score));
  }

  /**
   * Get a human-readable drift summary
   */
  getDriftSummary(driftScore: DriftScore): string {
    const { score, factors } = driftScore;
    const severity =
      score >= 0.9 ? 'Critical' : score >= 0.7 ? 'High' : score >= 0.5 ? 'Medium' : 'Low';

    const issues: string[] = [];

    if (factors.docUpdateFrequency < 0.5) {
      issues.push('infrequent documentation updates');
    }
    if (factors.codeActivityAlignment < 0.5) {
      issues.push('code activity does not match stated progress');
    }
    if (factors.statusAccuracy < 0.5) {
      issues.push('reported status may not reflect actual state');
    }
    if (factors.dateStability < 0.5) {
      issues.push('unstable target dates');
    }

    if (issues.length === 0) {
      return `${severity} drift (${(score * 100).toFixed(0)}%): No specific issues identified.`;
    }

    return `${severity} drift (${(score * 100).toFixed(0)}%): ${issues.join(', ')}.`;
  }

  /**
   * Get recommended actions based on drift factors
   */
  getRecommendedActions(driftScore: DriftScore): string[] {
    const { factors } = driftScore;
    const actions: string[] = [];

    if (factors.docUpdateFrequency < 0.5) {
      actions.push('Add a status update to document current progress');
    }
    if (factors.codeActivityAlignment < 0.5) {
      actions.push('Review linked artifacts for recent activity');
      actions.push('Consider updating status if work is blocked or paused');
    }
    if (factors.statusAccuracy < 0.5) {
      actions.push('Verify that health status reflects actual project state');
      actions.push('Add explanation if status differs from activity level');
    }
    if (factors.dateStability < 0.5) {
      actions.push('Review timeline and set a more realistic target date');
      actions.push('Document reasons for date changes');
    }

    return actions;
  }

  /**
   * Calculate days since a given date
   */
  private daysSince(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export default DriftDetector;
