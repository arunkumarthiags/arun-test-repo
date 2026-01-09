export interface Account {
  id: string;
  plaid_account_id?: string;
  plaid_item_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  mask?: string;
  current_balance?: number;
  available_balance?: number;
  currency_code: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id?: string;
  plaid_transaction_id?: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category?: string;
  subcategory?: string;
  type: 'income' | 'expense' | 'transfer';
  pending: number;
  notes?: string;
  receipt_path?: string;
  is_manual: number;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  month: string;
  year: number;
  spent?: number;
  remaining?: number;
  percentage?: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

export interface PlaidItem {
  id: string;
  item_id: string;
  institution_name?: string;
  accounts: Account[];
  created_at: string;
}

export interface Summary {
  income: number;
  expenses: number;
  net: number;
  transactions: number;
}

export interface SpendingByCategory {
  category: string;
  total: number;
  count: number;
}

export interface IncomeVsExpenses {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  category?: string;
  isDuplicate: boolean;
  confidence: number;
}

export interface ColumnMapping {
  date: string | number;
  amount: string | number;
  description: string | number;
  category?: string | number;
  confidence: number;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  errors: string[];
}
