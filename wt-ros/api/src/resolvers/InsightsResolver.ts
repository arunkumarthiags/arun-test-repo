/**
 * InsightsResolver - GraphQL resolver for AI-powered executive insights
 *
 * Provides endpoints for executive summaries, risk analysis, and weekly digests.
 * Designed to surface actionable insights for leadership decision-making.
 */
import {
  Resolver,
  Query,
  Arg,
  Ctx,
  ID,
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from 'type-graphql';
import { Service } from 'typedi';

import { WorkItemRepository } from '../repositories/WorkItemRepository';
import { GraphQLContext } from './WorkItemResolver';
import {
  InsightsService,
  ExecutiveSummary,
  RiskAnalysis,
  WeeklyDigest,
  WorkItemMetrics,
  AttentionItem as ServiceAttentionItem,
  RiskItem as ServiceRiskItem,
  RiskPattern as ServiceRiskPattern,
  WeekComparison as ServiceWeekComparison,
} from '../services/InsightsService';
import { Priority, WorkStatus, HealthStatus } from '@wt-ros/common';

// ============================================
// ENUMS
// ============================================

enum UrgencyLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
}
registerEnumType(UrgencyLevel, { name: 'UrgencyLevel' });

enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
registerEnumType(RiskLevel, { name: 'RiskLevel' });

enum PatternSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
registerEnumType(PatternSeverity, { name: 'PatternSeverity' });

enum RiskPatternType {
  TEAM_BLOCKED = 'TEAM_BLOCKED',
  DATE_SLIPPAGE = 'DATE_SLIPPAGE',
  HEALTH_DEGRADATION = 'HEALTH_DEGRADATION',
  STALE_HIGH_PRIORITY = 'STALE_HIGH_PRIORITY',
}
registerEnumType(RiskPatternType, { name: 'RiskPatternType' });

// ============================================
// OUTPUT TYPES
// ============================================

@ObjectType({ description: 'Aggregated metrics for work items' })
class WorkItemMetricsType {
  @Field(() => Int, { description: 'Total number of work items' })
  total!: number;

  @Field(() => Int, { description: 'Items not started' })
  notStarted!: number;

  @Field(() => Int, { description: 'Items in progress' })
  inProgress!: number;

  @Field(() => Int, { description: 'Blocked items' })
  blocked!: number;

  @Field(() => Int, { description: 'Completed items' })
  complete!: number;

  @Field(() => Int, { description: 'Cancelled items' })
  cancelled!: number;

  @Field(() => Int, { description: 'Green health items' })
  healthGreen!: number;

  @Field(() => Int, { description: 'Yellow health items' })
  healthYellow!: number;

  @Field(() => Int, { description: 'Red health items' })
  healthRed!: number;

  @Field(() => Int, { description: 'Unknown health items' })
  healthUnknown!: number;

  @Field(() => Int, { description: 'P0 priority items' })
  priorityP0!: number;

  @Field(() => Int, { description: 'P1 priority items' })
  priorityP1!: number;

  @Field(() => Int, { description: 'P2 priority items' })
  priorityP2!: number;

  @Field(() => Int, { description: 'P3 priority items' })
  priorityP3!: number;

  @Field(() => Int, { description: 'Items at risk' })
  atRisk!: number;

  @Field(() => Int, { description: 'Items needing help' })
  needsHelp!: number;

  @Field(() => Int, { description: 'Stale items' })
  stale!: number;

  @Field(() => Int, { description: 'Overdue items' })
  overdue!: number;

  @Field(() => Int, { description: 'Completion rate (0-100)' })
  completionRate!: number;

  @Field(() => Int, { description: 'Health score (0-100)' })
  healthScore!: number;
}

@ObjectType({ description: 'Item requiring executive attention' })
class AttentionItemType {
  @Field(() => ID, { description: 'Work item ID' })
  id!: string;

  @Field({ description: 'Work item title' })
  title!: string;

  @Field({ description: 'Reason for attention' })
  reason!: string;

  @Field(() => UrgencyLevel, { description: 'Urgency level' })
  urgency!: UrgencyLevel;

  @Field(() => Priority, { description: 'Priority of the work item' })
  priority!: Priority;

  @Field(() => Int, { nullable: true, description: 'Days overdue' })
  daysOverdue?: number;

  @Field({ nullable: true, description: 'Team name' })
  teamName?: string;
}

@ObjectType({ description: 'AI-generated executive summary' })
class ExecutiveSummaryType {
  @Field({ description: 'Natural language summary' })
  summary!: string;

  @Field(() => [String], { description: 'Key highlights' })
  highlights!: string[];

