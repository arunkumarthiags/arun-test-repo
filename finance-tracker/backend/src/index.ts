import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeDatabase } from './utils/database';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

// Import routes
import plaidRoutes from './routes/plaid';
import transactionRoutes from './routes/transactions';
import accountRoutes from './routes/accounts';
import budgetRoutes from './routes/budgets';
import analyticsRoutes from './routes/analytics';
import categoryRoutes from './routes/categories';
import importRoutes from './routes/import';

// Initialize database
initializeDatabase();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/plaid', plaidRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/import', importRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Plaid Environment: ${process.env.PLAID_ENV || 'sandbox'}`);
});
