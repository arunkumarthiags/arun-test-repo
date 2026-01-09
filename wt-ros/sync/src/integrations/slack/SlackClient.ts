/**
 * SlackClient - @slack/bolt integration for WT-ROS
 * Provides connectivity to Slack workspace for activity extraction
 */

import { App, LogLevel } from '@slack/bolt';

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  appToken?: string;
  logLevel?: LogLevel;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  channel: string;
  threadTs?: string;
  reactions?: SlackReaction[];
  files?: SlackFile[];
  permalink?: string;
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url: string;
}

export interface SlackThread {
  parentMessage: SlackMessage;
  replies: SlackMessage[];
  replyCount: number;
  participantCount: number;
  lastReplyAt: Date;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email?: string;
  avatarUrl?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
}

export class SlackClient {
  private app: App;
  private initialized: boolean = false;

  constructor(private config: SlackConfig) {
    this.app = new App({
      token: config.botToken,
      signingSecret: config.signingSecret,
      appToken: config.appToken,
      logLevel: config.logLevel ?? LogLevel.INFO,
      socketMode: !!config.appToken,
    });
  }

  /**
   * Initialize the Slack client and verify connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await this.app.client.auth.test();
      console.log(`[SlackClient] Connected as: ${result.user}`);
      this.initialized = true;
    } catch (error) {
      throw new Error(`[SlackClient] Failed to initialize: ${error}`);
    }
  }

  /**
   * Get messages from a channel within a time range
   */
  async getChannelMessages(
    channelId: string,
    oldest?: Date,
    latest?: Date,
    limit: number = 100
  ): Promise<SlackMessage[]> {
    await this.ensureInitialized();

    const result = await this.app.client.conversations.history({
      channel: channelId,
      oldest: oldest ? String(oldest.getTime() / 1000) : undefined,
      latest: latest ? String(latest.getTime() / 1000) : undefined,
      limit,
    });

    if (!result.messages) return [];

    return Promise.all(
      result.messages.map(async (msg) => this.enrichMessage(msg, channelId))
    );
  }

  /**
   * Get a thread and all its replies
   */
  async getThread(channelId: string, threadTs: string): Promise<SlackThread> {
    await this.ensureInitialized();

    const result = await this.app.client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 200,
    });

    if (!result.messages || result.messages.length === 0) {
      throw new Error(`Thread not found: ${threadTs}`);
    }

    const [parent, ...replies] = result.messages;
    const participants = new Set<string>();

    replies.forEach((reply) => {
      if (reply.user) participants.add(reply.user);
    });

    return {
      parentMessage: await this.enrichMessage(parent, channelId),
      replies: await Promise.all(
        replies.map((reply) => this.enrichMessage(reply, channelId))
      ),
      replyCount: replies.length,
      participantCount: participants.size,
      lastReplyAt: replies.length > 0
        ? new Date(parseFloat(replies[replies.length - 1].ts!) * 1000)
        : new Date(parseFloat(parent.ts!) * 1000),
    };
  }

  /**
   * Search messages across workspace
   */
  async searchMessages(
    query: string,
    options: { count?: number; sort?: 'timestamp' | 'score' } = {}
  ): Promise<SlackMessage[]> {
    await this.ensureInitialized();

    const result = await this.app.client.search.messages({
      query,
      count: options.count ?? 50,
      sort: options.sort ?? 'timestamp',
      sort_dir: 'desc',
    });

    if (!result.messages?.matches) return [];

    return result.messages.matches.map((match) => ({
      ts: match.ts!,
      text: match.text ?? '',
      user: match.user ?? '',
      channel: match.channel?.id ?? '',
      threadTs: match.thread_ts,
      permalink: match.permalink,
    }));
  }

  /**
   * Get user information
   */
  async getUser(userId: string): Promise<SlackUser | null> {
    await this.ensureInitialized();

    try {
      const result = await this.app.client.users.info({ user: userId });

      if (!result.user) return null;

      return {
        id: result.user.id!,
        name: result.user.name ?? '',
        realName: result.user.real_name ?? result.user.name ?? '',
        email: result.user.profile?.email,
        avatarUrl: result.user.profile?.image_72,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get channel information
   */
  async getChannel(channelId: string): Promise<SlackChannel | null> {
    await this.ensureInitialized();

    try {
      const result = await this.app.client.conversations.info({
        channel: channelId,
      });

      if (!result.channel) return null;

      return {
        id: result.channel.id!,
        name: result.channel.name ?? '',
        isPrivate: result.channel.is_private ?? false,
        memberCount: result.channel.num_members ?? 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all channels the bot has access to
   */
  async getAccessibleChannels(): Promise<SlackChannel[]> {
    await this.ensureInitialized();

    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.app.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        cursor,
        limit: 200,
      });

      if (result.channels) {
        for (const channel of result.channels) {
          channels.push({
            id: channel.id!,
            name: channel.name ?? '',
            isPrivate: channel.is_private ?? false,
            memberCount: channel.num_members ?? 0,
          });
        }
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  /**
   * Post a message to a channel
   */
  async postMessage(
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<string> {
    await this.ensureInitialized();

    const result = await this.app.client.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: threadTs,
    });

    return result.ts!;
  }

  /**
   * Get permalink for a message
   */
  async getPermalink(channelId: string, messageTs: string): Promise<string> {
    await this.ensureInitialized();

    const result = await this.app.client.chat.getPermalink({
      channel: channelId,
      message_ts: messageTs,
    });

    return result.permalink!;
  }

  /**
   * Get the underlying Bolt app for advanced usage
   */
  getApp(): App {
    return this.app;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async enrichMessage(
    msg: Record<string, unknown>,
    channelId: string
  ): Promise<SlackMessage> {
    const message: SlackMessage = {
      ts: msg.ts as string,
      text: (msg.text as string) ?? '',
      user: (msg.user as string) ?? '',
      channel: channelId,
      threadTs: msg.thread_ts as string | undefined,
    };

    if (msg.reactions) {
      message.reactions = (msg.reactions as Array<Record<string, unknown>>).map((r) => ({
        name: r.name as string,
        count: r.count as number,
        users: (r.users as string[]) ?? [],
      }));
    }

    if (msg.files) {
      message.files = (msg.files as Array<Record<string, unknown>>).map((f) => ({
        id: f.id as string,
        name: f.name as string,
        mimetype: f.mimetype as string,
        url: (f.url_private as string) ?? (f.permalink as string) ?? '',
      }));
    }

    // Get permalink if not present
    if (!message.permalink) {
      try {
        message.permalink = await this.getPermalink(channelId, message.ts);
      } catch {
        // Ignore permalink errors
      }
    }

    return message;
  }
}
