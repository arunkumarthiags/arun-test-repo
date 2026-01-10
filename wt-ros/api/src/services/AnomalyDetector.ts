/**
 * AnomalyDetector - Pattern-based flagging for work item anomalies
 *
 * Detects patterns that indicate potential issues:
 * - Repeated "green" status with no activity
 * - Status downgrade without explanation
 * - Orphaned work items (no parent, no artifacts)
 * - Stale items with upcoming target dates
 */
import {
  IWorkItem,
  IWorkUpdate,
  WorkStatus,
  HealthStatus,
} from '@wt-ros/common';

// ============================================
// TYPES
// ============================================

export interface Anomaly {
  type: AnomalyType;
  workItemId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}

export type AnomalyType =
  | 'GREEN_NO_ACTIVITY'
  | 'STATUS_DOWNGRADE'
  | 'ORPHANED'
  | 'STALE_URGENT'
  | 'DATE_APPROACHING'
  | 'REPEATED_STATUS'
  | 'MISSING_ARTIFACTS'
  | 'BLOCKED_TOO_LONG'
  | 'HEALTH_MISMATCH';

export interface AnomalyDetectorConfig {
  greenNoActivityDays: number;
  staleUrgentDays: number;
  dateApproachingDays: number;
  blockedTooLongDays: number;
}

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_CONFIG: AnomalyDetectorConfig = {
  greenNoActivityDays: 7,
  staleUrgentDays: 14,
  dateApproachingDays: 7,
  blockedTooLongDays: 5,
};

// ============================================
// ANOMALY DETECTOR
// ============================================

export class AnomalyDetector {
  private config: AnomalyDetectorConfig;

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect all anomalies for a work item
   */
  detectAnomalies(
    workItem: IWorkItem,
    updates: IWorkUpdate[] = [],
    historicalHealthStatuses: HealthStatus[] = []
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check each anomaly type
    const greenNoActivity = this.checkGreenNoActivity(workItem);
    if (greenNoActivity) anomalies.push(greenNoActivity);

    const statusDowngrade = this.checkStatusDowngrade(
      workItem,
      historicalHealthStatuses
    );
    if (statusDowngrade) anomalies.push(statusDowngrade);

    const orphaned = this.checkOrphaned(workItem);
    if (orphaned) anomalies.push(orphaned);

    const staleUrgent = this.checkStaleUrgent(workItem);
    if (staleUrgent) anomalies.push(staleUrgent);

    const dateApproaching = this.checkDateApproaching(workItem);
    if (dateApproaching) anomalies.push(dateApproaching);

    const repeatedStatus = this.checkRepeatedStatus(updates);
    if (repeatedStatus) {
      anomalies.push({ ...repeatedStatus, workItemId: workItem.id });
    }

    const blockedTooLong = this.checkBlockedTooLong(workItem);
    if (blockedTooLong) anomalies.push(blockedTooLong);

    const healthMismatch = this.checkHealthMismatch(workItem);
    if (healthMismatch) anomalies.push(healthMismatch);

    return anomalies;
  }

  /**
   * Batch detect anomalies across multiple work items
   */
  batchDetect(
    workItems: IWorkItem[],
    updatesMap: Map<string, IWorkUpdate[]> = new Map()
  ): Map<string, Anomaly[]> {
    const results = new Map<string, Anomaly[]>();

    for (const item of workItems) {
      const updates = updatesMap.get(item.id) || [];
      const anomalies = this.detectAnomalies(item, updates);
      if (anomalies.length > 0) {
        results.set(item.id, anomalies);
      }
    }

    return results;
  }

  /**
   * Get items requiring immediate attention
   */
  getCriticalItems(
    workItems: IWorkItem[],
    updatesMap: Map<string, IWorkUpdate[]> = new Map()
  ): IWorkItem[] {
    const critical: IWorkItem[] = [];

    for (const item of workItems) {
      const updates = updatesMap.get(item.id) || [];
      const anomalies = this.detectAnomalies(item, updates);

      if (anomalies.some((a) => a.severity === 'critical' || a.severity === 'high')) {
        critical.push(item);
      }
    }

    return critical;
  }

  // ============================================
  // ANOMALY CHECKS
  // ============================================

  /**
   * Check for "green" health with no recent activity
   */
  private checkGreenNoActivity(workItem: IWorkItem): Anomaly | null {
    if (workItem.health !== HealthStatus.GREEN) return null;

    const daysSinceActivity = this.daysSince(workItem.lastActivityAt);

    if (daysSinceActivity > this.config.greenNoActivityDays) {
      return {
        type: 'GREEN_NO_ACTIVITY',
        workItemId: workItem.id,
        message: `Item marked as "Green" but no activity for ${daysSinceActivity} days`,
        severity: daysSinceActivity > 14 ? 'high' : 'medium',
        detectedAt: new Date(),
        metadata: { daysSinceActivity },
      };
    }

    return null;
  }

  /**
   * Check for status downgrade without explanation
   */
  private checkStatusDowngrade(
    workItem: IWorkItem,
    historicalStatuses: HealthStatus[]
  ): Anomaly | null {
    if (historicalStatuses.length < 2) return null;

    const statusOrder: Record<HealthStatus, number> = {
      GREEN: 3,
      YELLOW: 2,
      RED: 1,
      UNKNOWN: 0,
    };

    const currentOrder = statusOrder[workItem.health];
    const previousOrder = statusOrder[historicalStatuses[1]];

    if (currentOrder < previousOrder) {
      return {
        type: 'STATUS_DOWNGRADE',
        workItemId: workItem.id,
        message: `Health status downgraded from ${historicalStatuses[1]} to ${workItem.health}`,
        severity: workItem.health === HealthStatus.RED ? 'high' : 'medium',
        detectedAt: new Date(),
        metadata: {
          previousStatus: historicalStatuses[1],
          currentStatus: workItem.health,
        },
      };
    }

    return null;
  }

