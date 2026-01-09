/**
 * GitHubActivityExtractor - Extract activity from GitHub PRs and Issues
 * Converts GitHub events into normalized activity format
 */

import {
  ArtifactType,
  IActivity,
  ActivityAction,
} from '@wt-ros/common';
import {
  GitHubClient,
  GitHubPullRequest,
  GitHubIssue,
  GitHubComment,
  GitHubReview,
} from './GitHubClient';

export interface GitHubExtractionConfig {
  /** Repositories to monitor (owner/repo format) */
  monitoredRepos: string[];
  /** Include draft PRs */
  includeDrafts: boolean;
  /** Include bot activity */
  includeBots: boolean;
  /** Labels to filter for work-related items */
  workLabels: string[];
}

export interface ExtractedGitHubActivity {
  activity: IActivity;
  source: GitHubPullRequest | GitHubIssue;
  sourceType: 'pr' | 'issue';
  relatedActivities: IActivity[];
}

const DEFAULT_CONFIG: GitHubExtractionConfig = {
  monitoredRepos: [],
  includeDrafts: false,
  includeBots: false,
  workLabels: [
    'feature',
    'enhancement',
    'bug',
    'priority:high',
    'priority:p0',
    'priority:p1',
    'milestone',
  ],
};

const BOT_SUFFIXES = ['[bot]', '-bot', '_bot'];

export class GitHubActivityExtractor {
  private config: GitHubExtractionConfig;

