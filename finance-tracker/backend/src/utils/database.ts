import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/finance.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
export const db: BetterSqlite3.Database = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema
 */
export function initializeDatabase(): void {
  // Accounts table - stores connected bank accounts from Plaid
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      plaid_account_id TEXT UNIQUE,
      plaid_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      official_name TEXT,
      type TEXT NOT NULL,
      subtype TEXT,
      mask TEXT,
      current_balance REAL,
      available_balance REAL,
      currency_code TEXT DEFAULT 'USD',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Plaid items table - stores Plaid access tokens (encrypted)
  db.exec(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      item_id TEXT UNIQUE NOT NULL,
      institution_id TEXT,
      institution_name TEXT,
      cursor TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Transactions table - stores all transactions (imported and manual)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      plaid_transaction_id TEXT UNIQUE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      merchant_name TEXT,
      category TEXT,
      subcategory TEXT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
      pending INTEGER DEFAULT 0,
      notes TEXT,
      receipt_path TEXT,
      is_manual INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    )
  `);

  // Budgets table - stores monthly budget limits by category
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, month, year)
    )
  `);

  // Categories table - predefined categories for transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      icon TEXT,
      color TEXT
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_accounts_item ON accounts(plaid_item_id);
  `);

  // ========================================
  // AI INSIGHTS TABLES
  // ========================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      insight_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      detailed_analysis TEXT NOT NULL,
      data TEXT,
      priority TEXT DEFAULT 'medium',
      time_period_start TEXT NOT NULL,
      time_period_end TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);
    CREATE INDEX IF NOT EXISTS idx_insights_created ON ai_insights(created_at);
    CREATE INDEX IF NOT EXISTS idx_insights_priority ON ai_insights(priority);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS insight_cache (
      id TEXT PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      insight_type TEXT NOT NULL,
      data TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cache_key ON insight_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON insight_cache(expires_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spending_patterns (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      merchant_name TEXT,
      average_amount REAL,
      frequency TEXT,
      last_occurrence TEXT,
      pattern_confidence REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patterns_category ON spending_patterns(category);
    CREATE INDEX IF NOT EXISTS idx_patterns_merchant ON spending_patterns(merchant_name);
  `);

  // ========================================
  // SAVINGS GOALS & GAMIFICATION TABLES
  // ========================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      target_date TEXT,
      category TEXT,
      icon TEXT,
      color TEXT,
      priority INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      is_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_savings_goals_active ON savings_goals(is_active);
    CREATE INDEX IF NOT EXISTS idx_savings_goals_completed ON savings_goals(is_completed);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS savings_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      amount REAL NOT NULL,
      contribution_date TEXT NOT NULL,
      contribution_type TEXT NOT NULL,
      source_transaction_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
      FOREIGN KEY (source_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal ON savings_contributions(goal_id);
    CREATE INDEX IF NOT EXISTS idx_savings_contributions_date ON savings_contributions(contribution_date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS auto_savings_rules (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      roundup_multiplier INTEGER DEFAULT 1,
      income_percentage REAL,
      spending_category TEXT,
      spending_threshold REAL,
      scheduled_amount REAL,
      scheduled_frequency TEXT,
      scheduled_day_of_month INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auto_savings_rules_goal ON auto_savings_rules(goal_id);
    CREATE INDEX IF NOT EXISTS idx_auto_savings_rules_active ON auto_savings_rules(is_active);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_envelopes (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      allocated_amount REAL NOT NULL,
      spent_amount REAL DEFAULT 0,
      rollover_enabled INTEGER DEFAULT 0,
      rollover_amount REAL DEFAULT 0,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      alert_threshold INTEGER DEFAULT 80,
      alert_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, month, year)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_budget_envelopes_period ON budget_envelopes(month, year);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT,
      tier TEXT DEFAULT 'bronze',
      requirement_type TEXT NOT NULL,
      requirement_value REAL,
      points INTEGER DEFAULT 10,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      achievement_id TEXT NOT NULL,
      earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_earned ON user_achievements(earned_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_streaks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      category TEXT,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_success_month TEXT,
      last_success_year INTEGER,
      streak_broken_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_budget_streaks_user ON budget_streaks(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS savings_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      challenge_type TEXT NOT NULL,
      target_value REAL,
      target_category TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_completed INTEGER DEFAULT 0,
      current_progress REAL DEFAULT 0,
      reward_achievement_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reward_achievement_id) REFERENCES achievements(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_savings_challenges_active ON savings_challenges(is_active);
    CREATE INDEX IF NOT EXISTS idx_savings_challenges_dates ON savings_challenges(start_date, end_date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS gamification_stats (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      total_points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      achievements_earned INTEGER DEFAULT 0,
      goals_completed INTEGER DEFAULT 0,
      total_saved REAL DEFAULT 0,
      current_budget_streak INTEGER DEFAULT 0,
      longest_budget_streak INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========================================
  // RECEIPTS TABLES
  // ========================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      merchant_name TEXT,
      transaction_date TEXT,
      total_amount REAL,
      tax_amount REAL,
      subtotal_amount REAL,
      currency TEXT DEFAULT 'USD',
      items TEXT,
      category TEXT,
      payment_method TEXT,
      tags TEXT,
      warranty_end_date TEXT,
      return_window_end_date TEXT,
      has_warranty INTEGER DEFAULT 0,
      is_returnable INTEGER DEFAULT 0,
      duplicate_hash TEXT,
      is_duplicate INTEGER DEFAULT 0,
      original_receipt_id TEXT,
      match_status TEXT DEFAULT 'unmatched',
      match_confidence REAL,
      extraction_confidence REAL,
      raw_extraction TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (original_receipt_id) REFERENCES receipts(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant_name);
    CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(duplicate_hash);
    CREATE INDEX IF NOT EXISTS idx_receipts_tags ON receipts(tags);
  `);

  // ========================================
  // INVESTMENT PORTFOLIO TABLES
  // ========================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('brokerage', 'retirement', 'crypto', 'manual')),
      provider TEXT,
      account_number TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'crypto', 'bond', 'mutual_fund')),
      quantity REAL NOT NULL,
      average_cost_basis REAL NOT NULL,
      current_price REAL,
      current_value REAL,
      last_price_update TEXT,
      currency_code TEXT DEFAULT 'USD',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS investment_transactions (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      holding_id TEXT,
      transaction_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'dividend', 'interest', 'deposit', 'withdrawal', 'split', 'transfer')),
      symbol TEXT,
      quantity REAL,
      price_per_share REAL,
      total_amount REAL NOT NULL,
      fees REAL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
      FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE SET NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_investment_transactions_portfolio ON investment_transactions(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      price REAL NOT NULL,
      date TEXT NOT NULL,
      source TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, asset_type, date)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol, date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      total_value REAL NOT NULL,
      total_cost_basis REAL NOT NULL,
      total_gain_loss REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
      UNIQUE(portfolio_id, date)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmarks (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      current_value REAL,
      last_update TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmark_history (
      id TEXT PRIMARY KEY,
      benchmark_id TEXT NOT NULL,
      value REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE CASCADE,
      UNIQUE(benchmark_id, date)
    )
  `);

  // Seed default categories if table is empty
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };

  if (categoryCount.count === 0) {
    seedDefaultCategories();
  }

  // Seed default achievements
  seedDefaultAchievements();

  // Seed default benchmarks
  seedDefaultBenchmarks();

  console.log('Database initialized successfully with all feature tables');
}

/**
 * Seed default transaction categories
 */
function seedDefaultCategories(): void {
  const categories = [
    // Income categories
    { id: 'income-salary', name: 'Salary', type: 'income', icon: '💰', color: '#10b981' },
    { id: 'income-freelance', name: 'Freelance', type: 'income', icon: '💼', color: '#10b981' },
    { id: 'income-investment', name: 'Investment', type: 'income', icon: '📈', color: '#10b981' },
    { id: 'income-other', name: 'Other Income', type: 'income', icon: '💵', color: '#10b981' },

    // Expense categories
    { id: 'expense-food', name: 'Food & Dining', type: 'expense', icon: '🍔', color: '#ef4444' },
    { id: 'expense-groceries', name: 'Groceries', type: 'expense', icon: '🛒', color: '#ef4444' },
    { id: 'expense-transport', name: 'Transportation', type: 'expense', icon: '🚗', color: '#ef4444' },
    { id: 'expense-utilities', name: 'Utilities', type: 'expense', icon: '💡', color: '#ef4444' },
    { id: 'expense-rent', name: 'Rent/Mortgage', type: 'expense', icon: '🏠', color: '#ef4444' },
    { id: 'expense-healthcare', name: 'Healthcare', type: 'expense', icon: '🏥', color: '#ef4444' },
    { id: 'expense-entertainment', name: 'Entertainment', type: 'expense', icon: '🎬', color: '#ef4444' },
    { id: 'expense-shopping', name: 'Shopping', type: 'expense', icon: '🛍️', color: '#ef4444' },
    { id: 'expense-education', name: 'Education', type: 'expense', icon: '📚', color: '#ef4444' },
    { id: 'expense-insurance', name: 'Insurance', type: 'expense', icon: '🛡️', color: '#ef4444' },
    { id: 'expense-subscription', name: 'Subscriptions', type: 'expense', icon: '📱', color: '#ef4444' },
    { id: 'expense-travel', name: 'Travel', type: 'expense', icon: '✈️', color: '#ef4444' },
    { id: 'expense-other', name: 'Other Expense', type: 'expense', icon: '💸', color: '#ef4444' },
  ];

  const insert = db.prepare(`
    INSERT INTO categories (id, name, type, icon, color)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((cats) => {
    for (const cat of cats) {
      insert.run(cat.id, cat.name, cat.type, cat.icon, cat.color);
    }
  });

  insertMany(categories);
  console.log('Default categories seeded');
}

/**
 * Seed default achievements for gamification
 */
function seedDefaultAchievements(): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM achievements').get() as { count: number };

  if (count.count > 0) {
    return; // Already seeded
  }

  const achievements = [
    // Savings Achievements
    { id: 'first-goal', name: 'First Steps', description: 'Complete your first savings goal', category: 'savings', icon: '🎯', tier: 'bronze', requirement_type: 'goal_completed', requirement_value: 1, points: 10 },
    { id: 'goal-getter', name: 'Goal Getter', description: 'Complete 5 savings goals', category: 'savings', icon: '🏆', tier: 'silver', requirement_type: 'goal_completed', requirement_value: 5, points: 25 },
    { id: 'thousand-club', name: 'Thousand Club', description: 'Save $1,000 in a single goal', category: 'savings', icon: '💎', tier: 'bronze', requirement_type: 'savings_amount', requirement_value: 1000, points: 15 },

    // Budget Achievements
    { id: 'budget-beginner', name: 'Budget Beginner', description: 'Stay under budget for 1 month', category: 'budget', icon: '📊', tier: 'bronze', requirement_type: 'budget_success', requirement_value: 1, points: 10 },
    { id: 'budget-pro', name: 'Budget Pro', description: 'Stay under budget for 3 consecutive months', category: 'budget', icon: '💪', tier: 'silver', requirement_type: 'streak_months', requirement_value: 3, points: 30 },
    { id: 'perfect-month', name: 'Perfect Month', description: 'Stay under budget in all categories', category: 'budget', icon: '✨', tier: 'silver', requirement_type: 'perfect_budget_month', requirement_value: 1, points: 35 },

    // Streak Achievements
    { id: 'streak-30', name: 'Streak Starter', description: 'Reach a 30-day streak', category: 'streak', icon: '🔥', tier: 'bronze', requirement_type: 'streak_days', requirement_value: 30, points: 10 },
    { id: 'streak-90', name: 'Streak Master', description: 'Reach a 90-day streak', category: 'streak', icon: '🔥🔥', tier: 'silver', requirement_type: 'streak_days', requirement_value: 90, points: 30 },

    // Level Achievements
    { id: 'level-5', name: 'Rising Star', description: 'Reach Level 5', category: 'milestone', icon: '⭐', tier: 'bronze', requirement_type: 'level_reached', requirement_value: 5, points: 10 },
    { id: 'level-10', name: 'High Achiever', description: 'Reach Level 10', category: 'milestone', icon: '🌟', tier: 'silver', requirement_type: 'level_reached', requirement_value: 10, points: 25 },
  ];

  const insert = db.prepare(`
    INSERT INTO achievements (id, name, description, category, icon, tier, requirement_type, requirement_value, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((achs) => {
    for (const ach of achs) {
      insert.run(ach.id, ach.name, ach.description, ach.category, ach.icon, ach.tier, ach.requirement_type, ach.requirement_value, ach.points);
    }
  });

  insertMany(achievements);
  console.log('Default achievements seeded');
}

/**
 * Seed default market benchmarks
 */
function seedDefaultBenchmarks(): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM benchmarks').get() as { count: number };

  if (count.count > 0) {
    return; // Already seeded
  }

  const benchmarks = [
    { id: 'sp500', symbol: '^GSPC', name: 'S&P 500', description: 'Standard & Poor\'s 500 Index' },
    { id: 'dow', symbol: '^DJI', name: 'Dow Jones', description: 'Dow Jones Industrial Average' },
    { id: 'nasdaq', symbol: '^IXIC', name: 'NASDAQ', description: 'NASDAQ Composite Index' },
  ];

  const insert = db.prepare(`
    INSERT INTO benchmarks (id, symbol, name, description)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((bms) => {
    for (const bm of bms) {
      insert.run(bm.id, bm.symbol, bm.name, bm.description);
    }
  });

  insertMany(benchmarks);
  console.log('Default benchmarks seeded');
}

export default db;
