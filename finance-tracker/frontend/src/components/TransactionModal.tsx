import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Transaction } from '../types';
import { transactionApi } from '../services/api';
import { useApp } from '../context/AppContext';

interface TransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onSave: () => void;
}

export default function TransactionModal({ transaction, onClose, onSave }: TransactionModalProps) {
  const { accounts, categories, addTransaction, updateTransaction } = useApp();
  const [formData, setFormData] = useState({
    account_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    name: '',
    merchant_name: '',
    category: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setFormData({
        account_id: transaction.account_id || '',
        amount: transaction.amount.toString(),
        date: transaction.date,
        name: transaction.name,
        merchant_name: transaction.merchant_name || '',
        category: transaction.category || '',
        type: transaction.type,
        notes: transaction.notes || '',
      });
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
      };

      if (transaction) {
        const response = await transactionApi.update(transaction.id, data);
        updateTransaction(response.data.transaction);
      } else {
        const response = await transactionApi.create(data);
        addTransaction(response.data.transaction);
      }

      onSave();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {transaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type *</label>
              <select
                className="select"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                required
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Amount *</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date *</label>
              <input
                type="date"
                className="input"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                className="select"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">Select category</option>
                {categories
                  .filter(cat => cat.type === formData.type)
                  .map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Merchant</label>
              <input
                type="text"
                className="input"
                value={formData.merchant_name}
                onChange={e => setFormData({ ...formData, merchant_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Account</label>
              <select
                className="select"
                value={formData.account_id}
                onChange={e => setFormData({ ...formData, account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                className="input"
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
