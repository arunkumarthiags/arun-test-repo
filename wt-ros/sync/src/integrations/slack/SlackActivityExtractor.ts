/**
 * SlackActivityExtractor - Extract relevant activity from Slack threads
 * Identifies work-related discussions and extracts structured information
 */

import { ArtifactType, IActivity, ActivityAction } from '@wt-ros/common';
import { SlackClient, SlackMessage, SlackThread, SlackUser } from './SlackClient';

export interface SlackExtractionConfig {
  /** Channel IDs to monitor */
  monitoredChannels: string[];
  /** Keywords to identify work-related threads */
  workKeywords: string[];
  /** Minimum thread length to consider */
  minThreadLength: number;
  /** Include threads with these reaction emojis */
  significantReactions: string[];
}

export interface ExtractedSlackActivity {
  activity: IActivity;
  thread: SlackThread;
  relevanceScore: number;
  matchedKeywords: string[];
  linkedArtifacts: LinkedArtifact[];
}

export interface LinkedArtifact {
  type: ArtifactType;
  url: string;
  title?: string;
}

const DEFAULT_CONFIG: SlackExtractionConfig = {
  monitoredChannels: [],
  workKeywords: [
    'working on',
    'completed',
    'shipped',
    'launched',
    'blocked',
    'blocker',
    'update',
    'progress',
    'done',
    'finished',
    'started',
    'deployed',
    'merged',
    'PR',
    'pull request',
    'review',
    'feedback',
    'milestone',
    'deadline',
    'ETA',
    'status',
  ],
  minThreadLength: 2,
  significantReactions: [
    'white_check_mark',
    'heavy_check_mark',
    'rocket',
    'tada',
    'warning',
    'rotating_light',
    'eyes',
    'thumbsup',
    '+1',
  ],
};

const URL_PATTERNS = {
  github_pr: /github\.com\/[\w-]+\/[\w-]+\/pull\/\d+/gi,
  github_issue: /github\.com\/[\w-]+\/[\w-]+\/issues\/\d+/gi,
  jira: /[A-Z]+-\d+/g,
  gdocs: /docs\.google\.com\/document\/d\/[\w-]+/gi,
  figma: /figma\.com\/file\/[\w-]+/gi,
  confluence: /confluence\.[^/]+\/wiki\/[\w-]+/gi,
};

export class SlackActivityExtractor {
  private config: SlackExtractionConfig;
  private userCache: Map<string, SlackUser> = new Map();

