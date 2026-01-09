/**
 * QualityEnforcer - Content quality rules for work items and updates
 *
 * Enforces standards to ensure high-quality status updates
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

export interface QualityViolation {
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
}

export interface QualityResult {
  isValid: boolean;
  violations: QualityViolation[];
  score: number; // 0-100
}

export interface QualityRules {
  minUpdateLength: number;
  maxSimilarityThreshold: number;
  minArtifacts: number;
  requireDateChangeExplanation: boolean;
  requireNeedsHelpActionItems: boolean;
}

// ============================================
// DEFAULT RULES
// ============================================

const DEFAULT_RULES: QualityRules = {
  minUpdateLength: 50,
  maxSimilarityThreshold: 0.8,
  minArtifacts: 1,
  requireDateChangeExplanation: true,
  requireNeedsHelpActionItems: true,
};

// ============================================
// QUALITY ENFORCER
// ============================================

export class QualityEnforcer {
  private rules: QualityRules;

  constructor(rules: Partial<QualityRules> = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
  }

  /**
   * Validate a work update against quality rules
   */
  validateUpdate(
    update: Partial<IWorkUpdate>,
    previousUpdates: IWorkUpdate[] = []
  ): QualityResult {
    const violations: QualityViolation[] = [];

    // Rule 1: Minimum length
    if (!update.content || update.content.length < this.rules.minUpdateLength) {
      violations.push({
        rule: 'MIN_LENGTH',
        message: `Update must be at least ${this.rules.minUpdateLength} characters`,
        severity: 'error',
        field: 'content',
      });
    }

    // Rule 2: Similarity to previous updates
    if (update.content && previousUpdates.length > 0) {
      const lastUpdate = previousUpdates[0];
      const similarity = this.calculateSimilarity(
        update.content,
        lastUpdate.content
      );

      if (similarity > this.rules.maxSimilarityThreshold) {
        violations.push({
          rule: 'SIMILARITY',
          message: `Update is ${Math.round(similarity * 100)}% similar to the previous update. Please provide new information.`,
          severity: 'warning',
          field: 'content',
        });
      }
    }

    // Rule 3: Check for vague language
    const vaguePatterns = [
      /working on it/i,
      /in progress/i,
      /no update/i,
      /same as before/i,
      /nothing new/i,
    ];

    if (update.content) {
      for (const pattern of vaguePatterns) {
        if (pattern.test(update.content) && update.content.length < 100) {
          violations.push({
            rule: 'VAGUE_LANGUAGE',
            message: 'Update appears vague. Please provide specific details.',
            severity: 'warning',
            field: 'content',
          });
          break;
        }
      }
    }

    // Calculate score
    const score = this.calculateScore(update, violations);

    return {
      isValid: !violations.some((v) => v.severity === 'error'),
      violations,
      score,
    };
  }

  /**
   * Validate a work item against quality rules
   */
  validateWorkItem(
    workItem: Partial<IWorkItem>,
    originalWorkItem?: IWorkItem
  ): QualityResult {
    const violations: QualityViolation[] = [];

    // Rule 1: Title quality
    if (!workItem.title || workItem.title.length < 10) {
      violations.push({
        rule: 'TITLE_LENGTH',
        message: 'Title should be at least 10 characters',
        severity: 'error',
        field: 'title',
      });
    }

    // Rule 2: Check for unclear titles
    const unclearPatterns = [
      /^tbd$/i,
      /^todo$/i,
      /^task$/i,
      /^work$/i,
      /^item$/i,
      /^fix/i,
      /^update/i,
    ];

    if (workItem.title) {
      for (const pattern of unclearPatterns) {
        if (pattern.test(workItem.title.trim())) {
          violations.push({
            rule: 'UNCLEAR_TITLE',
            message: 'Title is too generic. Please be more specific.',
            severity: 'warning',
            field: 'title',
          });
          break;
        }
      }
    }

    // Rule 3: Minimum artifacts
    const artifactCount = workItem.artifacts?.length ?? 0;
    if (artifactCount < this.rules.minArtifacts) {
      violations.push({
        rule: 'MIN_ARTIFACTS',
        message: `Work item should have at least ${this.rules.minArtifacts} linked artifact(s)`,
        severity: 'warning',
        field: 'artifacts',
      });
    }

    // Rule 4: Date change explanation
    if (
      this.rules.requireDateChangeExplanation &&
      originalWorkItem &&
      workItem.targetDate &&
      originalWorkItem.targetDate
    ) {
      const newDate = new Date(workItem.targetDate).getTime();
      const oldDate = new Date(originalWorkItem.targetDate).getTime();

      if (newDate !== oldDate) {
        // In a real implementation, we'd check for a comment/explanation
        violations.push({
          rule: 'DATE_CHANGE_EXPLANATION',
          message: 'Target date changes should include an explanation',
          severity: 'info',
        });
      }
    }

    // Rule 5: Needs Help requires action items
    if (this.rules.requireNeedsHelpActionItems && workItem.needsHelp) {
      if (!workItem.description || !workItem.description.includes('help')) {
        violations.push({
          rule: 'NEEDS_HELP_DETAILS',
          message: 'Items flagged as "Needs Help" should include specific asks in the description',
          severity: 'warning',
          field: 'description',
        });
      }
    }

    // Rule 6: Health status consistency
    if (workItem.status === WorkStatus.BLOCKED && workItem.health === HealthStatus.GREEN) {
      violations.push({
        rule: 'HEALTH_STATUS_CONSISTENCY',
        message: 'Blocked items should not have "Green" health status',
        severity: 'warning',
        field: 'health',
      });
    }

    // Calculate score
    const score = this.calculateScore(workItem, violations);

    return {
      isValid: !violations.some((v) => v.severity === 'error'),
      violations,
      score,
    };
  }

  /**
   * Check if repeated updates indicate staleness
   */
  checkRepeatedUpdates(updates: IWorkUpdate[]): QualityViolation | null {
    if (updates.length < 3) return null;

    const recentUpdates = updates.slice(0, 3);
    let similarCount = 0;

    for (let i = 0; i < recentUpdates.length - 1; i++) {
      const similarity = this.calculateSimilarity(
        recentUpdates[i].content,
        recentUpdates[i + 1].content
      );
      if (similarity > this.rules.maxSimilarityThreshold) {
        similarCount++;
      }
    }

    if (similarCount >= 2) {
      return {
        rule: 'REPEATED_UPDATES',
        message: 'Last 3 updates are very similar. This may indicate stalled progress.',
        severity: 'warning',
      };
    }

    return null;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Calculate text similarity using Jaccard index
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate quality score based on violations
   */
  private calculateScore(
    item: Partial<IWorkItem | IWorkUpdate>,
    violations: QualityViolation[]
  ): number {
    let score = 100;

    for (const violation of violations) {
      switch (violation.severity) {
        case 'error':
          score -= 30;
          break;
        case 'warning':
          score -= 15;
          break;
        case 'info':
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }
}

export default QualityEnforcer;
