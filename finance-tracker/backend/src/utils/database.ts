import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/finance.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
export const db = new Database(dbPath);

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

  // Seed default categories if table is empty
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };

  if (categoryCount.count === 0) {
    seedDefaultCategories();
  }

  console.log('Database initialized successfully');
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

export default db;
