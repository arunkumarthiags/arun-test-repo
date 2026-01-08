import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Budget } from '../types';
import { budgetApi } from '../services/api';
import { useApp } from '../context/AppContext';

interface BudgetModalProps {
  budget: Budget | null;
  currentDate: Date;
  onClose: () => void;
  onSave: () => void;
}

export default function BudgetModal({ budget, currentDate, onClose, onSave }: BudgetModalProps) {
  const { categories } = useApp();
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (budget) {
      setFormData({
        category: budget.category,
        amount: budget.amount.toString(),
      });
    }
  }, [budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();

      if (budget) {
        await budgetApi.update(budget.id, parseFloat(formData.amount));
      } else {
        await budgetApi.create({
          category: formData.category,
          amount: parseFloat(formData.amount),
          month,
          year,
        });
      }

      onSave();
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Failed to save budget');
    } finally {
      setLoading(false);
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{budget ? 'Edit Budget' : 'Add Budget'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select
              className="select"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              required
              disabled={!!budget}
            >
              <option value="">Select category</option>
              {expenseCategories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Budget Amount *</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              required
            />
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
