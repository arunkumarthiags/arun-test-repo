import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { TransactionModel } from '../models/Transaction';
import { AccountModel } from '../models/Account';
import { db } from '../utils/database';
import { stringify } from 'csv-stringify/sync';

/**
 * Get spending by category
 */
export const getSpendingByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  let query = `
    SELECT
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE type = 'expense'
  `;

  const params: any[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY category ORDER BY total DESC';

  const results = db.prepare(query).all(...params);

  res.json({ data: results });
});

/**
 * Get income vs expenses over time
 */
export const getIncomeVsExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, groupBy = 'month' } = req.query;

  // Determine date format based on groupBy
  let dateFormat = '%Y-%m'; // month
  if (groupBy === 'day') dateFormat = '%Y-%m-%d';
  if (groupBy === 'year') dateFormat = '%Y';

  let query = `
    SELECT
      strftime('${dateFormat}', date) as period,
      type,
      SUM(amount) as total
    FROM transactions
    WHERE 1=1
  `;

  const params: any[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY period, type ORDER BY period ASC';

  const results = db.prepare(query).all(...params);

  // Transform data for better frontend consumption
  const dataByPeriod: any = {};

  results.forEach((row: any) => {
    if (!dataByPeriod[row.period]) {
      dataByPeriod[row.period] = { period: row.period, income: 0, expenses: 0 };
    }

    if (row.type === 'income') {
      dataByPeriod[row.period].income = row.total;
    } else if (row.type === 'expense') {
      dataByPeriod[row.period].expenses = row.total;
    }
  });

  const data = Object.values(dataByPeriod).map((d: any) => ({
    ...d,
    net: d.income - d.expenses,
  }));

  res.json({ data });
});

/**
 * Get net worth (sum of all account balances)
 */
export const getNetWorth = asyncHandler(async (req: Request, res: Response) => {
  const accounts = AccountModel.findAll();

  const netWorth = accounts.reduce((sum, account) => {
    return sum + (account.current_balance || 0);
  }, 0);

  const totalAvailable = accounts.reduce((sum, account) => {
    return sum + (account.available_balance || account.current_balance || 0);
  }, 0);

  res.json({
    net_worth: netWorth,
    available_balance: totalAvailable,
    accounts: accounts.length,
  });
});

/**
 * Get spending trends
 */
export const getSpendingTrends = asyncHandler(async (req: Request, res: Response) => {
  const { months = 6 } = req.query;

  const query = `
    SELECT
      strftime('%Y-%m', date) as month,
      category,
      SUM(amount) as total
    FROM transactions
    WHERE type = 'expense'
      AND date >= date('now', '-${months} months')
    GROUP BY month, category
    ORDER BY month ASC, total DESC
  `;

  const results = db.prepare(query).all();

  res.json({ data: results });
});

/**
 * Get summary statistics
 */
export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  let query = 'SELECT type, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE 1=1';
  const params: any[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY type';

  const results = db.prepare(query).all(...params) as any[];

  const summary = {
    income: results.find(r => r.type === 'income')?.total || 0,
    expenses: results.find(r => r.type === 'expense')?.total || 0,
    transactions: results.reduce((sum, r) => sum + r.count, 0),
  };

  summary['net'] = summary.income - summary.expenses;

  res.json(summary);
});

/**
 * Export transactions to CSV
 */
export const exportTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, category, accountId } = req.query;

  const filters = {
    startDate: startDate as string,
    endDate: endDate as string,
    category: category as string,
    accountId: accountId as string,
  };

  const transactions = TransactionModel.findAll(filters);

  // Convert to CSV
  const csvData = transactions.map(t => ({
    Date: t.date,
    Name: t.name,
    Merchant: t.merchant_name || '',
    Category: t.category || '',
    Type: t.type,
    Amount: t.amount,
    Notes: t.notes || '',
  }));

  const csv = stringify(csvData, {
    header: true,
    columns: ['Date', 'Name', 'Merchant', 'Category', 'Type', 'Amount', 'Notes'],
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
  res.send(csv);
});