  @Field(() => WorkItemMetricsType, { description: 'Computed metrics' })
  metrics!: WorkItemMetricsType;

  @Field(() => [AttentionItemType], { description: 'Items requiring attention' })
  attentionItems!: AttentionItemType[];

  @Field({ description: 'Generation timestamp' })
  generatedAt!: Date;
}

@ObjectType({ description: 'Individual item risk assessment' })
class RiskItemType {
  @Field(() => ID, { description: 'Work item ID' })
  id!: string;

  @Field({ description: 'Work item title' })
  title!: string;

  @Field(() => [String], { description: 'Contributing risk factors' })
  riskFactors!: string[];

  @Field(() => Int, { description: 'Risk score (0-100)' })
  riskScore!: number;

  @Field(() => Priority, { description: 'Priority of the work item' })
  priority!: Priority;

  @Field({ nullable: true, description: 'Target date' })
  targetDate?: Date;

  @Field(() => Int, { nullable: true, description: 'Days to/from target' })
  daysToTarget?: number;
}

@ObjectType({ description: 'Identified risk pattern' })
class RiskPatternTypeOutput {
  @Field(() => RiskPatternType, { description: 'Pattern type' })
  type!: RiskPatternType;

  @Field({ description: 'Human-readable description' })
  description!: string;

  @Field(() => Int, { description: 'Number of affected items' })
  affectedCount!: number;

  @Field(() => PatternSeverity, { description: 'Pattern severity' })
  severity!: PatternSeverity;
}

@ObjectType({ description: 'Risk analysis result' })
class RiskAnalysisType {
  @Field(() => RiskLevel, { description: 'Overall risk level' })
  overallRisk!: RiskLevel;

  @Field(() => Int, { description: 'Overall risk score (0-100)' })
  riskScore!: number;

  @Field(() => [RiskItemType], { description: 'Items at risk with explanations' })
  riskItems!: RiskItemType[];

  @Field(() => [RiskPatternTypeOutput], { description: 'Detected risk patterns' })
  patterns!: RiskPatternTypeOutput[];

  @Field(() => [String], { description: 'Recommended actions' })
  recommendations!: string[];

  @Field({ description: 'Analysis timestamp' })
  generatedAt!: Date;
}

@ObjectType({ description: 'Week-over-week comparison' })
class WeekComparisonType {
  @Field(() => Int, { description: 'Change in completion rate' })
  completionRateDelta!: number;

  @Field(() => Int, { description: 'Change in health score' })
  healthScoreDelta!: number;

  @Field(() => Int, { description: 'Change in at-risk count' })
  atRiskDelta!: number;

  @Field(() => Int, { description: 'Change in blocked count' })
  blockedDelta!: number;
}

@ObjectType({ description: 'Weekly progress digest' })
class WeeklyDigestType {
  @Field({ description: 'Week identifier (e.g., 2024-W01)' })
  week!: string;

  @Field({ description: 'Natural language summary' })
  summary!: string;

  @Field(() => Int, { description: 'Items completed this week' })
  completed!: number;

  @Field(() => Int, { description: 'New items created' })
  newItems!: number;

  @Field(() => Int, { description: 'Items that became at risk' })
  newAtRisk!: number;

  @Field(() => Int, { description: 'Items that became blocked' })
  newBlocked!: number;

  @Field(() => [String], { description: 'Notable achievements' })
  achievements!: string[];

  @Field(() => [String], { description: 'Areas of concern' })
  concerns!: string[];

  @Field(() => WeekComparisonType, { description: 'Week-over-week comparison' })
  comparison!: WeekComparisonType;

  @Field({ description: 'Digest generation timestamp' })
  generatedAt!: Date;
}

@ObjectType({ description: 'AI query response' })
class AskAIResponseType {
  @Field({ description: 'AI-generated response' })
  response!: string;

  @Field(() => [String], { description: 'Related work item IDs' })
  relatedItemIds!: string[];

  @Field({ description: 'Query timestamp' })
  queriedAt!: Date;
}

// ============================================
// RESOLVER
// ============================================

@Service()
@Resolver()
export class InsightsResolver {
  private readonly insightsService: InsightsService;
  private readonly workItemRepository: WorkItemRepository;

  constructor() {
    this.insightsService = new InsightsService();
    this.workItemRepository = new WorkItemRepository();
  }

  // ----------------------------------------
  // QUERIES
  // ----------------------------------------

