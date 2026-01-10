/**
 * InsightsService - AI-powered executive insights generation
 *
 * Provides aggregated metrics, risk analysis, and natural language summaries
 * for executive dashboards. Designed to surface actionable insights from
 * work item data.
 *
 * Future enhancements will integrate real LLM capabilities for more
 * sophisticated natural language generation.
 */

import {
  IWorkItem,
  WorkStatus,
  HealthStatus,
  Priority,
} from '@wt-ros/common';

// ============================================
// TYPES
// ============================================

/**
 * Aggregated metrics for work items
 */
export interface WorkItemMetrics {
  /** Total number of work items */
  total: number;
  /** Breakdown by status */
  byStatus: Record<WorkStatus, number>;
  /** Breakdown by health */
  byHealth: Record<HealthStatus, number>;
  /** Breakdown by priority */
  byPriority: Record<Priority, number>;
  /** Number of items at risk */
  atRisk: number;
  /** Number of items needing help */
  needsHelp: number;
  /** Number of blocked items */
  blocked: number;
  /** Number of stale items */
  stale: number;
  /** Number of overdue items */
  overdue: number;
  /** Completion rate (0-100) */
  completionRate: number;
  /** Health score (0-100) */
  healthScore: number;
}

/**
 * Executive summary with natural language insights
 */
export interface ExecutiveSummary {
  /** AI-generated natural language summary */
  summary: string;
  /** Key highlights (bullet points) */
  highlights: string[];
  /** Computed metrics */
  metrics: WorkItemMetrics;
  /** Items requiring immediate attention */
  attentionItems: AttentionItem[];
  /** Timestamp when summary was generated */
  generatedAt: Date;
}

/**
 * Item requiring executive attention
 */
export interface AttentionItem {
  /** Work item ID */
  id: string;
  /** Work item title */
  title: string;
  /** Reason for attention */
  reason: string;
  /** Urgency level */
  urgency: 'critical' | 'high' | 'medium';
  /** Priority of the work item */
  priority: Priority;
  /** Days overdue (if applicable) */
  daysOverdue?: number;
  /** Team name (if available) */
  teamName?: string;
}

/**
 * Risk analysis result
 */
export interface RiskAnalysis {
  /** Overall risk level */
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  /** Risk score (0-100) */
  riskScore: number;
  /** Items at risk with explanations */
  riskItems: RiskItem[];
  /** Risk trends and patterns */
  patterns: RiskPattern[];
  /** Recommended actions */
  recommendations: string[];
  /** Timestamp when analysis was generated */
  generatedAt: Date;
}

/**
 * Individual item risk assessment
 */
export interface RiskItem {
  /** Work item ID */
  id: string;
  /** Work item title */
  title: string;
  /** Risk factors contributing to risk */
  riskFactors: string[];
  /** Individual risk score (0-100) */
  riskScore: number;
  /** Priority of the work item */
  priority: Priority;
  /** Target date if set */
  targetDate?: Date;
  /** Days until target or days overdue */
  daysToTarget?: number;
}

/**
 * Identified risk pattern
 */
