import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { BudgetModel } from '../models/Budget';
import { TransactionModel } from '../models/Transaction';
import { startOfMonth, endOfMonth } from 'date-fns';

/**
 * Get budgets for a specific month/year
 */
export const getBudgets = asyncHandler(async (req: Request, res: Response) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required' });
  }

  const budgets = BudgetModel.findByMonthYear(month as string, parseInt(year as string));

  // Calculate spending for each category
  const startDate = startOfMonth(new Date(parseInt(year as string), parseInt(month as string) - 1)).toISOString().split('T')[0];
  const endDate = endOfMonth(new Date(parseInt(year as string), parseInt(month as string) - 1)).toISOString().split('T')[0];

  const budgetsWithSpending = budgets.map(budget => {
    const transactions = TransactionModel.findAll({
      startDate,
      endDate,
      category: budget.category,
    });

    const spent = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      ...budget,
      spent,
      remaining: budget.amount - spent,
      percentage: (spent / budget.amount) * 100,
    };
  });

  res.json({ budgets: budgetsWithSpending });
});

/**
 * Create a budget
 */
export const createBudget = asyncHandler(async (req: Request, res: Response) => {
  const { category, amount, month, year } = req.body;

  if (!category || !amount || !month || !year) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if budget already exists
  const existing = BudgetModel.findByCategoryMonthYear(category, month, year);
  if (existing) {
    return res.status(400).json({ error: 'Budget already exists for this category and month' });
  }

  const budget = BudgetModel.create({
    category,
    amount: parseFloat(amount),
    month,
    year: parseInt(year),
  });

  res.status(201).json({ budget });
});

/**
 * Update a budget
 */
export const updateBudget = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  const budget = BudgetModel.update(id, parseFloat(amount));

  if (!budget) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  res.json({ budget });
});

/**
 * Delete a budget
 */
export const deleteBudget = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const budget = BudgetModel.findById(id);

  if (!budget) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  BudgetModel.delete(id);

  res.json({ success: true });
});
