import { db } from '../utils/database';
import { randomUUID } from 'crypto';

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

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  accountId?: string;
  type?: string;
  search?: string;
}

export class TransactionModel {
  static create(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Transaction {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, account_id, plaid_transaction_id, amount, date, name, merchant_name,
        category, subcategory, type, pending, notes, receipt_path, is_manual, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      transaction.account_id || null,
      transaction.plaid_transaction_id || null,
      transaction.amount,
      transaction.date,
      transaction.name,
      transaction.merchant_name || null,
      transaction.category || null,
      transaction.subcategory || null,
      transaction.type,
      transaction.pending || 0,
      transaction.notes || null,
      transaction.receipt_path || null,
      transaction.is_manual || 0,
      now,
      now
    );

    return this.findById(id)!;
  }

  static findById(id: string): Transaction | undefined {
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined;
  }

  static findByPlaidId(plaidId: string): Transaction | undefined {
    return db.prepare('SELECT * FROM transactions WHERE plaid_transaction_id = ?').get(plaidId) as Transaction | undefined;
  }

  static findAll(filters?: TransactionFilters): Transaction[] {
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) {
      query += ' AND date >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ' AND date <= ?';
      params.push(filters.endDate);
    }

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.accountId) {
      query += ' AND account_id = ?';
      params.push(filters.accountId);
    }

    if (filters?.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters?.search) {
      query += ' AND (name LIKE ? OR merchant_name LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    return db.prepare(query).all(...params) as Transaction[];
  }

  static findByDateRange(startDate: string, endDate: string): Transaction[] {
    return db.prepare('SELECT * FROM transactions WHERE date >= ? AND date <= ?')
      .all(startDate, endDate) as Transaction[];
  }

  static update(id: string, updates: Partial<Transaction>): Transaction | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString(), id);

    const query = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    return this.findById(id);
  }

  static delete(id: string): void {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  }

  static bulkCreate(transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]): void {
    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, account_id, plaid_transaction_id, amount, date, name, merchant_name,
        category, subcategory, type, pending, notes, receipt_path, is_manual, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((txns: typeof transactions) => {
      const now = new Date().toISOString();
      for (const txn of txns) {
        // Check for duplicates
        if (txn.plaid_transaction_id) {
          const existing = this.findByPlaidId(txn.plaid_transaction_id);
          if (existing) continue;
        }

        const id = randomUUID();
        stmt.run(
          id,
          txn.account_id || null,
          txn.plaid_transaction_id || null,
          txn.amount,
          txn.date,
          txn.name,
          txn.merchant_name || null,
          txn.category || null,
          txn.subcategory || null,
          txn.type,
          txn.pending || 0,
          txn.notes || null,
          txn.receipt_path || null,
          txn.is_manual || 0,
          now,
          now
        );
      }
    });

    insertMany(transactions);
  }
}