export interface RiskPattern {
  /** Pattern type */
  type: 'team_blocked' | 'date_slippage' | 'health_degradation' | 'stale_high_priority';
  /** Human-readable description */
  description: string;
  /** Affected items count */
  affectedCount: number;
  /** Severity of the pattern */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Weekly digest summary
 */
export interface WeeklyDigest {
  /** Week identifier (e.g., "2024-W01") */
  week: string;
  /** Natural language summary of the week */
  summary: string;
  /** Items completed this week */
  completed: number;
  /** New items created this week */
  newItems: number;
  /** Items that became at risk */
  newAtRisk: number;
  /** Items that became blocked */
  newBlocked: number;
  /** Notable achievements */
  achievements: string[];
  /** Areas of concern */
  concerns: string[];
  /** Week-over-week comparison */
  comparison: WeekComparison;
  /** Timestamp when digest was generated */
  generatedAt: Date;
}

/**
 * Week-over-week comparison metrics
 */
export interface WeekComparison {
  /** Change in completion rate */
  completionRateDelta: number;
  /** Change in health score */
  healthScoreDelta: number;
  /** Change in at-risk count */
  atRiskDelta: number;
  /** Change in blocked count */
  blockedDelta: number;
}

/**
 * Team insights for group-specific analysis
 */
export interface TeamInsights {
  /** Team/Group ID */
  teamId: string;
  /** Team/Group name */
  teamName: string;
  /** Metrics specific to this team */
  metrics: WorkItemMetrics;
  /** Top concerns for this team */
  concerns: string[];
}

// ============================================
// SERVICE
// ============================================

/**
 * InsightsService provides AI-powered executive insights
 */
export class InsightsService {
  /**
   * Generate executive summary from work items
   */
  generateExecutiveSummary(
    workItems: IWorkItem[],
    groupName?: string
  ): ExecutiveSummary {
    const metrics = this.calculateMetrics(workItems);
    const attentionItems = this.identifyAttentionItems(workItems);
    const highlights = this.generateHighlights(metrics, attentionItems, groupName);
    const summary = this.generateNaturalLanguageSummary(metrics, attentionItems, groupName);

    return {
      summary,
      highlights,
      metrics,
      attentionItems,
      generatedAt: new Date(),
    };
  }

