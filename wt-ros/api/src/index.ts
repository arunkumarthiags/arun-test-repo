import 'reflect-metadata';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import cors from 'cors';

// Import resolvers
import { WorkItemResolver } from './resolvers/WorkItemResolver';
import { WorkUpdateResolver } from './resolvers/WorkUpdateResolver';
import { LineCommentResolver } from './resolvers/LineCommentResolver';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Build GraphQL schema
  const schema = await buildSchema({
    resolvers: [WorkItemResolver, WorkUpdateResolver, LineCommentResolver],
    validate: false,
  });

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    context: ({ req, res }) => ({ req, res }),
    introspection: true,
  });

  await server.start();
  server.applyMiddleware({ app: app as any, cors: false });

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
