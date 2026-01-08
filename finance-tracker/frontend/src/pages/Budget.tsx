import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import { Budget as BudgetType } from '../types';
import { budgetApi } from '../services/api';
import { format } from 'date-fns';
import BudgetModal from '../components/BudgetModal';

export default function Budget() {
  const [budgets, setBudgets] = useState<BudgetType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetType | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadBudgets();
  }, [currentDate]);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();

      const response = await budgetApi.getAll(month, year);
      setBudgets(response.data.budgets);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;

    try {
      await budgetApi.delete(id);
      loadBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      alert('Failed to delete budget');
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <AlertCircle className="text-red-500" size={20} />;
    if (percentage >= 80) return <AlertCircle className="text-yellow-500" size={20} />;
    return <TrendingUp className="text-green-500" size={20} />;
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Budget</h1>
          <p className="text-gray-500 mt-1">{format(currentDate, 'MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="btn btn-secondary"
          >
            Current
          </button>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="btn btn-secondary"
          >
            Next
          </button>
          <button
            onClick={() => {
              setSelectedBudget(null);
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Add Budget
          </button>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Overall Budget</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Budget</p>
            <p className="text-2xl font-bold mt-1">${totalBudget.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
            <p className="text-2xl font-bold mt-1 text-red-600">${totalSpent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(totalRemaining).toLocaleString()}
            </p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>{overallPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${getProgressColor(overallPercentage)}`}
              style={{ width: `${Math.min(overallPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Budget Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgets.map(budget => (
          <div key={budget.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(budget.percentage || 0)}
                <div>
                  <h3 className="font-semibold text-lg">{budget.category}</h3>
                  <p className="text-sm text-gray-500">
                    ${budget.spent?.toFixed(2) || 0} of ${budget.amount.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedBudget(budget);
                    setShowModal(true);
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(budget.id)}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{budget.percentage?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${getProgressColor(budget.percentage || 0)}`}
                  style={{ width: `${Math.min(budget.percentage || 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>
                  Remaining: ${budget.remaining?.toFixed(2) || 0}
                </span>
                {(budget.percentage || 0) >= 100 && (
                  <span className="text-red-600 font-medium">
                    Over budget by ${Math.abs(budget.remaining || 0).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {budgets.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No budgets set for this month</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Create Your First Budget
          </button>
        </div>
      )}

      {showModal && (
        <BudgetModal
          budget={selectedBudget}
          currentDate={currentDate}
          onClose={() => {
            setShowModal(false);
            setSelectedBudget(null);
          }}
          onSave={() => {
            loadBudgets();
            setShowModal(false);
            setSelectedBudget(null);
          }}
        />
      )}
    </div>
  );
}
