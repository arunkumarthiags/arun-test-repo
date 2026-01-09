/**
 * WorkUpdateAgent - AI-powered synthesis engine for auto-generating work updates
 *
 * Features:
 * - Cross-references Slack threads with GitHub PRs
 * - Auto-drafts weekly status updates
 * - Identifies "stale" risks
 * - Uses LLM for content synthesis
 */
import Anthropic from '@anthropic-ai/sdk';

import {
  IWorkItem,
  IWorkUpdate,
  IArtifact,
  ArtifactType,
  HealthStatus,
} from '@wt-ros/common';
import { SlackActivityExtractor, SlackActivity } from '../integrations/slack';
import { GitHubActivityExtractor, GitHubActivity } from '../integrations/github';

// ============================================
// TYPES
// ============================================

export interface ActivitySummary {
  workItemId: string;
  slackActivities: SlackActivity[];
  githubActivities: GitHubActivity[];
  lastActivityAt: Date | null;
  totalActivityCount: number;
}

export interface SynthesisResult {
  workItemId: string;
  suggestedUpdate: string;
  confidence: number;
  risks: RiskFlag[];
  sources: string[];
}

export interface RiskFlag {
  type: 'STALE' | 'DATE_SLIP' | 'NO_UPDATE' | 'REPEATED_UPDATE' | 'BLOCKED';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface WorkUpdateAgentConfig {
  anthropicApiKey?: string;
  slackBotToken?: string;
  githubToken?: string;
  staleDaysThreshold?: number;
}

// ============================================
// PROMPTS
// ============================================

const SYNTHESIS_PROMPT = `You are an AI assistant helping to draft weekly work status updates for a technology organization.

Given the following context about a work item and its recent activity, generate a concise, professional status update.

Work Item:
- Title: {title}
- Description: {description}
- Current Status: {status}
- Current Health: {health}
- Target Date: {targetDate}

Recent Activity:
{activitySummary}

Guidelines:
1. Be concise (2-4 sentences max)
2. Focus on progress made and next steps
3. Highlight any blockers or risks
4. Use specific details from the activity
5. Avoid jargon and be clear for executives
6. If there's minimal activity, acknowledge it honestly

Generate the update:`;

const RISK_ANALYSIS_PROMPT = `Analyze the following work item for potential risks:

Work Item:
- Title: {title}
- Status: {status}
- Health: {health}
- Target Date: {targetDate}
- Days Since Last Activity: {daysSinceActivity}
- Recent Updates: {recentUpdates}

Identify any of these risk patterns:
1. STALE - No meaningful activity for extended period
2. DATE_SLIP - Target date appears at risk
3. BLOCKED - Work appears blocked
4. LOW_SIGNAL - Updates lack substance

Return a JSON array of risks found, or empty array if none.
Format: [{"type": "RISK_TYPE", "message": "explanation", "severity": "low|medium|high"}]`;

// ============================================
// AGENT IMPLEMENTATION
// ============================================

export class WorkUpdateAgent {
  private anthropic: Anthropic | null = null;
  private slackExtractor: SlackActivityExtractor | null = null;
  private githubExtractor: GitHubActivityExtractor | null = null;
  private staleDaysThreshold: number;

  constructor(config: WorkUpdateAgentConfig = {}) {
    this.staleDaysThreshold = config.staleDaysThreshold ?? 7;

    // Initialize Anthropic client if API key provided
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }

    // Initialize integrations
    if (config.slackBotToken) {
      this.slackExtractor = new SlackActivityExtractor(config.slackBotToken);
    }

    if (config.githubToken) {
      this.githubExtractor = new GitHubActivityExtractor(config.githubToken);
    }
  }

