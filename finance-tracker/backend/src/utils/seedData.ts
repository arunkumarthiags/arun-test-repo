import dotenv from 'dotenv';
import { TransactionModel } from '../models/Transaction';
import { AccountModel } from '../models/Account';
import { BudgetModel } from '../models/Budget';
import { initializeDatabase } from './database';

dotenv.config();

/**
 * Seed sample data for testing without Plaid
 */
function seedData() {
  console.log('Seeding sample data...');

  // Create a sample manual account
  const account = AccountModel.create({
    plaid_item_id: 'manual',
    name: 'Cash Account',
    official_name: 'My Cash Account',
    type: 'depository',
    subtype: 'checking',
    current_balance: 5000,
    available_balance: 5000,
    currency_code: 'USD',
    is_active: 1,
  });

  console.log('Created sample account:', account.name);

  // Create sample transactions
  const sampleTransactions = [
    // Income
    { date: '2024-01-05', name: 'Salary Deposit', category: 'Salary', type: 'income' as const, amount: 5000 },
    { date: '2024-01-15', name: 'Freelance Payment', category: 'Freelance', type: 'income' as const, amount: 1500 },

    // Expenses
    { date: '2024-01-06', name: 'Whole Foods', merchant_name: 'Whole Foods Market', category: 'Groceries', type: 'expense' as const, amount: 150 },
    { date: '2024-01-07', name: 'Shell Gas Station', merchant_name: 'Shell', category: 'Transportation', type: 'expense' as const, amount: 45 },
    { date: '2024-01-08', name: 'Netflix Subscription', merchant_name: 'Netflix', category: 'Subscriptions', type: 'expense' as const, amount: 15.99 },
    { date: '2024-01-09', name: 'Starbucks', merchant_name: 'Starbucks', category: 'Food & Dining', type: 'expense' as const, amount: 8.50 },
    { date: '2024-01-10', name: 'Electric Bill', merchant_name: 'City Electric', category: 'Utilities', type: 'expense' as const, amount: 120 },
    { date: '2024-01-11', name: 'Amazon Purchase', merchant_name: 'Amazon', category: 'Shopping', type: 'expense' as const, amount: 89.99 },
    { date: '2024-01-12', name: 'Gym Membership', merchant_name: 'LA Fitness', category: 'Healthcare', type: 'expense' as const, amount: 50 },
    { date: '2024-01-13', name: 'Movie Tickets', merchant_name: 'AMC Theaters', category: 'Entertainment', type: 'expense' as const, amount: 30 },
    { date: '2024-01-14', name: 'Uber Ride', merchant_name: 'Uber', category: 'Transportation', type: 'expense' as const, amount: 25 },
    { date: '2024-01-15', name: 'Target', merchant_name: 'Target', category: 'Shopping', type: 'expense' as const, amount: 75.50 },
    { date: '2024-01-16', name: 'Chipotle', merchant_name: 'Chipotle', category: 'Food & Dining', type: 'expense' as const, amount: 12.50 },
    { date: '2024-01-17', name: 'Spotify Premium', merchant_name: 'Spotify', category: 'Subscriptions', type: 'expense' as const, amount: 9.99 },
    { date: '2024-01-18', name: 'CVS Pharmacy', merchant_name: 'CVS', category: 'Healthcare', type: 'expense' as const, amount: 35 },
    { date: '2024-01-19', name: 'Internet Bill', merchant_name: 'Comcast', category: 'Utilities', type: 'expense' as const, amount: 80 },
    { date: '2024-01-20', name: 'Costco', merchant_name: 'Costco', category: 'Groceries', type: 'expense' as const, amount: 200 },
    { date: '2024-01-21', name: 'Steam Game', merchant_name: 'Steam', category: 'Entertainment', type: 'expense' as const, amount: 59.99 },
    { date: '2024-01-22', name: 'Gas Station', merchant_name: 'Chevron', category: 'Transportation', type: 'expense' as const, amount: 50 },
    { date: '2024-01-23', name: 'Restaurant Dinner', merchant_name: 'Local Restaurant', category: 'Food & Dining', type: 'expense' as const, amount: 85 },
  ];

  sampleTransactions.forEach(txn => {
    TransactionModel.create({
      account_id: account.id,
      amount: txn.amount,
      date: txn.date,
      name: txn.name,
      merchant_name: txn.merchant_name,
      category: txn.category,
      type: txn.type,
      is_manual: 1,
      pending: 0,
    });
  });

  console.log(`Created ${sampleTransactions.length} sample transactions`);

  // Create sample budgets for current month
  const currentDate = new Date();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const year = currentDate.getFullYear();

  const sampleBudgets = [
    { category: 'Groceries', amount: 500 },
    { category: 'Food & Dining', amount: 300 },
    { category: 'Transportation', amount: 200 },
    { category: 'Utilities', amount: 250 },
    { category: 'Entertainment', amount: 150 },
    { category: 'Shopping', amount: 300 },
    { category: 'Healthcare', amount: 150 },
    { category: 'Subscriptions', amount: 50 },
  ];

  sampleBudgets.forEach(budget => {
    try {
      BudgetModel.create({
        category: budget.category,
        amount: budget.amount,
        month,
        year,
      });
    } catch (error) {
      // Budget might already exist
    }
  });

  console.log(`Created ${sampleBudgets.length} sample budgets`);
  console.log('Sample data seeded successfully!');
}

// Initialize database and seed data
try {
  initializeDatabase();
  seedData();
  process.exit(0);
} catch (error) {
  console.error('Error seeding data:', error);
  process.exit(1);
}
