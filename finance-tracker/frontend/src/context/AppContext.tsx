import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, Account, Category } from '../types';
import { transactionApi, accountApi, categoryApi } from '../services/api';

interface AppContextType {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  loading: boolean;
  refreshTransactions: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  removeTransaction: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        refreshTransactions(),
        refreshAccounts(),
        loadCategories(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTransactions = async () => {
    try {
      const response = await transactionApi.getAll();
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const refreshAccounts = async () => {
    try {
      const response = await accountApi.getAll();
      setAccounts(response.data.accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await categoryApi.getAll();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };

  const updateTransaction = (transaction: Transaction) => {
    setTransactions(prev =>
      prev.map(t => (t.id === transaction.id ? transaction : t))
    );
  };

  const removeTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        transactions,
        accounts,
        categories,
        loading,
        refreshTransactions,
        refreshAccounts,
        addTransaction,
        updateTransaction,
        removeTransaction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