  constructor(
    private client: GitHubClient,
    config: Partial<GitHubExtractionConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract activities from all monitored repositories
   */
  async extractActivities(
    startDate: Date,
    endDate: Date,
    repos?: string[]
  ): Promise<ExtractedGitHubActivity[]> {
    const targetRepos = repos ?? this.config.monitoredRepos;
    const activities: ExtractedGitHubActivity[] = [];

    for (const repoPath of targetRepos) {
      try {
        const [owner, repo] = repoPath.split('/');
        const repoActivities = await this.extractFromRepository(
          owner,
          repo,
          startDate,
          endDate
        );
        activities.push(...repoActivities);
      } catch (error) {
        console.error(`[GitHubActivityExtractor] Error extracting from ${repoPath}:`, error);
      }
    }

    // Sort by date descending
    return activities.sort(
      (a, b) => b.activity.occurredAt.getTime() - a.activity.occurredAt.getTime()
    );
  }

  /**
   * Extract activities from a specific repository
   */
  async extractFromRepository(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExtractedGitHubActivity[]> {
    const activities: ExtractedGitHubActivity[] = [];

    // Get PRs
    const prs = await this.client.getPullRequests(owner, repo, {
      state: 'all',
      sort: 'updated',
      since: startDate,
      perPage: 50,
    });

    for (const pr of prs) {
      if (!this.shouldIncludePR(pr)) continue;
      if (pr.updatedAt < startDate || pr.updatedAt > endDate) continue;

      const extracted = await this.extractFromPullRequest(owner, repo, pr);
      activities.push(extracted);
    }

    // Get Issues
    const issues = await this.client.getIssues(owner, repo, {
      state: 'all',
      sort: 'updated',
      since: startDate,
      perPage: 50,
    });

    for (const issue of issues) {
      if (!this.shouldIncludeIssue(issue)) continue;
      if (issue.updatedAt < startDate || issue.updatedAt > endDate) continue;

      const extracted = await this.extractFromIssue(owner, repo, issue);
      activities.push(extracted);
    }

    return activities;
  }

  /**
   * Extract activity from a specific PR
   */
  async extractFromPullRequest(
    owner: string,
    repo: string,
    pr: GitHubPullRequest
  ): Promise<ExtractedGitHubActivity> {
    const relatedActivities: IActivity[] = [];

    // Get comments
    try {
      const comments = await this.client.getIssueComments(owner, repo, pr.number);
      for (const comment of comments) {
        if (!this.shouldIncludeUser(comment.author.login)) continue;

        relatedActivities.push({
          id: `gh-comment-${comment.id}`,
          workItemId: '',
          source: ArtifactType.GITHUB_PR,
          action: 'commented',
          actorId: String(comment.author.id),
          actorName: comment.author.login,
          content: this.truncateContent(comment.body),
          url: comment.url,
          occurredAt: comment.createdAt,
          metadata: {
            commentId: comment.id,
            prNumber: pr.number,
          },
        });
      }
    } catch {
      // Ignore comment fetch errors
    }

    // Get reviews
    try {
      const reviews = await this.client.getPullRequestReviews(owner, repo, pr.number);
      for (const review of reviews) {
        if (!this.shouldIncludeUser(review.user.login)) continue;

        relatedActivities.push({
          id: `gh-review-${review.id}`,
          workItemId: '',
          source: ArtifactType.GITHUB_PR,
          action: this.mapReviewState(review.state),
          actorId: String(review.user.id),
          actorName: review.user.login,
          content: this.truncateContent(review.body ?? ''),
          url: review.url,
          occurredAt: review.submittedAt,
          metadata: {
            reviewId: review.id,
            reviewState: review.state,
            prNumber: pr.number,
          },
        });
      }
    } catch {
      // Ignore review fetch errors
    }

    // Main PR activity
    const mainAction = this.determinePRAction(pr);
    const mainActivity: IActivity = {
      id: `gh-pr-${pr.id}`,
      workItemId: '',
      source: ArtifactType.GITHUB_PR,
      action: mainAction,
      actorId: String(pr.author.id),
      actorName: pr.author.login,
      content: this.createPRSummary(pr),
      url: pr.htmlUrl,
      occurredAt: this.getPRActivityDate(pr, mainAction),
      metadata: {
        prNumber: pr.number,
        state: pr.state,
        merged: pr.merged,
        draft: pr.draft,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        commits: pr.commits,
        labels: pr.labels,
        baseBranch: pr.baseBranch,
        headBranch: pr.headBranch,
        reviewers: pr.reviewers.map((r) => r.login),
        assignees: pr.assignees.map((a) => a.login),
      },
    };

    return {
      activity: mainActivity,
      source: pr,
      sourceType: 'pr',
      relatedActivities,
    };
  }

  /**
   * Extract activity from a specific issue
   */
  async extractFromIssue(
    owner: string,
    repo: string,
    issue: GitHubIssue
  ): Promise<ExtractedGitHubActivity> {
    const relatedActivities: IActivity[] = [];

    // Get comments
    try {
      const comments = await this.client.getIssueComments(owner, repo, issue.number);
      for (const comment of comments) {
        if (!this.shouldIncludeUser(comment.author.login)) continue;

        relatedActivities.push({
          id: `gh-comment-${comment.id}`,
          workItemId: '',
          source: ArtifactType.GITHUB_ISSUE,
          action: 'commented',
          actorId: String(comment.author.id),
          actorName: comment.author.login,
          content: this.truncateContent(comment.body),
          url: comment.url,
          occurredAt: comment.createdAt,
          metadata: {
            commentId: comment.id,
            issueNumber: issue.number,
          },
        });
      }
    } catch {
      // Ignore comment fetch errors
    }

    // Main issue activity
    const mainAction = this.determineIssueAction(issue);
    const mainActivity: IActivity = {
      id: `gh-issue-${issue.id}`,
      workItemId: '',
      source: ArtifactType.GITHUB_ISSUE,
      action: mainAction,
      actorId: String(issue.author.id),
      actorName: issue.author.login,
      content: this.createIssueSummary(issue),
      url: issue.htmlUrl,
      occurredAt: this.getIssueActivityDate(issue, mainAction),
      metadata: {
        issueNumber: issue.number,
        state: issue.state,
        labels: issue.labels,
        milestone: issue.milestone,
        assignees: issue.assignees.map((a) => a.login),
        commentCount: issue.comments,
      },
    };

    return {
      activity: mainActivity,
      source: issue,
      sourceType: 'issue',
      relatedActivities,
    };
  }

  /**
   * Search for activities related to a work item
   */
  async searchForWorkItem(
    workItemTitle: string,
    options: {
      repos?: string[];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ExtractedGitHubActivity[]> {
    const activities: ExtractedGitHubActivity[] = [];

    // Search GitHub for related PRs/issues
    const searchQuery = this.buildSearchQuery(workItemTitle, options.repos);
    const { issues, pullRequests } = await this.client.searchIssuesAndPRs(
      searchQuery,
      { perPage: 20 }
    );

    for (const pr of pullRequests) {
      if (options.startDate && pr.updatedAt < options.startDate) continue;
      if (options.endDate && pr.updatedAt > options.endDate) continue;

      const [owner, repo] = this.extractOwnerRepo(pr.htmlUrl);
      const extracted = await this.extractFromPullRequest(owner, repo, pr);
      activities.push(extracted);
    }

    for (const issue of issues) {
      if (options.startDate && issue.updatedAt < options.startDate) continue;
      if (options.endDate && issue.updatedAt > options.endDate) continue;

      const [owner, repo] = this.extractOwnerRepo(issue.htmlUrl);
      const extracted = await this.extractFromIssue(owner, repo, issue);
      activities.push(extracted);
    }

    return activities;
  }

  /**
   * Get PR/Issue by URL
   */
  async getByUrl(url: string): Promise<ExtractedGitHubActivity | null> {
    const prMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (prMatch) {
      const [, owner, repo, number] = prMatch;
      const pr = await this.client.getPullRequest(owner, repo, parseInt(number));
      return this.extractFromPullRequest(owner, repo, pr);
    }

    const issueMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (issueMatch) {
      const [, owner, repo, number] = issueMatch;
      const issue = await this.client.getIssue(owner, repo, parseInt(number));
      return this.extractFromIssue(owner, repo, issue);
    }

    return null;
  }

  /**
   * Configure monitored repositories
   */
  setMonitoredRepos(repos: string[]): void {
    this.config.monitoredRepos = repos;
  }

  /**
   * Add work labels
   */
  addWorkLabels(labels: string[]): void {
    this.config.workLabels.push(...labels);
  }

  private shouldIncludePR(pr: GitHubPullRequest): boolean {
    if (!this.config.includeDrafts && pr.draft) return false;
    if (!this.shouldIncludeUser(pr.author.login)) return false;
    return true;
  }

  private shouldIncludeIssue(issue: GitHubIssue): boolean {
    if (!this.shouldIncludeUser(issue.author.login)) return false;
    return true;
  }

  private shouldIncludeUser(login: string): boolean {
    if (this.config.includeBots) return true;
    return !BOT_SUFFIXES.some((suffix) => login.toLowerCase().endsWith(suffix));
  }

  private determinePRAction(pr: GitHubPullRequest): ActivityAction {
    if (pr.merged) return 'merged';
    if (pr.state === 'closed') return 'closed';
    if (pr.state === 'open' && pr.createdAt.getTime() === pr.updatedAt.getTime()) {
      return 'created';
    }
    return 'updated';
  }

  private determineIssueAction(issue: GitHubIssue): ActivityAction {
    if (issue.state === 'closed') return 'closed';
    if (issue.createdAt.getTime() === issue.updatedAt.getTime()) {
      return 'created';
    }
    return 'updated';
  }

  private mapReviewState(state: string): ActivityAction {
    switch (state) {
      case 'APPROVED':
        return 'updated';
      case 'CHANGES_REQUESTED':
        return 'commented';
      case 'COMMENTED':
        return 'commented';
      default:
        return 'updated';
    }
  }

  private getPRActivityDate(pr: GitHubPullRequest, action: ActivityAction): Date {
    if (action === 'merged' && pr.mergedAt) return pr.mergedAt;
    if (action === 'closed' && pr.closedAt) return pr.closedAt;
    if (action === 'created') return pr.createdAt;
    return pr.updatedAt;
  }

  private getIssueActivityDate(issue: GitHubIssue, action: ActivityAction): Date {
    if (action === 'closed' && issue.closedAt) return issue.closedAt;
    if (action === 'created') return issue.createdAt;
    return issue.updatedAt;
  }

  private createPRSummary(pr: GitHubPullRequest): string {
    const parts: string[] = [pr.title];

    if (pr.body) {
      parts.push(this.truncateContent(pr.body, 300));
    }

    const stats = [];
    if (pr.additions > 0) stats.push(`+${pr.additions}`);
    if (pr.deletions > 0) stats.push(`-${pr.deletions}`);
    if (pr.changedFiles > 0) stats.push(`${pr.changedFiles} files`);
    if (stats.length > 0) {
      parts.push(`Changes: ${stats.join(', ')}`);
    }

    return parts.join('\n');
  }

  private createIssueSummary(issue: GitHubIssue): string {
    const parts: string[] = [issue.title];

    if (issue.body) {
      parts.push(this.truncateContent(issue.body, 300));
    }

    if (issue.labels.length > 0) {
      parts.push(`Labels: ${issue.labels.join(', ')}`);
    }

    return parts.join('\n');
  }

  private truncateContent(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength - 3) + '...';
  }

  private buildSearchQuery(title: string, repos?: string[]): string {
    let query = title;

    if (repos && repos.length > 0) {
      const repoFilter = repos.map((r) => `repo:${r}`).join(' ');
      query = `${query} ${repoFilter}`;
    }

    return query;
  }

  private extractOwnerRepo(htmlUrl: string): [string, string] {
    const match = htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      return [match[1], match[2]];
    }
    return ['', ''];
  }
}