  /**
   * Check for orphaned work items (no parent, no artifacts)
   */
  private checkOrphaned(workItem: IWorkItem): Anomaly | null {
    const hasParent = Boolean(workItem.parentWorkItemId);
    const hasArtifacts = workItem.artifacts && workItem.artifacts.length > 0;

    if (!hasParent && !hasArtifacts) {
      return {
        type: 'ORPHANED',
        workItemId: workItem.id,
        message: 'Work item has no parent and no linked artifacts',
        severity: 'low',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for stale items that are marked as urgent or have upcoming dates
   */
  private checkStaleUrgent(workItem: IWorkItem): Anomaly | null {
    if (!workItem.stale) return null;
    if (workItem.priority !== 'P0' && workItem.priority !== 'P1') return null;

    return {
      type: 'STALE_URGENT',
      workItemId: workItem.id,
      message: `High-priority (${workItem.priority}) item is marked as stale`,
      severity: workItem.priority === 'P0' ? 'critical' : 'high',
      detectedAt: new Date(),
      metadata: { priority: workItem.priority },
    };
  }

  /**
   * Check for items with approaching target dates
   */
  private checkDateApproaching(workItem: IWorkItem): Anomaly | null {
    if (!workItem.targetDate) return null;
    if (workItem.status === WorkStatus.COMPLETE) return null;

    const daysUntilTarget = this.daysUntil(workItem.targetDate);

    if (daysUntilTarget < 0) {
      return {
        type: 'DATE_APPROACHING',
        workItemId: workItem.id,
        message: `Target date is ${Math.abs(daysUntilTarget)} days overdue`,
        severity: 'critical',
        detectedAt: new Date(),
        metadata: { daysOverdue: Math.abs(daysUntilTarget) },
      };
    }

    if (daysUntilTarget <= this.config.dateApproachingDays) {
      const daysSinceActivity = this.daysSince(workItem.lastActivityAt);

      if (daysSinceActivity > 3) {
        return {
          type: 'DATE_APPROACHING',
          workItemId: workItem.id,
          message: `Target date in ${daysUntilTarget} days but no recent activity`,
          severity: daysUntilTarget <= 3 ? 'high' : 'medium',
          detectedAt: new Date(),
          metadata: { daysUntilTarget, daysSinceActivity },
        };
      }
    }

    return null;
  }

  /**
   * Check for repeated identical status in updates
   */
  private checkRepeatedStatus(updates: IWorkUpdate[]): Omit<Anomaly, 'workItemId'> | null {
    if (updates.length < 3) return null;

    // Check if last 3 updates are very similar
    const recentUpdates = updates.slice(0, 3);
    let similarCount = 0;

    for (let i = 0; i < recentUpdates.length - 1; i++) {
      const similarity = this.calculateSimilarity(
        recentUpdates[i].content,
        recentUpdates[i + 1].content
      );
      if (similarity > 0.8) {
        similarCount++;
      }
    }

    if (similarCount >= 2) {
      return {
        type: 'REPEATED_STATUS',
        message: 'Last 3 updates are nearly identical - may indicate stalled progress',
        severity: 'medium',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for items blocked for too long
   */
  private checkBlockedTooLong(workItem: IWorkItem): Anomaly | null {
    if (workItem.status !== WorkStatus.BLOCKED) return null;

    const daysSinceUpdate = this.daysSince(workItem.updatedAt);

    if (daysSinceUpdate > this.config.blockedTooLongDays) {
      return {
        type: 'BLOCKED_TOO_LONG',
        workItemId: workItem.id,
        message: `Item has been blocked for ${daysSinceUpdate} days`,
        severity: daysSinceUpdate > 10 ? 'high' : 'medium',
        detectedAt: new Date(),
        metadata: { daysBlocked: daysSinceUpdate },
      };
    }

    return null;
  }

  /**
   * Check for health status that doesn't match other indicators
   */
  private checkHealthMismatch(workItem: IWorkItem): Anomaly | null {
    // Green but has risk flags
    if (
      workItem.health === HealthStatus.GREEN &&
      (workItem.atRisk || workItem.needsHelp || workItem.stale)
    ) {
      const flags: string[] = [];
      if (workItem.atRisk) flags.push('at-risk');
      if (workItem.needsHelp) flags.push('needs-help');
      if (workItem.stale) flags.push('stale');

      return {
        type: 'HEALTH_MISMATCH',
        workItemId: workItem.id,
        message: `Item marked "Green" but has warning flags: ${flags.join(', ')}`,
        severity: 'medium',
        detectedAt: new Date(),
        metadata: { flags },
      };
    }

    // Red but marked as complete
    if (
      workItem.health === HealthStatus.RED &&
      workItem.status === WorkStatus.COMPLETE
    ) {
      return {
        type: 'HEALTH_MISMATCH',
        workItemId: workItem.id,
        message: 'Item marked as "Complete" but health is "Red"',
        severity: 'medium',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  // ============================================
  // HELPERS
  // ============================================

  private daysSince(date: Date | null | undefined): number {
    if (!date) return 999;
    const d = new Date(date);
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  private daysUntil(date: Date | string): number {
    const d = new Date(date);
    return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}

export default AnomalyDetector;
