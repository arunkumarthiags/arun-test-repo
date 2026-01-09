import { useState } from 'react';
import { ParsedTransaction } from '../types';
import { format } from 'date-fns';

interface ImportPreviewTableProps {
  transactions: ParsedTransaction[];
}

export default function ImportPreviewTable({ transactions }: ImportPreviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Paginate transactions
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {currentTransactions.map((txn, index) => (
              <tr
                key={startIndex + index}
                className={txn.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {format(new Date(txn.date), 'MMM dd, yyyy')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  <div className="max-w-md truncate">{txn.description}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {txn.category || 'Uncategorized'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                  <span className="text-gray-900 dark:text-gray-100">
                    ${txn.amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  {txn.isDuplicate ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      Duplicate
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      New
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing <strong>{startIndex + 1}</strong> to{' '}
            <strong>{Math.min(endIndex, transactions.length)}</strong> of{' '}
            <strong>{transactions.length}</strong> transactions
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
