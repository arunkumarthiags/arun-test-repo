import dotenv from 'dotenv';
import { initializeDatabase } from './database';

dotenv.config();

try {
  console.log('Setting up database...');
  initializeDatabase();
  console.log('Database setup complete!');
  process.exit(0);
} catch (error) {
  console.error('Database setup failed:', error);
  process.exit(1);
}
