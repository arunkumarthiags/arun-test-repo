import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../entities/User.entity';
import { Group } from '../entities/Group.entity';
import { Team } from '../entities/Team.entity';
import { WorkItem } from '../entities/WorkItem.entity';
import { WorkUpdate } from '../entities/WorkUpdate.entity';
import { LineComment } from '../entities/LineComment.entity';
import { Artifact } from '../entities/Artifact.entity';

/**
 * Parse DATABASE_URL into individual connection parameters
 */
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 5432,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1), // Remove leading '/'
    ssl: parsed.searchParams.get('sslmode') === 'require' ||
         parsed.searchParams.get('ssl') === 'true',
  };
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfig(): DataSourceOptions {
  const databaseUrl = process.env.DATABASE_URL;

  // If DATABASE_URL is provided, parse it
  if (databaseUrl) {
    const parsed = parseDatabaseUrl(databaseUrl);
    return {
      type: 'postgres',
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password: parsed.password,
      database: parsed.database,
      ssl: parsed.ssl ? { rejectUnauthorized: false } : false,
      entities: [User, Group, Team, WorkItem, WorkUpdate, LineComment, Artifact],
      synchronize: false, // Never auto-sync in production - use migrations
      logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
      maxQueryExecutionTime: 1000, // Log queries taking more than 1 second
    };
  }

  // Fall back to individual POSTGRES_* environment variables
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const username = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const database = process.env.POSTGRES_DB || 'wt_ros';
  const ssl = process.env.POSTGRES_SSL === 'true';

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    entities: [User, Group, Team, WorkItem, WorkUpdate, LineComment, Artifact],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    maxQueryExecutionTime: 1000,
  };
}

/**
 * TypeORM DataSource for the WT-ROS application
 */
export const AppDataSource = new DataSource(getDatabaseConfig());

/**
 * Initialize the database connection
 * @returns Promise that resolves when connection is established
 */
export async function initializeDatabase(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
    return AppDataSource;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
}