  constructor(
    private client: SlackClient,
    config: Partial<SlackExtractionConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract activities from channels within a time range
   */
  async extractActivities(
    startDate: Date,
    endDate: Date,
    channels?: string[]
  ): Promise<ExtractedSlackActivity[]> {
    const targetChannels = channels ?? this.config.monitoredChannels;
    const activities: ExtractedSlackActivity[] = [];

    for (const channelId of targetChannels) {
      try {
        const channelActivities = await this.extractFromChannel(
          channelId,
          startDate,
          endDate
        );
        activities.push(...channelActivities);
      } catch (error) {
        console.error(`[SlackActivityExtractor] Error extracting from channel ${channelId}:`, error);
      }
    }

    // Sort by relevance score descending
    return activities.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract activities from a specific channel
   */
  async extractFromChannel(
    channelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExtractedSlackActivity[]> {
    const messages = await this.client.getChannelMessages(
      channelId,
      startDate,
      endDate,
      200
    );

    const activities: ExtractedSlackActivity[] = [];

    // Find thread parents (messages with replies)
    const threadParents = messages.filter(
      (msg) => msg.threadTs === msg.ts || !msg.threadTs
    );

    for (const parent of threadParents) {
      try {
        const thread = await this.client.getThread(channelId, parent.ts);

        if (thread.replyCount < this.config.minThreadLength - 1) {
          continue;
        }

        const extracted = await this.processThread(thread);
        if (extracted && extracted.relevanceScore > 0) {
          activities.push(extracted);
        }
      } catch (error) {
        // Skip threads that can't be fetched
        continue;
      }
    }

    return activities;
  }

  /**
   * Search for threads related to a specific work item
   */
  async searchForWorkItem(
    workItemTitle: string,
    workItemId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ExtractedSlackActivity[]> {
    const activities: ExtractedSlackActivity[] = [];

    // Search for mentions of the work item
    const searchQueries = [
      workItemTitle,
      workItemId,
      // Common variations
      workItemTitle.split(' ').slice(0, 3).join(' '),
    ];

    for (const query of searchQueries) {
      try {
        const messages = await this.client.searchMessages(query, { count: 20 });

        for (const msg of messages) {
          // Check date range if specified
          const msgDate = new Date(parseFloat(msg.ts) * 1000);
          if (startDate && msgDate < startDate) continue;
          if (endDate && msgDate > endDate) continue;

          if (msg.threadTs) {
            try {
              const thread = await this.client.getThread(msg.channel, msg.threadTs);
              const extracted = await this.processThread(thread);
              if (extracted) {
                // Boost relevance for direct matches
                extracted.relevanceScore += 0.3;
                activities.push(extracted);
              }
            } catch {
              continue;
            }
          }
        }
      } catch (error) {
        console.error(`[SlackActivityExtractor] Search error for "${query}":`, error);
      }
    }

    // Deduplicate by thread timestamp
    const seen = new Set<string>();
    return activities.filter((a) => {
      const key = `${a.thread.parentMessage.channel}-${a.thread.parentMessage.ts}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Process a thread and extract activity information
   */
  private async processThread(
    thread: SlackThread
  ): Promise<ExtractedSlackActivity | null> {
    const allText = this.getThreadText(thread);
    const matchedKeywords = this.findMatchingKeywords(allText);
    const hasSignificantReaction = this.hasSignificantReaction(thread);
    const linkedArtifacts = this.extractLinkedArtifacts(allText);

    // Calculate relevance score
    const relevanceScore = this.calculateRelevance(
      thread,
      matchedKeywords,
      hasSignificantReaction,
      linkedArtifacts
    );

    if (relevanceScore === 0) {
      return null;
    }

    // Get user info for the thread starter
    const author = await this.getUser(thread.parentMessage.user);
    const action = this.determineAction(allText);

    const activity: IActivity = {
      id: `slack-${thread.parentMessage.channel}-${thread.parentMessage.ts}`,
      workItemId: '', // To be linked later
      source: ArtifactType.SLACK_THREAD,
      action,
      actorId: thread.parentMessage.user,
      actorName: author?.realName ?? author?.name ?? 'Unknown',
      content: this.summarizeThread(thread),
      url: thread.parentMessage.permalink ?? '',
      occurredAt: new Date(parseFloat(thread.parentMessage.ts) * 1000),
      metadata: {
        channelId: thread.parentMessage.channel,
        replyCount: thread.replyCount,
        participantCount: thread.participantCount,
        lastReplyAt: thread.lastReplyAt.toISOString(),
        hasFiles: thread.parentMessage.files && thread.parentMessage.files.length > 0,
      },
    };

    return {
      activity,
      thread,
      relevanceScore,
      matchedKeywords,
      linkedArtifacts,
    };
  }

  /**
   * Get all text from a thread
   */
  private getThreadText(thread: SlackThread): string {
    const texts = [thread.parentMessage.text];
    texts.push(...thread.replies.map((r) => r.text));
    return texts.join('\n');
  }

  /**
   * Find keywords that match in the text
   */
  private findMatchingKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    return this.config.workKeywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if thread has significant reactions
   */
  private hasSignificantReaction(thread: SlackThread): boolean {
    const checkReactions = (msg: SlackMessage): boolean => {
      if (!msg.reactions) return false;
      return msg.reactions.some((r) =>
        this.config.significantReactions.includes(r.name)
      );
    };

    if (checkReactions(thread.parentMessage)) return true;
    return thread.replies.some((reply) => checkReactions(reply));
  }

  /**
   * Extract linked artifacts from text
   */
  private extractLinkedArtifacts(text: string): LinkedArtifact[] {
    const artifacts: LinkedArtifact[] = [];

    // GitHub PRs
    const prMatches = text.match(URL_PATTERNS.github_pr);
    if (prMatches) {
      for (const match of prMatches) {
        artifacts.push({
          type: ArtifactType.GITHUB_PR,
          url: match.startsWith('http') ? match : `https://${match}`,
        });
      }
    }

    // GitHub Issues
    const issueMatches = text.match(URL_PATTERNS.github_issue);
    if (issueMatches) {
      for (const match of issueMatches) {
        artifacts.push({
          type: ArtifactType.GITHUB_ISSUE,
          url: match.startsWith('http') ? match : `https://${match}`,
        });
      }
    }

    // JIRA tickets
    const jiraMatches = text.match(URL_PATTERNS.jira);
    if (jiraMatches) {
      for (const match of jiraMatches) {
        artifacts.push({
          type: ArtifactType.JIRA_TICKET,
          url: match, // Will need JIRA base URL
          title: match,
        });
      }
    }

    // Google Docs
    const docsMatches = text.match(URL_PATTERNS.gdocs);
    if (docsMatches) {
      for (const match of docsMatches) {
        artifacts.push({
          type: ArtifactType.GOOGLE_DOC,
          url: match.startsWith('http') ? match : `https://${match}`,
        });
      }
    }

    // Figma
    const figmaMatches = text.match(URL_PATTERNS.figma);
    if (figmaMatches) {
      for (const match of figmaMatches) {
        artifacts.push({
          type: ArtifactType.FIGMA_FILE,
          url: match.startsWith('http') ? match : `https://${match}`,
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return artifacts.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }

  /**
   * Calculate relevance score for a thread
   */
  private calculateRelevance(
    thread: SlackThread,
    matchedKeywords: string[],
    hasSignificantReaction: boolean,
    linkedArtifacts: LinkedArtifact[]
  ): number {
    let score = 0;

    // Keywords (up to 0.4)
    score += Math.min(matchedKeywords.length * 0.1, 0.4);

    // Significant reactions (0.2)
    if (hasSignificantReaction) {
      score += 0.2;
    }

    // Linked artifacts (up to 0.3)
    score += Math.min(linkedArtifacts.length * 0.1, 0.3);

    // Thread engagement (up to 0.1)
    if (thread.replyCount >= 5) score += 0.05;
    if (thread.participantCount >= 3) score += 0.05;

    return score;
  }

  /**
   * Determine the action type from text content
   */
  private determineAction(text: string): ActivityAction {
    const lower = text.toLowerCase();

    if (lower.includes('completed') || lower.includes('done') || lower.includes('finished')) {
      return 'closed';
    }
    if (lower.includes('merged') || lower.includes('shipped') || lower.includes('deployed')) {
      return 'merged';
    }
    if (lower.includes('review') || lower.includes('feedback')) {
      return 'commented';
    }
    if (lower.includes('started') || lower.includes('working on')) {
      return 'created';
    }
    if (lower.includes('blocked') || lower.includes('blocker')) {
      return 'updated';
    }

    return 'mentioned';
  }

  /**
   * Create a summary of the thread content
   */
  private summarizeThread(thread: SlackThread): string {
    const parts: string[] = [];

    // Parent message (truncated)
    const parentText = thread.parentMessage.text.slice(0, 200);
    parts.push(parentText);

    // Key replies (first and last if there are many)
    if (thread.replyCount > 0) {
      const firstReply = thread.replies[0]?.text.slice(0, 100);
      if (firstReply) {
        parts.push(`Reply: ${firstReply}`);
      }

      if (thread.replyCount > 2) {
        const lastReply = thread.replies[thread.replies.length - 1]?.text.slice(0, 100);
        if (lastReply) {
          parts.push(`Latest: ${lastReply}`);
        }
      }
    }

    return parts.join('\n---\n');
  }

  /**
   * Get user info with caching
   */
  private async getUser(userId: string): Promise<SlackUser | null> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    const user = await this.client.getUser(userId);
    if (user) {
      this.userCache.set(userId, user);
    }
    return user;
  }

  /**
   * Configure monitored channels
   */
  setMonitoredChannels(channelIds: string[]): void {
    this.config.monitoredChannels = channelIds;
  }

  /**
   * Add custom keywords
   */
  addWorkKeywords(keywords: string[]): void {
    this.config.workKeywords.push(...keywords);
  }
}
