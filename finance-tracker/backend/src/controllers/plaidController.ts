import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as plaidService from '../services/plaidService';
import { PlaidItemModel } from '../models/PlaidItem';
import { AccountModel } from '../models/Account';

/**
 * Create a link token for Plaid Link
 */
export const createLinkToken = asyncHandler(async (req: Request, res: Response) => {
  // In production, use actual user ID from auth
  const userId = 'user-' + Date.now();

  const linkToken = await plaidService.createLinkToken(userId);

  res.json({ link_token: linkToken });
});

/**
 * Exchange public token for access token
 */
export const exchangePublicToken = asyncHandler(async (req: Request, res: Response) => {
  const { public_token } = req.body;

  if (!public_token) {
    return res.status(400).json({ error: 'public_token is required' });
  }

  const result = await plaidService.exchangePublicToken(public_token);

  res.json({
    success: true,
    item_id: result.item.item_id,
    accounts: result.accounts,
  });
});

/**
 * Get all connected accounts
 */
export const getAccounts = asyncHandler(async (req: Request, res: Response) => {
  const accounts = AccountModel.findAll();
  res.json({ accounts });
});

/**
 * Sync transactions for a specific item
 */
export const syncTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { item_id } = req.body;

  if (!item_id) {
    return res.status(400).json({ error: 'item_id is required' });
  }

  const count = await plaidService.syncTransactions(item_id);

  res.json({
    success: true,
    transactions_added: count,
  });
});

/**
 * Sync transactions for all connected items
 */
export const syncAllTransactions = asyncHandler(async (req: Request, res: Response) => {
  const items = PlaidItemModel.findAll();
  let totalCount = 0;

  for (const item of items) {
    try {
      const count = await plaidService.syncTransactions(item.item_id);
      totalCount += count;
    } catch (error) {
      console.error(`Error syncing item ${item.item_id}:`, error);
    }
  }

  res.json({
    success: true,
    total_transactions_added: totalCount,
    items_synced: items.length,
  });
});

/**
 * Refresh account balances
 */
export const refreshBalances = asyncHandler(async (req: Request, res: Response) => {
  const { item_id } = req.body;

  if (!item_id) {
    return res.status(400).json({ error: 'item_id is required' });
  }

  await plaidService.refreshBalances(item_id);

  res.json({ success: true });
});

/**
 * Remove a connected account
 */
export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { item_id } = req.params;

  if (!item_id) {
    return res.status(400).json({ error: 'item_id is required' });
  }

  await plaidService.removeItem(item_id);

  res.json({ success: true });
});

/**
 * Webhook handler for Plaid events
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { webhook_type, webhook_code, item_id } = req.body;

  console.log(`Webhook received: ${webhook_type} - ${webhook_code}`);

  // Handle different webhook types
  switch (webhook_type) {
    case 'TRANSACTIONS':
      if (webhook_code === 'SYNC_UPDATES_AVAILABLE') {
        // Sync transactions in background
        plaidService.syncTransactions(item_id).catch(err => {
          console.error('Error syncing transactions from webhook:', err);
        });
      }
      break;

    case 'ITEM':
      if (webhook_code === 'ERROR') {
        console.error(`Item error for ${item_id}:`, req.body.error);
      }
      break;
  }

  res.json({ success: true });
});

/**
 * Get all connected Plaid items with their accounts
 */
export const getItems = asyncHandler(async (req: Request, res: Response) => {
  const items = PlaidItemModel.findAll();

  const itemsWithAccounts = items.map(item => {
    const accounts = AccountModel.findByItemId(item.item_id);
    return {
      id: item.id,
      item_id: item.item_id,
      institution_name: item.institution_name,
      accounts: accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        mask: acc.mask,
        current_balance: acc.current_balance,
        available_balance: acc.available_balance,
      })),
      created_at: item.created_at,
    };
  });

  res.json({ items: itemsWithAccounts });
});
