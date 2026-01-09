import { useState, useEffect } from 'react';
import { Plus, Filter, Download, Search, Edit, Trash2, Receipt, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { transactionApi, analyticsApi } from '../services/api';
import { format } from 'date-fns';
import TransactionModal from '../components/TransactionModal';
import ImportModal from '../components/ImportModal';

export default function Transactions() {
  const { transactions, accounts, categories, refreshTransactions, removeTransaction } = useApp();
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    accountId: '',
    type: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  const applyFilters = () => {
    let filtered = [...transactions];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.merchant_name?.toLowerCase().includes(searchLower) ||
          t.notes?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters.accountId) {
      filtered = filtered.filter(t => t.account_id === filters.accountId);
    }

    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    if (filters.startDate) {
      filtered = filtered.filter(t => t.date >= filters.startDate);
    }

    if (filters.endDate) {
      filtered = filtered.filter(t => t.date <= filters.endDate);
    }

    setFilteredTransactions(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await transactionApi.delete(id);
      removeTransaction(id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    }
  };

  const handleExport = async () => {
    try {
      const response = await analyticsApi.exportTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category,
        accountId: filters.accountId,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'transactions.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting transactions:', error);
      alert('Failed to export transactions');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-green-600 dark:text-green-400';
      case 'expense':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn btn-secondary flex items-center">
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Upload size={20} className="mr-2" />
            Import
          </button>
          <button
            onClick={() => {
              setSelectedTransaction(null);
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="input pl-10"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="select"
            value={filters.category}
            onChange={e => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filters.accountId}
            onChange={e => setFilters({ ...filters, accountId: e.target.value })}
          >
            <option value="">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filters.type}
            onChange={e => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <input
            type="date"
            className="input"
            value={filters.startDate}
            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            placeholder="Start Date"
          />
          <input
            type="date"
            className="input"
            value={filters.endDate}
            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Transactions List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold">Date</th>
                <th className="text-left py-3 px-4 font-semibold">Name</th>
                <th className="text-left py-3 px-4 font-semibold">Category</th>
                <th className="text-left py-3 px-4 font-semibold">Account</th>
                <th className="text-right py-3 px-4 font-semibold">Amount</th>
                <th className="text-center py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(transaction => {
                const account = accounts.find(a => a.id === transaction.account_id);
                return (
                  <tr
                    key={transaction.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">{format(new Date(transaction.date), 'MMM dd, yyyy')}</td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">{transaction.name}</div>
                        {transaction.merchant_name && (
                          <div className="text-sm text-gray-500">{transaction.merchant_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                        {transaction.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{account?.name || 'N/A'}</td>
                    <td className={`py-3 px-4 text-right font-semibold ${getTypeColor(transaction.type)}`}>
                      {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center gap-2">
                        {transaction.receipt_path && (
                          <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                            <Receipt size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowModal(true);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <Edit size={18} />
                        </button>
                        {transaction.is_manual === 1 && (
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <p className="text-center py-8 text-gray-500">No transactions found</p>
          )}
        </div>
      </div>

      {showModal && (
        <TransactionModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowModal(false);
            setSelectedTransaction(null);
          }}
          onSave={() => {
            refreshTransactions();
            setShowModal(false);
            setSelectedTransaction(null);
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onComplete={() => {
            refreshTransactions();
            setShowImportModal(false);
          }}
        />
      )}
    </div>
  );
}
