import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { CategoryModel } from '../models/Category';

/**
 * Get all categories
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = CategoryModel.findAll();
  res.json({ categories });
});

/**
 * Get categories by type
 */
export const getCategoriesByType = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Invalid type. Must be "income" or "expense"' });
  }

  const categories = CategoryModel.findByType(type);
  res.json({ categories });
});
