import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { PlaidItemModel } from '../models/PlaidItem';
import { AccountModel } from '../models/Account';
import { TransactionModel } from '../models/Transaction';
import { categorizeTransaction, determineTransactionType } from '../utils/categorizer';
import { db } from '../utils/database';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

/**
 * Create a link token for Plaid Link initialization
 */
export async function createLinkToken(userId: string): Promise<string> {
  try {
    console.log('Creating link token with credentials:', {
      clientId: process.env.PLAID_CLIENT_ID ? 'SET' : 'MISSING',
      secret: process.env.PLAID_SECRET ? 'SET' : 'MISSING',
      env: process.env.PLAID_ENV,
    });

    const request: any = {
      user: { client_user_id: userId },
      client_name: 'Finance Tracker',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    // Add webhook only if configured
    if (process.env.WEBHOOK_URL) {
      request.webhook = process.env.WEBHOOK_URL;
    }

    const response = await plaidClient.linkTokenCreate(request);
    return response.data.link_token;
  } catch (error: any) {
    console.error('Plaid link token creation error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Exchange public token for access token and fetch account data
 */
export async function exchangePublicToken(publicToken: string) {
  // Exchange public token for access token
  const tokenResponse = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const accessToken = tokenResponse.data.access_token;
  const itemId = tokenResponse.data.item_id;

  // Get institution info
  let institutionName = 'Unknown Institution';
  let institutionId = '';

  try {
    const itemResponse = await plaidClient.itemGet({ access_token: accessToken });
    institutionId = itemResponse.data.item.institution_id || '';

    if (institutionId) {
      const institutionResponse = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = institutionResponse.data.institution.name;
    }
  } catch (error) {
    console.error('Error fetching institution:', error);
  }

  // Store access token
  const plaidItem = PlaidItemModel.create({
    access_token: accessToken,
    item_id: itemId,
    institution_id: institutionId,
    institution_name: institutionName,
  });

  // Fetch and store accounts
  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = accountsResponse.data.accounts;

  const createdAccounts = accounts.map(account => {
    return AccountModel.create({
      plaid_account_id: account.account_id,
      plaid_item_id: itemId,
      name: account.name,
      official_name: account.official_name || undefined,
      type: account.type,
      subtype: account.subtype || undefined,
      mask: account.mask || undefined,
      current_balance: account.balances.current || undefined,
      available_balance: account.balances.available || undefined,
      currency_code: account.balances.iso_currency_code || 'USD',
      is_active: 1,
    });
  });

  return {
    item: plaidItem,
    accounts: createdAccounts,
  };
}

/**
 * Sync transactions for all connected accounts
 */
export async function syncTransactions(itemId: string): Promise<number> {
  const plaidItem = PlaidItemModel.findByItemId(itemId);
  if (!plaidItem) {
    throw new Error('Plaid item not found');
  }

  const accessToken = plaidItem.access_token;
  let cursor = plaidItem.cursor;
  let hasMore = true;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  // Sync transactions using the sync endpoint
  while (hasMore) {
    const request: any = {
      access_token: accessToken,
    };

    if (cursor) {
      request.cursor = cursor;
    }

    const response = await plaidClient.transactionsSync(request);

    // Process added transactions
    const added = response.data.added;
    const transactionsToAdd = [];

    for (const txn of added) {
      // Find the account
      const account = AccountModel.findByPlaidAccountId(txn.account_id);
      if (!account) continue;

      // Determine category and type
      const category = categorizeTransaction(txn.name, txn.merchant_name);
      const type = determineTransactionType(txn.amount, category);

      transactionsToAdd.push({
        account_id: account.id,
        plaid_transaction_id: txn.transaction_id,
        amount: Math.abs(txn.amount), // Store as positive
        date: txn.date,
        name: txn.name,
        merchant_name: txn.merchant_name || undefined,
        category,
        subcategory: txn.personal_finance_category?.detailed || undefined,
        type,
        pending: txn.pending ? 1 : 0,
        is_manual: 0,
      });
    }

    if (transactionsToAdd.length > 0) {
      TransactionModel.bulkCreate(transactionsToAdd);
      addedCount += transactionsToAdd.length;
    }

    // Process modified transactions
    for (const txn of response.data.modified) {
      const existing = TransactionModel.findByPlaidId(txn.transaction_id);
      if (existing) {
        const category = categorizeTransaction(txn.name, txn.merchant_name);
        const type = determineTransactionType(txn.amount, category);

        TransactionModel.update(existing.id, {
          amount: Math.abs(txn.amount),
          date: txn.date,
          name: txn.name,
          merchant_name: txn.merchant_name || undefined,
          category,
          type,
          pending: txn.pending ? 1 : 0,
        });
        modifiedCount++;
      }
    }

    // Process removed transactions
    for (const txn of response.data.removed) {
      if (!txn.transaction_id) continue;
      const existing = TransactionModel.findByPlaidId(txn.transaction_id);
      if (existing) {
        TransactionModel.delete(existing.id);
        removedCount++;
      }
    }

    // Update cursor
    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;

    // Update cursor in database
    PlaidItemModel.updateCursor(itemId, cursor);
  }

  console.log(`Transaction sync complete: ${addedCount} added, ${modifiedCount} modified, ${removedCount} removed`);

  return addedCount;
}

/**
 * Fetch current account balances
 */
export async function refreshBalances(itemId: string): Promise<void> {
  const plaidItem = PlaidItemModel.findByItemId(itemId);
  if (!plaidItem) {
    throw new Error('Plaid item not found');
  }

  const response = await plaidClient.accountsBalanceGet({
    access_token: plaidItem.access_token,
  });

  for (const account of response.data.accounts) {
    const localAccount = AccountModel.findByPlaidAccountId(account.account_id);
    if (localAccount) {
      AccountModel.updateBalance(
        localAccount.id,
        account.balances.current || 0,
        account.balances.available ?? undefined
      );
    }
  }
}

/**
 * Remove a Plaid item and associated accounts
 */
export async function removeItem(itemId: string): Promise<void> {
  const plaidItem = PlaidItemModel.findByItemId(itemId);
  if (!plaidItem) {
    throw new Error('Plaid item not found');
  }

  // Remove item from Plaid
  try {
    await plaidClient.itemRemove({ access_token: plaidItem.access_token });
  } catch (error) {
    console.error('Error removing item from Plaid:', error);
  }

  // Delete all transactions from these accounts
  const accounts = AccountModel.findByItemId(itemId);
  const accountIds = accounts.map(acc => acc.id);

  if (accountIds.length > 0) {
    // Delete all transactions for these accounts
    const placeholders = accountIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM transactions WHERE account_id IN (${placeholders})`).run(...accountIds);
    console.log(`Deleted transactions for ${accountIds.length} accounts`);
  }

  // Delete accounts
  for (const account of accounts) {
    AccountModel.delete(account.id);
  }

  // Delete item from database
  PlaidItemModel.delete(itemId);
}