  /**
   * Gather all activity for a work item from connected sources
   */
  async gatherActivity(workItem: IWorkItem): Promise<ActivitySummary> {
    const slackActivities: SlackActivity[] = [];
    const githubActivities: GitHubActivity[] = [];

    // Extract Slack activity from linked artifacts
    if (this.slackExtractor) {
      const slackArtifacts = workItem.artifacts.filter(
        (a) => a.type === ArtifactType.SLACK_THREAD
      );

      for (const artifact of slackArtifacts) {
        try {
          const activities = await this.slackExtractor.extractFromThread(
            artifact.url
          );
          slackActivities.push(...activities);
        } catch (error) {
          console.error(`Failed to extract Slack activity from ${artifact.url}:`, error);
        }
      }
    }

    // Extract GitHub activity from linked artifacts
    if (this.githubExtractor) {
      const githubArtifacts = workItem.artifacts.filter(
        (a) =>
          a.type === ArtifactType.GITHUB_PR ||
          a.type === ArtifactType.GITHUB_ISSUE
      );

      for (const artifact of githubArtifacts) {
        try {
          const activities = await this.githubExtractor.extractFromUrl(
            artifact.url
          );
          githubActivities.push(...activities);
        } catch (error) {
          console.error(`Failed to extract GitHub activity from ${artifact.url}:`, error);
        }
      }
    }

    // Calculate last activity time
    const allDates = [
      ...slackActivities.map((a) => a.timestamp),
      ...githubActivities.map((a) => a.timestamp),
    ];
    const lastActivityAt = allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : null;

    return {
      workItemId: workItem.id,
      slackActivities,
      githubActivities,
      lastActivityAt,
      totalActivityCount: slackActivities.length + githubActivities.length,
    };
  }