  /**
   * Get AI-generated executive summary
   * Provides an overview of work item status with actionable insights
   */
  @Query(() => ExecutiveSummaryType, {
    description: 'Get AI-generated executive summary of work status',
  })
  async executiveSummary(
    @Arg('groupId', () => ID, { nullable: true, description: 'Filter by group ID' })
    groupId?: string,
    @Ctx() ctx?: GraphQLContext
  ): Promise<ExecutiveSummaryType> {
    // Build cache key
    const cacheKey = `insights:summary:${groupId || 'all'}`;

    // Check cache
    if (ctx?.redis) {
      const cached = await ctx.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fetch work items
    const filters = groupId ? { groupIds: [groupId] } : undefined;
    const { edges } = await this.workItemRepository.findWithPagination(
      filters,
      { limit: 1000 },
      { field: 'priority', direction: 'ASC' }
    );
    const workItems = edges.map((e) => e.node);

    // Generate summary
    const summary = this.insightsService.generateExecutiveSummary(
      workItems,
      groupId ? `Group ${groupId}` : undefined
    );

    // Transform to GraphQL type
    const result = this.transformExecutiveSummary(summary);

    // Cache for 5 minutes
    if (ctx?.redis) {
      await ctx.redis.set(cacheKey, JSON.stringify(result), { EX: 300 });
    }

    return result;
  }

  /**
   * Get risk analysis for all work items
   * Identifies items at risk with explanations and patterns
   */
  @Query(() => RiskAnalysisType, {
    description: 'Get risk analysis with items at risk and recommendations',
  })
  async riskAnalysis(
    @Arg('groupId', () => ID, { nullable: true, description: 'Filter by group ID' })
    groupId?: string,
    @Ctx() ctx?: GraphQLContext
  ): Promise<RiskAnalysisType> {
    // Build cache key
    const cacheKey = `insights:risk:${groupId || 'all'}`;

    // Check cache
    if (ctx?.redis) {
      const cached = await ctx.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fetch work items
    const filters = groupId ? { groupIds: [groupId] } : undefined;
    const { edges } = await this.workItemRepository.findWithPagination(
      filters,
      { limit: 1000 },
      { field: 'priority', direction: 'ASC' }
    );
    const workItems = edges.map((e) => e.node);

    // Analyze risks
    const analysis = this.insightsService.analyzeRisks(workItems);

    // Transform to GraphQL type
    const result = this.transformRiskAnalysis(analysis);

    // Cache for 5 minutes
    if (ctx?.redis) {
      await ctx.redis.set(cacheKey, JSON.stringify(result), { EX: 300 });
    }

    return result;
  }

  /**
   * Get weekly progress digest
   * Summarizes the week's progress with achievements and concerns
   */
  @Query(() => WeeklyDigestType, {
    description: 'Get weekly progress digest with achievements and concerns',
  })
  async weeklyDigest(
    @Arg('groupId', () => ID, { nullable: true, description: 'Filter by group ID' })
    groupId?: string,
    @Ctx() ctx?: GraphQLContext
  ): Promise<WeeklyDigestType> {
    // Build cache key
    const cacheKey = `insights:weekly:${groupId || 'all'}`;

    // Check cache
    if (ctx?.redis) {
      const cached = await ctx.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fetch current week's work items
    const filters = groupId ? { groupIds: [groupId] } : undefined;
    const { edges } = await this.workItemRepository.findWithPagination(
      filters,
      { limit: 1000 },
      { field: 'priority', direction: 'ASC' }
    );
    const currentWeekItems = edges.map((e) => e.node);

    // For previous week comparison, we'd typically query with a date filter
    // For now, we use the same items as a baseline (simulating no change)
    // In production, this would query historical data
    const previousWeekItems = currentWeekItems;

    // Generate digest
    const digest = this.insightsService.generateWeeklyDigest(
      currentWeekItems,
      previousWeekItems
    );

    // Transform to GraphQL type
    const result = this.transformWeeklyDigest(digest);

    // Cache for 1 hour (weekly digest doesn't change often)
    if (ctx?.redis) {
      await ctx.redis.set(cacheKey, JSON.stringify(result), { EX: 3600 });
    }

    return result;
  }

  /**
   * Ask AI a natural language question about work items
   * This is a placeholder for future LLM integration
   */
  @Query(() => AskAIResponseType, {
    description: 'Ask AI a natural language question about work items (mock)',
  })
  async askAI(
    @Arg('question', { description: 'Natural language question' })
    question: string,
    @Arg('groupId', () => ID, { nullable: true, description: 'Filter by group ID' })
    groupId?: string
  ): Promise<AskAIResponseType> {
    // This is a mock implementation
    // In production, this would integrate with an LLM

    // Fetch work items for context
    const filters = groupId ? { groupIds: [groupId] } : undefined;
    const { edges } = await this.workItemRepository.findWithPagination(
      filters,
      { limit: 100 },
      { field: 'priority', direction: 'ASC' }
    );
    const workItems = edges.map((e) => e.node);

    // Generate mock response based on question keywords
    const response = this.generateMockAIResponse(question, workItems);

    return {
      response,
      relatedItemIds: workItems.slice(0, 5).map((i) => i.id),
      queriedAt: new Date(),
    };
  }

  // ----------------------------------------
  // TRANSFORMATION HELPERS
  // ----------------------------------------

  /**
   * Transform service metrics to GraphQL type
   */
  private transformMetrics(metrics: WorkItemMetrics): WorkItemMetricsType {
    return {
      total: metrics.total,
      notStarted: metrics.byStatus[WorkStatus.NOT_STARTED] || 0,
      inProgress: metrics.byStatus[WorkStatus.IN_PROGRESS] || 0,
      blocked: metrics.byStatus[WorkStatus.BLOCKED] || 0,
      complete: metrics.byStatus[WorkStatus.COMPLETE] || 0,
      cancelled: metrics.byStatus[WorkStatus.CANCELLED] || 0,
      healthGreen: metrics.byHealth[HealthStatus.GREEN] || 0,
      healthYellow: metrics.byHealth[HealthStatus.YELLOW] || 0,
      healthRed: metrics.byHealth[HealthStatus.RED] || 0,
      healthUnknown: metrics.byHealth[HealthStatus.UNKNOWN] || 0,
      priorityP0: metrics.byPriority[Priority.P0] || 0,
      priorityP1: metrics.byPriority[Priority.P1] || 0,
      priorityP2: metrics.byPriority[Priority.P2] || 0,
      priorityP3: metrics.byPriority[Priority.P3] || 0,
      atRisk: metrics.atRisk,
      needsHelp: metrics.needsHelp,
      stale: metrics.stale,
      overdue: metrics.overdue,
      completionRate: metrics.completionRate,
      healthScore: metrics.healthScore,
    };
  }

  /**
   * Transform attention item to GraphQL type
   */
  private transformAttentionItem(item: ServiceAttentionItem): AttentionItemType {
    const urgencyMap: Record<string, UrgencyLevel> = {
      critical: UrgencyLevel.CRITICAL,
      high: UrgencyLevel.HIGH,
      medium: UrgencyLevel.MEDIUM,
    };

    return {
      id: item.id,
      title: item.title,
      reason: item.reason,
      urgency: urgencyMap[item.urgency] || UrgencyLevel.MEDIUM,
      priority: item.priority,
      daysOverdue: item.daysOverdue,
      teamName: item.teamName,
    };
  }

  /**
   * Transform executive summary to GraphQL type
   */
  private transformExecutiveSummary(summary: ExecutiveSummary): ExecutiveSummaryType {
    return {
      summary: summary.summary,
      highlights: summary.highlights,
      metrics: this.transformMetrics(summary.metrics),
      attentionItems: summary.attentionItems.map((i) => this.transformAttentionItem(i)),
      generatedAt: summary.generatedAt,
    };
  }

  /**
   * Transform risk item to GraphQL type
   */
  private transformRiskItem(item: ServiceRiskItem): RiskItemType {
    return {
      id: item.id,
      title: item.title,
      riskFactors: item.riskFactors,
      riskScore: item.riskScore,
      priority: item.priority,
      targetDate: item.targetDate,
      daysToTarget: item.daysToTarget,
    };
  }

  /**
   * Transform risk pattern to GraphQL type
   */
  private transformRiskPattern(pattern: ServiceRiskPattern): RiskPatternTypeOutput {
    const typeMap: Record<string, RiskPatternType> = {
      team_blocked: RiskPatternType.TEAM_BLOCKED,
      date_slippage: RiskPatternType.DATE_SLIPPAGE,
      health_degradation: RiskPatternType.HEALTH_DEGRADATION,
      stale_high_priority: RiskPatternType.STALE_HIGH_PRIORITY,
    };

    const severityMap: Record<string, PatternSeverity> = {
      low: PatternSeverity.LOW,
      medium: PatternSeverity.MEDIUM,
      high: PatternSeverity.HIGH,
    };

    return {
      type: typeMap[pattern.type] || RiskPatternType.TEAM_BLOCKED,
      description: pattern.description,
      affectedCount: pattern.affectedCount,
      severity: severityMap[pattern.severity] || PatternSeverity.MEDIUM,
    };
  }

  /**
   * Transform risk analysis to GraphQL type
   */
  private transformRiskAnalysis(analysis: RiskAnalysis): RiskAnalysisType {
    const riskLevelMap: Record<string, RiskLevel> = {
      low: RiskLevel.LOW,
      medium: RiskLevel.MEDIUM,
      high: RiskLevel.HIGH,
      critical: RiskLevel.CRITICAL,
    };

    return {
      overallRisk: riskLevelMap[analysis.overallRisk] || RiskLevel.MEDIUM,
      riskScore: analysis.riskScore,
      riskItems: analysis.riskItems.map((i) => this.transformRiskItem(i)),
      patterns: analysis.patterns.map((p) => this.transformRiskPattern(p)),
      recommendations: analysis.recommendations,
      generatedAt: analysis.generatedAt,
    };
  }

  /**
   * Transform week comparison to GraphQL type
   */
  private transformWeekComparison(comparison: ServiceWeekComparison): WeekComparisonType {
    return {
      completionRateDelta: comparison.completionRateDelta,
      healthScoreDelta: comparison.healthScoreDelta,
      atRiskDelta: comparison.atRiskDelta,
      blockedDelta: comparison.blockedDelta,
    };
  }

  /**
   * Transform weekly digest to GraphQL type
   */
  private transformWeeklyDigest(digest: WeeklyDigest): WeeklyDigestType {
    return {
      week: digest.week,
      summary: digest.summary,
      completed: digest.completed,
      newItems: digest.newItems,
      newAtRisk: digest.newAtRisk,
      newBlocked: digest.newBlocked,
      achievements: digest.achievements,
      concerns: digest.concerns,
      comparison: this.transformWeekComparison(digest.comparison),
      generatedAt: digest.generatedAt,
    };
  }

  /**
   * Generate mock AI response based on question keywords
   */
  private generateMockAIResponse(question: string, workItems: import('@wt-ros/common').IWorkItem[]): string {
    const lowerQuestion = question.toLowerCase();

    // Calculate some basic stats
    const blocked = workItems.filter((i) => i.status === WorkStatus.BLOCKED).length;
    const atRisk = workItems.filter((i) => i.atRisk).length;
    const completed = workItems.filter((i) => i.status === WorkStatus.COMPLETE).length;
    const total = workItems.length;

    // Generate contextual responses based on keywords
    if (lowerQuestion.includes('blocked') || lowerQuestion.includes('blocker')) {
      if (blocked > 0) {
        return `There are currently ${blocked} blocked items in the portfolio. The most common causes of blocked items include dependencies on other teams, awaiting external approvals, or technical blockers. I recommend reviewing these items in the risk analysis for more details.`;
      }
      return 'Great news! There are currently no blocked items in the portfolio.';
    }

    if (lowerQuestion.includes('risk') || lowerQuestion.includes('risky')) {
      if (atRisk > 0) {
        return `There are ${atRisk} items currently flagged as at risk. These items may miss their target dates and require attention. Common risk factors include overdue dates, red health status, and lack of recent activity.`;
      }
      return 'The portfolio is in good shape with no items currently at risk.';
    }

    if (lowerQuestion.includes('progress') || lowerQuestion.includes('complete')) {
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return `The portfolio has a ${completionRate}% completion rate with ${completed} items completed out of ${total} total items. There are currently ${workItems.filter((i) => i.status === WorkStatus.IN_PROGRESS).length} items in progress.`;
    }

    if (lowerQuestion.includes('urgent') || lowerQuestion.includes('priority')) {
      const p0Items = workItems.filter((i) => i.priority === Priority.P0 && i.status !== WorkStatus.COMPLETE);
      const p1Items = workItems.filter((i) => i.priority === Priority.P1 && i.status !== WorkStatus.COMPLETE);
      return `There are ${p0Items.length} active P0 items and ${p1Items.length} active P1 items that should be prioritized. I recommend focusing on any P0 items that are blocked or have red health status first.`;
    }

    if (lowerQuestion.includes('health') || lowerQuestion.includes('status')) {
      const green = workItems.filter((i) => i.health === HealthStatus.GREEN).length;
      const yellow = workItems.filter((i) => i.health === HealthStatus.YELLOW).length;
      const red = workItems.filter((i) => i.health === HealthStatus.RED).length;
      return `Health distribution: ${green} items are green, ${yellow} are yellow, and ${red} are red. ${red > 0 ? 'I recommend reviewing the red items as they indicate significant issues.' : 'The overall health looks good!'}`;
    }

    // Default response
    return `Based on the current portfolio of ${total} work items: ${completed} are complete (${Math.round((completed / total) * 100)}%), ${blocked} are blocked, and ${atRisk} are at risk. For more specific insights, try asking about blocked items, risks, progress, priorities, or health status.`;
  }
}
