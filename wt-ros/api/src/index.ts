import 'reflect-metadata';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import cors from 'cors';
import DataLoader from 'dataloader';

// Database initialization
import { initializeDatabase, closeDatabase, AppDataSource } from './config/data-source';

// Entities
import { User } from './entities/User.entity';
import { Team } from './entities/Team.entity';
import { Group } from './entities/Group.entity';
import { WorkItem } from './entities/WorkItem.entity';

// Resolvers
import { WorkItemResolver } from './resolvers/WorkItemResolver';
import { WorkUpdateResolver } from './resolvers/WorkUpdateResolver';
import { LineCommentResolver } from './resolvers/LineCommentResolver';

// Types
import type { GraphQLContext } from './resolvers/WorkItemResolver';

const PORT = process.env.PORT || 4000;

/**
 * Create DataLoaders for batching database queries
 * These prevent N+1 query problems in GraphQL resolvers
 */
function createDataLoaders() {
  return {
    userLoader: new DataLoader<string, User>(async (ids) => {
      const users = await AppDataSource.getRepository(User).findByIds([...ids]);
      const userMap = new Map(users.map(u => [u.id, u]));
      return ids.map(id => userMap.get(id) || null) as User[];
    }),

    teamLoader: new DataLoader<string, Team>(async (ids) => {
      const teams = await AppDataSource.getRepository(Team).findByIds([...ids]);
      const teamMap = new Map(teams.map(t => [t.id, t]));
      return ids.map(id => teamMap.get(id) || null) as Team[];
    }),

    groupLoader: new DataLoader<string, Group>(async (ids) => {
      const groups = await AppDataSource.getRepository(Group).findByIds([...ids]);
      const groupMap = new Map(groups.map(g => [g.id, g]));
      return ids.map(id => groupMap.get(id) || null) as Group[];
    }),

    workItemLoader: new DataLoader<string, WorkItem>(async (ids) => {
      const workItems = await AppDataSource.getRepository(WorkItem).findByIds([...ids]);
      const workItemMap = new Map(workItems.map(w => [w.id, w]));
      return ids.map(id => workItemMap.get(id) || null) as WorkItem[];
    }),
  };
}

/**
 * Create a mock Redis interface for development
 * In production, replace with actual Redis client
 */
function createMockRedis() {
  const cache = new Map<string, { value: string; expiresAt: number }>();

  return {
    async get(key: string): Promise<string | null> {
      const entry = cache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
      }
      return entry.value;
    },

    async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
      const ttlMs = (options?.EX ?? 300) * 1000; // Default 5 min TTL
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },

    async del(key: string): Promise<void> {
      cache.delete(key);
    },
  };
}

/**
 * Bootstrap the application
 */
async function bootstrap() {
  // Initialize database connection first
  console.log('Initializing database connection...');
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      // Check database connection
      const isConnected = AppDataSource.isInitialized;
      if (!isConnected) {
        throw new Error('Database not connected');
      }

      // Quick query to verify connection
      await AppDataSource.query('SELECT 1');

      res.json({
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Build GraphQL schema
  console.log('Building GraphQL schema...');
  const schema = await buildSchema({
    resolvers: [WorkItemResolver, WorkUpdateResolver, LineCommentResolver],
    validate: false,
    // Disable container for simpler setup (no typedi)
    container: {
      get: (someClass: new (...args: unknown[]) => unknown) => {
        return new someClass();
      },
    },
  });

  // Create mock Redis (use real Redis in production)
  const redis = createMockRedis();

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    context: ({ req, res }): GraphQLContext => {
      // Create fresh DataLoaders per request to ensure proper batching
      const loaders = createDataLoaders();

      return {
        req,
        res,
        // In production, extract userId from JWT token
        userId: req.headers['x-user-id'] as string || 'anonymous',
        ...loaders,
        redis,
      };
    },
    introspection: true,
    formatError: (error) => {
      // Log errors for debugging
      console.error('GraphQL Error:', error);

      // In production, sanitize error messages
      if (process.env.NODE_ENV === 'production') {
        return {
          message: error.message,
          extensions: {
            code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          },
        };
      }

      return error;
    },
  });

  await server.start();
  // @ts-expect-error - Apollo Server Express types are slightly incompatible with newer Express types
  server.applyMiddleware({ app, cors: false });

  // Start server
  const httpServer = app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    httpServer.close(async () => {
      console.log('HTTP server closed');

      try {
        await closeDatabase();
        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