  /**
   * Generate an AI-synthesized update for a work item
   */
  async synthesizeUpdate(
    workItem: IWorkItem,
    activity?: ActivitySummary
  ): Promise<SynthesisResult> {
    // Gather activity if not provided
    const activitySummary = activity || (await this.gatherActivity(workItem));

    // Build activity summary text
    const activityText = this.buildActivityText(activitySummary);

    // If no LLM available, use template-based generation
    if (!this.anthropic) {
      return this.generateTemplateUpdate(workItem, activitySummary);
    }

    // Prepare the prompt
    const prompt = SYNTHESIS_PROMPT
      .replace('{title}', workItem.title)
      .replace('{description}', workItem.description || 'No description')
      .replace('{status}', workItem.status)
      .replace('{health}', workItem.health)
      .replace(
        '{targetDate}',
        workItem.targetDate
          ? new Date(workItem.targetDate).toLocaleDateString()
          : 'Not set'
      )
      .replace('{activitySummary}', activityText);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const suggestedUpdate =
        response.content[0].type === 'text' ? response.content[0].text : '';

      // Analyze for risks
      const risks = await this.analyzeRisks(workItem, activitySummary);

      return {
        workItemId: workItem.id,
        suggestedUpdate: suggestedUpdate.trim(),
        confidence: this.calculateConfidence(activitySummary),
        risks,
        sources: this.extractSources(activitySummary),
      };
    } catch (error) {
      console.error('Failed to synthesize update:', error);
      return this.generateTemplateUpdate(workItem, activitySummary);
    }
  }

  /**
   * Analyze work item for risks
   */
  async analyzeRisks(
    workItem: IWorkItem,
    activity: ActivitySummary
  ): Promise<RiskFlag[]> {
    const risks: RiskFlag[] = [];

    // Check for staleness
    const daysSinceActivity = activity.lastActivityAt
      ? Math.floor(
          (Date.now() - activity.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    if (daysSinceActivity > this.staleDaysThreshold) {
      risks.push({
        type: 'STALE',
        message: `No activity detected for ${daysSinceActivity} days`,
        severity: daysSinceActivity > 14 ? 'high' : 'medium',
      });
    }

    // Check for date slip risk
    if (workItem.targetDate) {
      const daysUntilTarget = Math.floor(
        (new Date(workItem.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilTarget < 0) {
        risks.push({
          type: 'DATE_SLIP',
          message: `Target date was ${Math.abs(daysUntilTarget)} days ago`,
          severity: 'high',
        });
      } else if (daysUntilTarget < 7 && activity.totalActivityCount === 0) {
        risks.push({
          type: 'DATE_SLIP',
          message: `Target date in ${daysUntilTarget} days but no recent activity`,
          severity: 'medium',
        });
      }
    }

    // Check for blocked status
    if (workItem.status === 'BLOCKED') {
      risks.push({
        type: 'BLOCKED',
        message: 'Work item is marked as blocked',
        severity: 'high',
      });
    }

    return risks;
  }

  /**
   * Batch process multiple work items
   */
  async processBatch(workItems: IWorkItem[]): Promise<SynthesisResult[]> {
    const results: SynthesisResult[] = [];

    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < workItems.length; i += batchSize) {
      const batch = workItems.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item) => this.synthesizeUpdate(item))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check if a work item needs attention based on risk analysis
   */
  async needsAttention(workItem: IWorkItem): Promise<boolean> {
    const activity = await this.gatherActivity(workItem);
    const risks = await this.analyzeRisks(workItem, activity);

    return risks.some((r) => r.severity === 'high');
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private buildActivityText(activity: ActivitySummary): string {
    const lines: string[] = [];

    if (activity.slackActivities.length > 0) {
      lines.push('Slack Activity:');
      activity.slackActivities.slice(0, 5).forEach((a) => {
        lines.push(`- ${a.author}: ${a.content.slice(0, 100)}...`);
      });
    }

    if (activity.githubActivities.length > 0) {
      lines.push('\nGitHub Activity:');
      activity.githubActivities.slice(0, 5).forEach((a) => {
        lines.push(`- ${a.author} ${a.action}: ${a.title}`);
      });
    }

    if (lines.length === 0) {
      lines.push('No recent activity detected from connected sources.');
    }

    return lines.join('\n');
  }

  private generateTemplateUpdate(
    workItem: IWorkItem,
    activity: ActivitySummary
  ): SynthesisResult {
    let update: string;

    if (activity.totalActivityCount === 0) {
      update = `${workItem.title} - No recent activity to report. Status remains ${workItem.status.toLowerCase().replace('_', ' ')}.`;
    } else {
      const activityTypes: string[] = [];
      if (activity.slackActivities.length > 0) {
        activityTypes.push(`${activity.slackActivities.length} Slack messages`);
      }
      if (activity.githubActivities.length > 0) {
        activityTypes.push(`${activity.githubActivities.length} GitHub activities`);
      }

      update = `${workItem.title} - Recent activity includes ${activityTypes.join(' and ')}. Work is currently ${workItem.status.toLowerCase().replace('_', ' ')}.`;
    }

    return {
      workItemId: workItem.id,
      suggestedUpdate: update,
      confidence: 0.5, // Lower confidence for template
      risks: [],
      sources: this.extractSources(activity),
    };
  }

  private calculateConfidence(activity: ActivitySummary): number {
    // Higher activity = higher confidence
    const activityScore = Math.min(activity.totalActivityCount / 10, 1);

    // Recency bonus
    const recencyScore = activity.lastActivityAt
      ? Math.max(
          0,
          1 -
            (Date.now() - activity.lastActivityAt.getTime()) /
              (7 * 24 * 60 * 60 * 1000)
        )
      : 0;

    return Math.min(0.95, 0.5 + activityScore * 0.3 + recencyScore * 0.2);
  }

  private extractSources(activity: ActivitySummary): string[] {
    const sources: string[] = [];

    activity.slackActivities.forEach((a) => {
      if (a.url && !sources.includes(a.url)) {
        sources.push(a.url);
      }
    });

    activity.githubActivities.forEach((a) => {
      if (a.url && !sources.includes(a.url)) {
        sources.push(a.url);
      }
    });

    return sources;
  }
}

export default WorkUpdateAgent;
