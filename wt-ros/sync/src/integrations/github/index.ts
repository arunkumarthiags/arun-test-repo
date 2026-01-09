/**
 * GitHub Integration Exports
 */

export { GitHubClient } from './GitHubClient';
export type {
  GitHubConfig,
  GitHubPullRequest,
  GitHubIssue,
  GitHubComment,
  GitHubCommit,
  GitHubUser,
  GitHubReview,
  GitHubRepository,
} from './GitHubClient';

export { GitHubActivityExtractor } from './GitHubActivityExtractor';
export type {
  GitHubExtractionConfig,
  ExtractedGitHubActivity,
} from './GitHubActivityExtractor';
