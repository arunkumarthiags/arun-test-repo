import { Router } from 'express';
import * as plaidController from '../controllers/plaidController';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Create link token
router.post('/create-link-token', authLimiter, plaidController.createLinkToken);

// Exchange public token
router.post('/exchange-public-token', authLimiter, plaidController.exchangePublicToken);

// Get all connected accounts
router.get('/accounts', plaidController.getAccounts);

// Get all connected items
router.get('/items', plaidController.getItems);

// Sync transactions
router.post('/sync-transactions', plaidController.syncTransactions);

// Sync all transactions
router.post('/sync-all-transactions', plaidController.syncAllTransactions);

// Refresh balances
router.post('/refresh-balances', plaidController.refreshBalances);

// Remove item
router.delete('/items/:item_id', plaidController.removeItem);

// Webhook handler
router.post('/webhook', plaidController.handleWebhook);

export default router;