  /**
   * Perform risk analysis on work items
   */
  analyzeRisks(workItems: IWorkItem[]): RiskAnalysis {
    const riskItems = this.identifyRiskItems(workItems);
    const patterns = this.detectRiskPatterns(workItems);
    const riskScore = this.calculateOverallRiskScore(riskItems, patterns);
    const overallRisk = this.categorizeRiskLevel(riskScore);
    const recommendations = this.generateRecommendations(riskItems, patterns);

    return {
      overallRisk,
      riskScore,
      riskItems,
      patterns,
      recommendations,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate weekly digest summary
   */
  generateWeeklyDigest(
    currentWeekItems: IWorkItem[],
    previousWeekItems: IWorkItem[]
  ): WeeklyDigest {
    const currentMetrics = this.calculateMetrics(currentWeekItems);
    const previousMetrics = this.calculateMetrics(previousWeekItems);

    const week = this.getCurrentWeekString();
    const comparison = this.compareWeeks(currentMetrics, previousMetrics);
    const achievements = this.identifyAchievements(currentWeekItems, previousWeekItems);
    const concerns = this.identifyConcerns(currentMetrics, comparison);
    const summary = this.generateWeeklySummary(currentMetrics, comparison, achievements, concerns);

    return {
      week,
      summary,
      completed: currentMetrics.byStatus[WorkStatus.COMPLETE] || 0,
      newItems: this.countNewItems(currentWeekItems),
      newAtRisk: this.countNewAtRisk(currentWeekItems, previousWeekItems),
      newBlocked: this.countNewBlocked(currentWeekItems, previousWeekItems),
      achievements,
      concerns,
      comparison,
      generatedAt: new Date(),
    };
  }

  /**
   * Get insights for a specific team/group
   */
  getTeamInsights(
    workItems: IWorkItem[],
    teamId: string,
    teamName: string
  ): TeamInsights {
    const teamItems = workItems.filter(
      (item) => item.teamId === teamId || item.groupId === teamId
    );
    const metrics = this.calculateMetrics(teamItems);
    const concerns = this.identifyTeamConcerns(teamItems, metrics);

    return {
      teamId,
      teamName,
      metrics,
      concerns,
    };
  }

  // ============================================
  // METRICS CALCULATION
  // ============================================

  /**
   * Calculate aggregated metrics from work items
   */
  calculateMetrics(workItems: IWorkItem[]): WorkItemMetrics {
    const now = new Date();

    // Initialize counts
    const byStatus: Record<WorkStatus, number> = {
      [WorkStatus.NOT_STARTED]: 0,
      [WorkStatus.IN_PROGRESS]: 0,
      [WorkStatus.BLOCKED]: 0,
      [WorkStatus.COMPLETE]: 0,
      [WorkStatus.CANCELLED]: 0,
    };

    const byHealth: Record<HealthStatus, number> = {
      [HealthStatus.GREEN]: 0,
      [HealthStatus.YELLOW]: 0,
      [HealthStatus.RED]: 0,
      [HealthStatus.UNKNOWN]: 0,
    };

    const byPriority: Record<Priority, number> = {
      [Priority.P0]: 0,
      [Priority.P1]: 0,
      [Priority.P2]: 0,
      [Priority.P3]: 0,
    };

    let atRisk = 0;
    let needsHelp = 0;
    let stale = 0;
    let overdue = 0;

    // Count items
    for (const item of workItems) {
      byStatus[item.status]++;
      byHealth[item.health]++;
      byPriority[item.priority]++;

      if (item.atRisk) atRisk++;
      if (item.needsHelp) needsHelp++;
      if (item.stale) stale++;

      // Check if overdue
      if (
        item.targetDate &&
        new Date(item.targetDate) < now &&
        item.status !== WorkStatus.COMPLETE &&
        item.status !== WorkStatus.CANCELLED
      ) {
        overdue++;
      }
    }

    const total = workItems.length;
    const completed = byStatus[WorkStatus.COMPLETE];
    const cancelled = byStatus[WorkStatus.CANCELLED];
    const blocked = byStatus[WorkStatus.BLOCKED];

    // Calculate completion rate (excluding cancelled items)
    const completionRate = total > cancelled
      ? Math.round((completed / (total - cancelled)) * 100)
      : 0;

    // Calculate health score
    const healthScore = this.calculateHealthScore(byHealth, total);

    return {
      total,
      byStatus,
      byHealth,
      byPriority,
      atRisk,
      needsHelp,
      blocked,
      stale,
      overdue,
      completionRate,
      healthScore,
    };
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(
    byHealth: Record<HealthStatus, number>,
    total: number
  ): number {
    if (total === 0) return 100;

    const weights = {
      [HealthStatus.GREEN]: 100,
      [HealthStatus.YELLOW]: 60,
      [HealthStatus.RED]: 20,
      [HealthStatus.UNKNOWN]: 50,
    };

    let weightedSum = 0;
    for (const [health, count] of Object.entries(byHealth)) {
      weightedSum += count * weights[health as HealthStatus];
    }

    return Math.round(weightedSum / total);
  }

  // ============================================
  // ATTENTION ITEMS IDENTIFICATION
  // ============================================

  /**
   * Identify items requiring executive attention
   */
  private identifyAttentionItems(workItems: IWorkItem[]): AttentionItem[] {
    const attentionItems: AttentionItem[] = [];
    const now = new Date();

    for (const item of workItems) {
      // Skip completed/cancelled items
      if (
        item.status === WorkStatus.COMPLETE ||
        item.status === WorkStatus.CANCELLED
      ) {
        continue;
      }

      const reasons: string[] = [];
      let urgency: 'critical' | 'high' | 'medium' = 'medium';

      // P0 items that are not green
      if (item.priority === Priority.P0 && item.health !== HealthStatus.GREEN) {
        reasons.push('P0 priority with non-green health');
        urgency = 'critical';
      }

      // Blocked P0/P1 items
      if (
        item.status === WorkStatus.BLOCKED &&
        (item.priority === Priority.P0 || item.priority === Priority.P1)
      ) {
        reasons.push('High-priority item blocked');
        urgency = urgency === 'critical' ? 'critical' : 'high';
      }

      // Overdue items
      let daysOverdue: number | undefined;
      if (item.targetDate) {
        const targetDate = new Date(item.targetDate);
        if (targetDate < now) {
          daysOverdue = Math.ceil(
            (now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          reasons.push(`Overdue by ${daysOverdue} days`);
          if (daysOverdue > 7) {
            urgency = urgency === 'critical' ? 'critical' : 'high';
          }
        }
      }

      // Items needing help
      if (item.needsHelp) {
        reasons.push('Flagged as needing help');
        urgency = urgency === 'critical' ? 'critical' : 'high';
      }

      // Red health items
      if (item.health === HealthStatus.RED) {
        reasons.push('Red health status');
        if (item.priority === Priority.P0 || item.priority === Priority.P1) {
          urgency = 'critical';
        } else {
          urgency = urgency === 'critical' ? 'critical' : 'high';
        }
      }

      // At risk items
      if (item.atRisk) {
        reasons.push('Flagged as at risk');
      }

      // Only add if there are reasons
      if (reasons.length > 0) {
        attentionItems.push({
          id: item.id,
          title: item.title,
          reason: reasons.join('; '),
          urgency,
          priority: item.priority,
          daysOverdue,
        });
      }
    }

    // Sort by urgency and priority
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };

    return attentionItems.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ============================================
  // NATURAL LANGUAGE GENERATION
  // ============================================

  /**
   * Generate highlight bullet points
   */
  private generateHighlights(
    metrics: WorkItemMetrics,
    attentionItems: AttentionItem[],
    groupName?: string
  ): string[] {
    const highlights: string[] = [];
    const scope = groupName ? `${groupName}` : 'Portfolio';

    // Overall health
    const healthDesc = metrics.healthScore >= 80
      ? 'healthy'
      : metrics.healthScore >= 60
        ? 'requires attention'
        : 'needs immediate action';
    highlights.push(
      `${scope} health score: ${metrics.healthScore}% (${healthDesc})`
    );

    // Completion rate
    highlights.push(
      `Completion rate: ${metrics.completionRate}% (${metrics.byStatus[WorkStatus.COMPLETE]} of ${metrics.total} items complete)`
    );

    // Health breakdown
    const greenPct = metrics.total > 0
      ? Math.round((metrics.byHealth[HealthStatus.GREEN] / metrics.total) * 100)
      : 0;
    const yellowPct = metrics.total > 0
      ? Math.round((metrics.byHealth[HealthStatus.YELLOW] / metrics.total) * 100)
      : 0;
    const redPct = metrics.total > 0
      ? Math.round((metrics.byHealth[HealthStatus.RED] / metrics.total) * 100)
      : 0;
    highlights.push(
      `Health distribution: ${greenPct}% green, ${yellowPct}% yellow, ${redPct}% red`
    );

    // At risk items
    if (metrics.atRisk > 0) {
      highlights.push(
        `${metrics.atRisk} item${metrics.atRisk === 1 ? '' : 's'} at risk of missing target dates`
      );
    }

    // Blocked items
    if (metrics.blocked > 0) {
      highlights.push(
        `${metrics.blocked} item${metrics.blocked === 1 ? '' : 's'} currently blocked`
      );
    }

    // Needs help
    if (metrics.needsHelp > 0) {
      highlights.push(
        `${metrics.needsHelp} item${metrics.needsHelp === 1 ? '' : 's'} flagged as needing help`
      );
    }

    // Critical attention items
    const criticalItems = attentionItems.filter((i) => i.urgency === 'critical');
    if (criticalItems.length > 0) {
      highlights.push(
        `${criticalItems.length} critical item${criticalItems.length === 1 ? '' : 's'} requiring immediate attention`
      );
    }

    // Overdue items
    if (metrics.overdue > 0) {
      highlights.push(
        `${metrics.overdue} item${metrics.overdue === 1 ? '' : 's'} past target date`
      );
    }

    return highlights;
  }

  /**
   * Generate natural language summary
   * In the future, this could be replaced with actual LLM integration
   */
  private generateNaturalLanguageSummary(
    metrics: WorkItemMetrics,
    attentionItems: AttentionItem[],
    groupName?: string
  ): string {
    const scope = groupName || 'the portfolio';
    const parts: string[] = [];

    // Opening statement based on health
    if (metrics.healthScore >= 80) {
      parts.push(
        `Overall, ${scope} is in good shape with a health score of ${metrics.healthScore}%.`
      );
    } else if (metrics.healthScore >= 60) {
      parts.push(
        `${scope} requires attention with a health score of ${metrics.healthScore}%.`
      );
    } else {
      parts.push(
        `${scope} needs immediate focus with a concerning health score of ${metrics.healthScore}%.`
      );
    }

    // Progress statement
    parts.push(
      `${metrics.byStatus[WorkStatus.COMPLETE]} of ${metrics.total} items (${metrics.completionRate}%) are complete, with ${metrics.byStatus[WorkStatus.IN_PROGRESS]} currently in progress.`
    );

    // Issues statement
    const issues: string[] = [];
    if (metrics.blocked > 0) {
      issues.push(`${metrics.blocked} blocked item${metrics.blocked === 1 ? '' : 's'}`);
    }
    if (metrics.atRisk > 0) {
      issues.push(`${metrics.atRisk} at-risk item${metrics.atRisk === 1 ? '' : 's'}`);
    }
    if (metrics.overdue > 0) {
      issues.push(`${metrics.overdue} overdue item${metrics.overdue === 1 ? '' : 's'}`);
    }

    if (issues.length > 0) {
      parts.push(`Key concerns include ${issues.join(', ')}.`);
    }

    // Critical items statement
    const criticalItems = attentionItems.filter((i) => i.urgency === 'critical');
    if (criticalItems.length > 0) {
      if (criticalItems.length === 1) {
        parts.push(
          `There is 1 critical item requiring immediate attention: "${criticalItems[0].title}".`
        );
      } else {
        parts.push(
          `There are ${criticalItems.length} critical items requiring immediate attention.`
        );
      }
    }

    // Recommendation
    if (metrics.needsHelp > 0) {
      parts.push(
        `Recommend reviewing the ${metrics.needsHelp} item${metrics.needsHelp === 1 ? '' : 's'} flagged for help.`
      );
    }

    return parts.join(' ');
  }

  // ============================================
  // RISK ANALYSIS
  // ============================================

  /**
   * Identify items with risk factors
   */
  private identifyRiskItems(workItems: IWorkItem[]): RiskItem[] {
    const riskItems: RiskItem[] = [];
    const now = new Date();

    for (const item of workItems) {
      // Skip completed/cancelled
      if (
        item.status === WorkStatus.COMPLETE ||
        item.status === WorkStatus.CANCELLED
      ) {
        continue;
      }

      const riskFactors: string[] = [];
      let riskScore = 0;

      // Red health
      if (item.health === HealthStatus.RED) {
        riskFactors.push('Red health status');
        riskScore += 30;
      } else if (item.health === HealthStatus.YELLOW) {
        riskFactors.push('Yellow health status');
        riskScore += 15;
      }

      // Blocked
      if (item.status === WorkStatus.BLOCKED) {
        riskFactors.push('Currently blocked');
        riskScore += 25;
      }

      // At risk flag
      if (item.atRisk) {
        riskFactors.push('Flagged as at risk');
        riskScore += 20;
      }

      // Stale
      if (item.stale) {
        riskFactors.push('No recent activity');
        riskScore += 15;
      }

      // High drift score
      if (item.driftScore && item.driftScore > 0.7) {
        riskFactors.push('High drift between stated progress and activity');
        riskScore += 20;
      }

      // Overdue or near deadline
      let daysToTarget: number | undefined;
      if (item.targetDate) {
        const targetDate = new Date(item.targetDate);
        daysToTarget = Math.ceil(
          (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysToTarget < 0) {
          riskFactors.push(`Overdue by ${Math.abs(daysToTarget)} days`);
          riskScore += Math.min(30, Math.abs(daysToTarget) * 2);
        } else if (daysToTarget <= 7 && item.health !== HealthStatus.GREEN) {
          riskFactors.push('Target date within 7 days with non-green health');
          riskScore += 15;
        }
      }

      // Priority weight
      if (item.priority === Priority.P0) {
        riskScore = Math.min(100, riskScore * 1.5);
      } else if (item.priority === Priority.P1) {
        riskScore = Math.min(100, riskScore * 1.25);
      }

      // Only include if there are risk factors
      if (riskFactors.length > 0 && riskScore > 20) {
        riskItems.push({
          id: item.id,
          title: item.title,
          riskFactors,
          riskScore: Math.min(100, Math.round(riskScore)),
          priority: item.priority,
          targetDate: item.targetDate || undefined,
          daysToTarget,
        });
      }
    }

    // Sort by risk score descending
    return riskItems.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Detect patterns in risk data
   */
  private detectRiskPatterns(workItems: IWorkItem[]): RiskPattern[] {
    const patterns: RiskPattern[] = [];

    // Group blocked items by team
    const blockedByTeam = new Map<string, number>();
    for (const item of workItems) {
      if (item.status === WorkStatus.BLOCKED && item.teamId) {
        blockedByTeam.set(item.teamId, (blockedByTeam.get(item.teamId) || 0) + 1);
      }
    }

    // Team blocked pattern
    for (const [teamId, count] of blockedByTeam) {
      if (count >= 2) {
        patterns.push({
          type: 'team_blocked',
          description: `Team has ${count} blocked items, indicating potential systemic issues`,
          affectedCount: count,
          severity: count >= 4 ? 'high' : count >= 3 ? 'medium' : 'low',
        });
      }
    }

    // Date slippage pattern
    const slippedItems = workItems.filter(
      (item) =>
        item.targetDate &&
        item.originalTargetDate &&
        new Date(item.targetDate) > new Date(item.originalTargetDate)
    );
    if (slippedItems.length >= 3) {
      patterns.push({
        type: 'date_slippage',
        description: `${slippedItems.length} items have had their target dates pushed back`,
        affectedCount: slippedItems.length,
        severity: slippedItems.length >= 5 ? 'high' : 'medium',
      });
    }

    // Stale high priority pattern
    const staleHighPriority = workItems.filter(
      (item) =>
        item.stale &&
        (item.priority === Priority.P0 || item.priority === Priority.P1) &&
        item.status !== WorkStatus.COMPLETE &&
        item.status !== WorkStatus.CANCELLED
    );
    if (staleHighPriority.length > 0) {
      patterns.push({
        type: 'stale_high_priority',
        description: `${staleHighPriority.length} high-priority items have no recent activity`,
        affectedCount: staleHighPriority.length,
        severity: staleHighPriority.length >= 3 ? 'high' : 'medium',
      });
    }

    // Health degradation pattern (many yellow/red items)
    const unhealthyItems = workItems.filter(
      (item) =>
        (item.health === HealthStatus.RED || item.health === HealthStatus.YELLOW) &&
        item.status !== WorkStatus.COMPLETE &&
        item.status !== WorkStatus.CANCELLED
    );
    const unhealthyRatio = workItems.length > 0
      ? unhealthyItems.length / workItems.length
      : 0;
    if (unhealthyRatio > 0.3 && unhealthyItems.length >= 3) {
      patterns.push({
        type: 'health_degradation',
        description: `${Math.round(unhealthyRatio * 100)}% of active items have yellow or red health`,
        affectedCount: unhealthyItems.length,
        severity: unhealthyRatio > 0.5 ? 'high' : 'medium',
      });
    }

    return patterns;
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(
    riskItems: RiskItem[],
    patterns: RiskPattern[]
  ): number {
    if (riskItems.length === 0) return 0;

    // Base score from individual items
    const avgItemRisk = riskItems.reduce((sum, item) => sum + item.riskScore, 0) / riskItems.length;

    // Pattern multiplier
    const patternMultiplier = patterns.reduce((mult, pattern) => {
      const severityMult = pattern.severity === 'high' ? 0.15 : pattern.severity === 'medium' ? 0.1 : 0.05;
      return mult + severityMult;
    }, 1);

    // Risk concentration (many high-risk items is worse)
    const highRiskCount = riskItems.filter((i) => i.riskScore >= 60).length;
    const concentrationBonus = Math.min(20, highRiskCount * 5);

    const finalScore = Math.min(100, (avgItemRisk * patternMultiplier) + concentrationBonus);
    return Math.round(finalScore);
  }

  /**
   * Categorize risk level from score
   */
  private categorizeRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on risks
   */
  private generateRecommendations(
    riskItems: RiskItem[],
    patterns: RiskPattern[]
  ): string[] {
    const recommendations: string[] = [];

    // Top risk items
    const topRisks = riskItems.slice(0, 3);
    if (topRisks.length > 0) {
      recommendations.push(
        `Prioritize review of top ${topRisks.length} highest-risk items`
      );
    }

    // Pattern-specific recommendations
    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'team_blocked':
          recommendations.push(
            'Investigate root cause of blocked items - may indicate dependency or resource issues'
          );
          break;
        case 'date_slippage':
          recommendations.push(
            'Review estimation practices - multiple date slippages suggest scope or resource misalignment'
          );
          break;
        case 'stale_high_priority':
          recommendations.push(
            'Follow up on stale high-priority items - ensure they are still actively worked'
          );
          break;
        case 'health_degradation':
          recommendations.push(
            'Conduct health review across portfolio - high percentage of unhealthy items needs attention'
          );
          break;
      }
    }

    // Blocked items recommendation
    const blockedP0P1 = riskItems.filter(
      (item) =>
        item.riskFactors.includes('Currently blocked') &&
        (item.priority === Priority.P0 || item.priority === Priority.P1)
    );
    if (blockedP0P1.length > 0) {
      recommendations.push(
        `Unblock ${blockedP0P1.length} high-priority blocked item${blockedP0P1.length === 1 ? '' : 's'} as immediate priority`
      );
    }

    // Overdue items recommendation
    const overdueItems = riskItems.filter((item) =>
      item.riskFactors.some((f) => f.includes('Overdue'))
    );
    if (overdueItems.length > 0) {
      recommendations.push(
        `Reset or update target dates for ${overdueItems.length} overdue item${overdueItems.length === 1 ? '' : 's'}`
      );
    }

    return recommendations;
  }

  // ============================================
  // WEEKLY DIGEST
  // ============================================

  /**
   * Get current week string (ISO week format)
   */
  private getCurrentWeekString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + oneJan.getDay() + 1) / 7);
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  }

  /**
   * Compare metrics between weeks
   */
  private compareWeeks(
    current: WorkItemMetrics,
    previous: WorkItemMetrics
  ): WeekComparison {
    return {
      completionRateDelta: current.completionRate - previous.completionRate,
      healthScoreDelta: current.healthScore - previous.healthScore,
      atRiskDelta: current.atRisk - previous.atRisk,
      blockedDelta: current.blocked - previous.blocked,
    };
  }

  /**
   * Count new items (created this week)
   */
  private countNewItems(workItems: IWorkItem[]): number {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return workItems.filter((item) => new Date(item.createdAt) >= oneWeekAgo).length;
  }

  /**
   * Count newly at-risk items
   */
  private countNewAtRisk(
    current: IWorkItem[],
    previous: IWorkItem[]
  ): number {
    const previousAtRiskIds = new Set(
      previous.filter((i) => i.atRisk).map((i) => i.id)
    );
    return current.filter((i) => i.atRisk && !previousAtRiskIds.has(i.id)).length;
  }

  /**
   * Count newly blocked items
   */
  private countNewBlocked(
    current: IWorkItem[],
    previous: IWorkItem[]
  ): number {
    const previousBlockedIds = new Set(
      previous.filter((i) => i.status === WorkStatus.BLOCKED).map((i) => i.id)
    );
    return current.filter(
      (i) => i.status === WorkStatus.BLOCKED && !previousBlockedIds.has(i.id)
    ).length;
  }

  /**
   * Identify achievements for the week
   */
  private identifyAchievements(
    current: IWorkItem[],
    previous: IWorkItem[]
  ): string[] {
    const achievements: string[] = [];

    // Completed high-priority items
    const previousCompleteIds = new Set(
      previous.filter((i) => i.status === WorkStatus.COMPLETE).map((i) => i.id)
    );
    const newlyCompleted = current.filter(
      (i) => i.status === WorkStatus.COMPLETE && !previousCompleteIds.has(i.id)
    );

    const completedP0P1 = newlyCompleted.filter(
      (i) => i.priority === Priority.P0 || i.priority === Priority.P1
    );
    if (completedP0P1.length > 0) {
      achievements.push(
        `Completed ${completedP0P1.length} high-priority (P0/P1) item${completedP0P1.length === 1 ? '' : 's'}`
      );
    }

    // Overall completion count
    if (newlyCompleted.length > 3) {
      achievements.push(`Strong velocity: ${newlyCompleted.length} items completed this week`);
    }

    // Unblocked items
    const previousBlockedIds = new Set(
      previous.filter((i) => i.status === WorkStatus.BLOCKED).map((i) => i.id)
    );
    const unblocked = current.filter(
      (i) =>
        i.status !== WorkStatus.BLOCKED &&
        i.status !== WorkStatus.CANCELLED &&
        previousBlockedIds.has(i.id)
    );
    if (unblocked.length > 0) {
      achievements.push(`Unblocked ${unblocked.length} previously blocked item${unblocked.length === 1 ? '' : 's'}`);
    }

    // Health improvements
    const currentMetrics = this.calculateMetrics(current);
    const previousMetrics = this.calculateMetrics(previous);
    if (currentMetrics.healthScore - previousMetrics.healthScore >= 5) {
      achievements.push(
        `Health score improved by ${currentMetrics.healthScore - previousMetrics.healthScore} points`
      );
    }

    return achievements;
  }

  /**
   * Identify concerns for the week
   */
  private identifyConcerns(
    metrics: WorkItemMetrics,
    comparison: WeekComparison
  ): string[] {
    const concerns: string[] = [];

    // Health declining
    if (comparison.healthScoreDelta < -5) {
      concerns.push(
        `Health score dropped by ${Math.abs(comparison.healthScoreDelta)} points`
      );
    }

    // New at-risk items
    if (comparison.atRiskDelta > 0) {
      concerns.push(`${comparison.atRiskDelta} new item${comparison.atRiskDelta === 1 ? '' : 's'} became at risk`);
    }

    // New blocked items
    if (comparison.blockedDelta > 0) {
      concerns.push(`${comparison.blockedDelta} new item${comparison.blockedDelta === 1 ? '' : 's'} became blocked`);
    }

    // High blocked count
    if (metrics.blocked >= 3) {
      concerns.push(`${metrics.blocked} items currently blocked - requires attention`);
    }

    // Low completion rate
    if (metrics.completionRate < 20 && metrics.total >= 5) {
      concerns.push(`Low completion rate of ${metrics.completionRate}%`);
    }

    // Many items needing help
    if (metrics.needsHelp >= 3) {
      concerns.push(`${metrics.needsHelp} items flagged as needing help`);
    }

    return concerns;
  }

  /**
   * Generate weekly summary text
   */
  private generateWeeklySummary(
    metrics: WorkItemMetrics,
    comparison: WeekComparison,
    achievements: string[],
    concerns: string[]
  ): string {
    const parts: string[] = [];

    // Opening based on comparison
    if (comparison.healthScoreDelta > 0) {
      parts.push(
        `This was a positive week with the health score improving by ${comparison.healthScoreDelta} points to ${metrics.healthScore}%.`
      );
    } else if (comparison.healthScoreDelta < 0) {
      parts.push(
        `This week saw some challenges with the health score declining by ${Math.abs(comparison.healthScoreDelta)} points to ${metrics.healthScore}%.`
      );
    } else {
      parts.push(
        `The portfolio maintained a steady health score of ${metrics.healthScore}% this week.`
      );
    }

    // Achievements summary
    if (achievements.length > 0) {
      parts.push(`Key achievements: ${achievements.slice(0, 2).join('; ')}.`);
    }

    // Concerns summary
    if (concerns.length > 0) {
      parts.push(`Areas of concern: ${concerns.slice(0, 2).join('; ')}.`);
    }

    // Closing recommendation
    if (metrics.blocked > 0 || metrics.needsHelp > 0) {
      parts.push(
        `Recommend focusing on unblocking ${metrics.blocked} blocked items and reviewing ${metrics.needsHelp} items needing help.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Identify team-specific concerns
   */
  private identifyTeamConcerns(
    teamItems: IWorkItem[],
    metrics: WorkItemMetrics
  ): string[] {
    const concerns: string[] = [];

    if (metrics.blocked > 0) {
      concerns.push(`${metrics.blocked} item${metrics.blocked === 1 ? '' : 's'} blocked`);
    }

    if (metrics.atRisk > 0) {
      concerns.push(`${metrics.atRisk} item${metrics.atRisk === 1 ? '' : 's'} at risk`);
    }

    if (metrics.overdue > 0) {
      concerns.push(`${metrics.overdue} item${metrics.overdue === 1 ? '' : 's'} overdue`);
    }

    if (metrics.healthScore < 60) {
      concerns.push(`Low health score: ${metrics.healthScore}%`);
    }

    return concerns;
  }
}

// Export singleton instance
export const insightsService = new InsightsService();

export default InsightsService;
