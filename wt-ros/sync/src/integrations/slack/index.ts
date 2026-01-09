/**
 * Slack Integration Exports
 */

export { SlackClient } from './SlackClient';
export type {
  SlackConfig,
  SlackMessage,
  SlackReaction,
  SlackFile,
  SlackThread,
  SlackUser,
  SlackChannel,
} from './SlackClient';

export { SlackActivityExtractor } from './SlackActivityExtractor';
export type {
  SlackExtractionConfig,
  ExtractedSlackActivity,
  LinkedArtifact,
} from './SlackActivityExtractor';
