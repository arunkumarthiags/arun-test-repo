import axios from 'axios';
import type {
  Account,
  Transaction,
  Budget,
  Category,
  PlaidItem,
  Summary,
  SpendingByCategory,
  IncomeVsExpenses,
  ParsedTransaction,
  ColumnMapping,
  ImportSummary,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Plaid endpoints
export const plaidApi = {
  createLinkToken: () => api.post<{ link_token: string }>('/plaid/create-link-token'),
  exchangePublicToken: (publicToken: string) =>
    api.post('/plaid/exchange-public-token', { public_token: publicToken }),
  getAccounts: () => api.get<{ accounts: Account[] }>('/plaid/accounts'),
  getItems: () => api.get<{ items: PlaidItem[] }>('/plaid/items'),
  syncTransactions: (itemId: string) =>
    api.post('/plaid/sync-transactions', { item_id: itemId }),
  syncAllTransactions: () => api.post('/plaid/sync-all-transactions'),
  refreshBalances: (itemId: string) =>
    api.post('/plaid/refresh-balances', { item_id: itemId }),
  removeItem: (itemId: string) => api.delete(`/plaid/items/${itemId}`),
};

// Transaction endpoints
export const transactionApi = {
  getAll: (params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    accountId?: string;
    type?: string;
    search?: string;
  }) => api.get<{ transactions: Transaction[] }>('/transactions', { params }),
  getById: (id: string) => api.get<{ transaction: Transaction }>(`/transactions/${id}`),
  create: (data: Partial<Transaction>) => api.post<{ transaction: Transaction }>('/transactions', data),
  update: (id: string, data: Partial<Transaction>) =>
    api.put<{ transaction: Transaction }>(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
  uploadReceipt: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api.post(`/transactions/${id}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Account endpoints
export const accountApi = {
  getAll: () => api.get<{ accounts: Account[] }>('/accounts'),
  getById: (id: string) => api.get<{ account: Account }>(`/accounts/${id}`),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

// Budget endpoints
export const budgetApi = {
  getAll: (month: string, year: number) =>
    api.get<{ budgets: Budget[] }>('/budgets', { params: { month, year } }),
  create: (data: Partial<Budget>) => api.post<{ budget: Budget }>('/budgets', data),
  update: (id: string, amount: number) =>
    api.put<{ budget: Budget }>(`/budgets/${id}`, { amount }),
  delete: (id: string) => api.delete(`/budgets/${id}`),
};

// Category endpoints
export const categoryApi = {
  getAll: () => api.get<{ categories: Category[] }>('/categories'),
  getByType: (type: 'income' | 'expense') =>
    api.get<{ categories: Category[] }>(`/categories/${type}`),
};

// Analytics endpoints
export const analyticsApi = {
  getSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<Summary>('/analytics/summary', { params }),
  getSpendingByCategory: (params?: { startDate?: string; endDate?: string }) =>
    api.get<{ data: SpendingByCategory[] }>('/analytics/spending-by-category', { params }),
  getIncomeVsExpenses: (params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'month' | 'year';
  }) => api.get<{ data: IncomeVsExpenses[] }>('/analytics/income-vs-expenses', { params }),
  getNetWorth: () =>
    api.get<{ net_worth: number; available_balance: number; accounts: number }>('/analytics/net-worth'),
  exportTransactions: (params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    accountId?: string;
  }) => api.get('/analytics/export', { params, responseType: 'blob' }),
};

// Import endpoints
export const importApi = {
  parseFile: (file: File, accountId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (accountId) formData.append('account_id', accountId);

    return api.post<{
      transactions: ParsedTransaction[];
      mapping: ColumnMapping;
      duplicates: string[];
    }>('/import/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  confirmImport: (data: {
    transactions: ParsedTransaction[];
    accountId?: string;
  }) => api.post<ImportSummary>('/import/confirm', data),
};

export default api;
