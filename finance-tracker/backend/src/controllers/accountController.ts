import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AccountModel } from '../models/Account';

/**
 * Get all accounts
 */
export const getAccounts = asyncHandler(async (req: Request, res: Response) => {
  const accounts = AccountModel.findAll();
  res.json({ accounts });
});

/**
 * Get single account
 */
export const getAccount = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const account = AccountModel.findById(id);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({ account });
});

/**
 * Deactivate an account
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const account = AccountModel.findById(id);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  AccountModel.delete(id);

  res.json({ success: true });
});
