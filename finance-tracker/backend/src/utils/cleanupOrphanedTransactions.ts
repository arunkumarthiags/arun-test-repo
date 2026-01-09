import { db } from './database';

/**
 * Clean up orphaned transactions (transactions that reference deleted accounts)
 */
export function cleanupOrphanedTransactions(): void {
  // Delete transactions where account_id doesn't exist in accounts table
  const result = db.prepare(`
    DELETE FROM transactions
    WHERE account_id IS NOT NULL
    AND account_id NOT IN (SELECT id FROM accounts)
  `).run();

  console.log(`✅ Cleaned up ${result.changes} orphaned transactions`);
}

/**
 * Delete all Plaid-synced transactions (where is_manual = 0)
 */
export function deleteAllPlaidTransactions(): void {
  const result = db.prepare(`
    DELETE FROM transactions
    WHERE is_manual = 0
  `).run();

  console.log(`✅ Deleted ${result.changes} Plaid-synced transactions`);
}

// Run cleanup if this file is executed directly
if (require.main === module) {
  console.log('🧹 Starting database cleanup...');

  console.log('\n1. Cleaning up orphaned transactions...');
  cleanupOrphanedTransactions();

  console.log('\n2. Deleting all Plaid-synced transactions...');
  deleteAllPlaidTransactions();

  console.log('\n✨ Cleanup complete!');
}
