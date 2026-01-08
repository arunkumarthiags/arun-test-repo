import { db } from '../utils/database';
import { randomUUID } from 'crypto';

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

export class AccountModel {
  static create(account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Account {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO accounts (
        id, plaid_account_id, plaid_item_id, name, official_name, type, subtype,
        mask, current_balance, available_balance, currency_code, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      account.plaid_account_id || null,
      account.plaid_item_id,
      account.name,
      account.official_name || null,
      account.type,
      account.subtype || null,
      account.mask || null,
      account.current_balance || null,
      account.available_balance || null,
      account.currency_code,
      account.is_active,
      now,
      now
    );

    return this.findById(id)!;
  }

  static findById(id: string): Account | undefined {
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
  }

  static findByPlaidAccountId(plaidAccountId: string): Account | undefined {
    return db.prepare('SELECT * FROM accounts WHERE plaid_account_id = ?').get(plaidAccountId) as Account | undefined;
  }

  static findByItemId(itemId: string): Account[] {
    return db.prepare('SELECT * FROM accounts WHERE plaid_item_id = ? AND is_active = 1').all(itemId) as Account[];
  }

  static findAll(): Account[] {
    return db.prepare('SELECT * FROM accounts WHERE is_active = 1 ORDER BY created_at DESC').all() as Account[];
  }

  static updateBalance(id: string, currentBalance: number, availableBalance?: number): void {
    db.prepare(`
      UPDATE accounts
      SET current_balance = ?, available_balance = ?, updated_at = ?
      WHERE id = ?
    `).run(currentBalance, availableBalance || null, new Date().toISOString(), id);
  }

  static delete(id: string): void {
    db.prepare('UPDATE accounts SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }
}
