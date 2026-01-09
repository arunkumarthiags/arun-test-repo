/**
 * GitHubClient - Octokit integration for WT-ROS
 * Provides connectivity to GitHub for PR/Issue activity extraction
 */

import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  token: string;
  baseUrl?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  url: string;
  htmlUrl: string;
  author: GitHubUser;
  assignees: GitHubUser[];
  reviewers: GitHubUser[];
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  comments: number;
  reviewComments: number;
  baseBranch: string;
  headBranch: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  url: string;
  htmlUrl: string;
  author: GitHubUser;
  assignees: GitHubUser[];
  labels: string[];
  milestone: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  comments: number;
}

export interface GitHubComment {
  id: number;
  body: string;
  author: GitHubUser;
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  url: string;
  additions: number;
  deletions: number;
  filesChanged: string[];
}

export interface GitHubUser {
  id: number;
  login: string;
  avatarUrl: string;
  url: string;
}

export interface GitHubReview {
  id: number;
  user: GitHubUser;
  body: string | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  submittedAt: Date;
  url: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export class GitHubClient {
  private octokit: Octokit;
  private initialized: boolean = false;
  private authenticatedUser: GitHubUser | null = null;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Initialize and verify authentication
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      this.authenticatedUser = {
        id: user.id,
        login: user.login,
        avatarUrl: user.avatar_url,
        url: user.html_url,
      };
      console.log(`[GitHubClient] Authenticated as: ${user.login}`);
      this.initialized = true;
    } catch (error) {
      throw new Error(`[GitHubClient] Failed to initialize: ${error}`);
    }
  }

  /**
   * Get a pull request by number
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubPullRequest> {
    await this.ensureInitialized();

    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return this.mapPullRequest(pr);
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'created' | 'updated' | 'popularity' | 'long-running';
      direction?: 'asc' | 'desc';
      perPage?: number;
      since?: Date;
    } = {}
  ): Promise<GitHubPullRequest[]> {
    await this.ensureInitialized();

    const { data: prs } = await this.octokit.pulls.list({
      owner,
      repo,
      state: options.state ?? 'all',
      sort: options.sort ?? 'updated',
      direction: options.direction ?? 'desc',
      per_page: options.perPage ?? 30,
    });

    let filtered = prs;
    if (options.since) {
      filtered = prs.filter(
        (pr) => new Date(pr.updated_at) >= options.since!
      );
    }

    return filtered.map((pr) => this.mapPullRequest(pr));
  }

  /**
   * Get an issue by number
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
    await this.ensureInitialized();

    const { data: issue } = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return this.mapIssue(issue);
  }

  /**
   * Get issues for a repository
   */
  async getIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      perPage?: number;
      since?: Date;
      labels?: string[];
      assignee?: string;
    } = {}
  ): Promise<GitHubIssue[]> {
    await this.ensureInitialized();

    const { data: issues } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: options.state ?? 'all',
      sort: options.sort ?? 'updated',
      direction: options.direction ?? 'desc',
      per_page: options.perPage ?? 30,
      since: options.since?.toISOString(),
      labels: options.labels?.join(','),
      assignee: options.assignee,
    });

    // Filter out pull requests (GitHub API returns PRs as issues)
    const actualIssues = issues.filter((issue) => !issue.pull_request);

    return actualIssues.map((issue) => this.mapIssue(issue));
  }

  /**
   * Get comments for an issue or PR
   */
  async getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    since?: Date
  ): Promise<GitHubComment[]> {
    await this.ensureInitialized();

    const { data: comments } = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      since: since?.toISOString(),
      per_page: 100,
    });

    return comments.map((comment) => ({
      id: comment.id,
      body: comment.body ?? '',
      author: {
        id: comment.user?.id ?? 0,
        login: comment.user?.login ?? 'unknown',
        avatarUrl: comment.user?.avatar_url ?? '',
        url: comment.user?.html_url ?? '',
      },
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.updated_at),
      url: comment.html_url,
    }));
  }

  /**
   * Get review comments for a PR
   */
  async getPullRequestReviewComments(
    owner: string,
    repo: string,
    pullNumber: number,
    since?: Date
  ): Promise<GitHubComment[]> {
    await this.ensureInitialized();

    const { data: comments } = await this.octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      since: since?.toISOString(),
      per_page: 100,
    });

    return comments.map((comment) => ({
      id: comment.id,
      body: comment.body ?? '',
      author: {
        id: comment.user?.id ?? 0,
        login: comment.user?.login ?? 'unknown',
        avatarUrl: comment.user?.avatar_url ?? '',
        url: comment.user?.html_url ?? '',
      },
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.updated_at),
      url: comment.html_url,
    }));
  }

  /**
   * Get reviews for a PR
   */
  async getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubReview[]> {
    await this.ensureInitialized();

    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return reviews.map((review) => ({
      id: review.id,
      user: {
        id: review.user?.id ?? 0,
        login: review.user?.login ?? 'unknown',
        avatarUrl: review.user?.avatar_url ?? '',
        url: review.user?.html_url ?? '',
      },
      body: review.body ?? null,
      state: review.state as GitHubReview['state'],
      submittedAt: review.submitted_at
        ? new Date(review.submitted_at)
        : new Date(),
      url: review.html_url,
    }));
  }

  /**
   * Get commits for a PR
   */
  async getPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubCommit[]> {
    await this.ensureInitialized();

    const { data: commits } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return commits.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name ?? 'unknown',
        email: commit.commit.author?.email ?? '',
        date: new Date(commit.commit.author?.date ?? Date.now()),
      },
      url: commit.html_url,
      additions: 0, // Would need separate API call per commit
      deletions: 0,
      filesChanged: [],
    }));
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    await this.ensureInitialized();

    const { data: repository } = await this.octokit.repos.get({
      owner,
      repo,
    });

    return {
      owner: repository.owner.login,
      repo: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
      isPrivate: repository.private,
    };
  }

  /**
   * Search for issues/PRs across repositories
   */
  async searchIssuesAndPRs(
    query: string,
    options: { perPage?: number; sort?: 'created' | 'updated' | 'comments' } = {}
  ): Promise<{ issues: GitHubIssue[]; pullRequests: GitHubPullRequest[] }> {
    await this.ensureInitialized();

    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: query,
      per_page: options.perPage ?? 30,
      sort: options.sort ?? 'updated',
    });

    const issues: GitHubIssue[] = [];
    const pullRequests: GitHubPullRequest[] = [];

    for (const item of data.items) {
      if (item.pull_request) {
        // It's a PR - need to fetch full PR data
        const [owner, repo] = item.repository_url.split('/').slice(-2);
        try {
          const pr = await this.getPullRequest(owner, repo, item.number);
          pullRequests.push(pr);
        } catch {
          // Skip if we can't fetch
        }
      } else {
        issues.push(this.mapIssue(item));
      }
    }

    return { issues, pullRequests };
  }

  /**
   * Get authenticated user
   */
  getAuthenticatedUser(): GitHubUser | null {
    return this.authenticatedUser;
  }

  /**
   * Get underlying Octokit instance
   */
  getOctokit(): Octokit {
    return this.octokit;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private mapPullRequest(pr: Record<string, unknown>): GitHubPullRequest {
    const prData = pr as {
      id: number;
      number: number;
      title: string;
      body: string | null;
      state: string;
      merged: boolean;
      draft: boolean;
      url: string;
      html_url: string;
      user: { id: number; login: string; avatar_url: string; html_url: string } | null;
      assignees: Array<{ id: number; login: string; avatar_url: string; html_url: string }> | null;
      requested_reviewers: Array<{ id: number; login: string; avatar_url: string; html_url: string }> | null;
      labels: Array<{ name: string }>;
      created_at: string;
      updated_at: string;
      merged_at: string | null;
      closed_at: string | null;
      additions: number;
      deletions: number;
      changed_files: number;
      commits: number;
      comments: number;
      review_comments: number;
      base: { ref: string };
      head: { ref: string };
    };

    return {
      id: prData.id,
      number: prData.number,
      title: prData.title,
      body: prData.body,
      state: prData.state as 'open' | 'closed',
      merged: prData.merged ?? false,
      draft: prData.draft ?? false,
      url: prData.url,
      htmlUrl: prData.html_url,
      author: {
        id: prData.user?.id ?? 0,
        login: prData.user?.login ?? 'unknown',
        avatarUrl: prData.user?.avatar_url ?? '',
        url: prData.user?.html_url ?? '',
      },
      assignees: (prData.assignees ?? []).map((a) => ({
        id: a.id,
        login: a.login,
        avatarUrl: a.avatar_url,
        url: a.html_url,
      })),
      reviewers: (prData.requested_reviewers ?? []).map((r) => ({
        id: r.id,
        login: r.login,
        avatarUrl: r.avatar_url,
        url: r.html_url,
      })),
      labels: prData.labels.map((l) => l.name),
      createdAt: new Date(prData.created_at),
      updatedAt: new Date(prData.updated_at),
      mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
      closedAt: prData.closed_at ? new Date(prData.closed_at) : null,
      additions: prData.additions ?? 0,
      deletions: prData.deletions ?? 0,
      changedFiles: prData.changed_files ?? 0,
      commits: prData.commits ?? 0,
      comments: prData.comments ?? 0,
      reviewComments: prData.review_comments ?? 0,
      baseBranch: prData.base?.ref ?? '',
      headBranch: prData.head?.ref ?? '',
    };
  }

  private mapIssue(issue: Record<string, unknown>): GitHubIssue {
    const issueData = issue as {
      id: number;
      number: number;
      title: string;
      body: string | null;
      state: string;
      url: string;
      html_url: string;
      user: { id: number; login: string; avatar_url: string; html_url: string } | null;
      assignees: Array<{ id: number; login: string; avatar_url: string; html_url: string }> | null;
      labels: Array<{ name: string }>;
      milestone: { title: string } | null;
      created_at: string;
      updated_at: string;
      closed_at: string | null;
      comments: number;
    };

    return {
      id: issueData.id,
      number: issueData.number,
      title: issueData.title,
      body: issueData.body,
      state: issueData.state as 'open' | 'closed',
      url: issueData.url,
      htmlUrl: issueData.html_url,
      author: {
        id: issueData.user?.id ?? 0,
        login: issueData.user?.login ?? 'unknown',
        avatarUrl: issueData.user?.avatar_url ?? '',
        url: issueData.user?.html_url ?? '',
      },
      assignees: (issueData.assignees ?? []).map((a) => ({
        id: a.id,
        login: a.login,
        avatarUrl: a.avatar_url,
        url: a.html_url,
      })),
      labels: issueData.labels.map((l) => l.name),
      milestone: issueData.milestone?.title ?? null,
      createdAt: new Date(issueData.created_at),
      updatedAt: new Date(issueData.updated_at),
      closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
      comments: issueData.comments ?? 0,
    };
  }
}
