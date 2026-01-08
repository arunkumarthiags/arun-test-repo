import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Moon, Sun, Building2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { plaidApi } from '../services/api';
import { PlaidItem } from '../types';
import PlaidLink from '../components/PlaidLink';
import { format } from 'date-fns';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await plaidApi.getItems();
      setItems(response.data.items);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (itemId: string) => {
    try {
      setSyncing(itemId);
      await plaidApi.syncTransactions(itemId);
      alert('Transactions synced successfully!');
    } catch (error) {
      console.error('Error syncing transactions:', error);
      alert('Failed to sync transactions');
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing('all');
      await plaidApi.syncAllTransactions();
      alert('All transactions synced successfully!');
    } catch (error) {
      console.error('Error syncing all transactions:', error);
      alert('Failed to sync transactions');
    } finally {
      setSyncing(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!confirm('Are you sure you want to disconnect this account? This will remove all associated accounts.')) {
      return;
    }

    try {
      await plaidApi.removeItem(itemId);
      loadItems();
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove account');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Appearance */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-gray-500">
              Current: {theme === 'light' ? 'Light' : 'Dark'} Mode
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="btn btn-secondary flex items-center"
          >
            {theme === 'light' ? <Moon size={20} className="mr-2" /> : <Sun size={20} className="mr-2" />}
            Toggle Theme
          </button>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Connected Accounts</h2>
          <div className="flex gap-2">
            {items.length > 0 && (
              <button
                onClick={handleSyncAll}
                disabled={syncing !== null}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw size={20} className={`mr-2 ${syncing === 'all' ? 'animate-spin' : ''}`} />
                Sync All
              </button>
            )}
            <PlaidLink onSuccess={loadItems} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No bank accounts connected yet</p>
            <PlaidLink onSuccess={loadItems} />
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div
                key={item.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{item.institution_name}</h3>
                    <p className="text-sm text-gray-500">
                      Connected on {format(new Date(item.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSync(item.item_id)}
                      disabled={syncing !== null}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Sync transactions"
                    >
                      <RefreshCw
                        size={20}
                        className={syncing === item.item_id ? 'animate-spin' : ''}
                      />
                    </button>
                    <button
                      onClick={() => handleRemove(item.item_id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded-lg"
                      title="Disconnect account"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Accounts:</p>
                  {item.accounts.map(account => (
                    <div
                      key={account.id}
                      className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded p-3"
                    >
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-gray-500">
                          {account.type} {account.subtype && `• ${account.subtype}`}
                          {account.mask && ` • ****${account.mask}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${account.current_balance?.toLocaleString() || '0.00'}
                        </p>
                        {account.available_balance !== undefined &&
                          account.available_balance !== account.current_balance && (
                            <p className="text-sm text-gray-500">
                              Available: ${account.available_balance.toLocaleString()}
                            </p>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong>Finance Tracker</strong> - Personal finance management application
          </p>
          <p>Version 1.0.0</p>
          <p>
            This application uses Plaid for secure bank account connections and automatic
            transaction syncing.
          </p>
        </div>
      </div>
    </div>
  );
}
