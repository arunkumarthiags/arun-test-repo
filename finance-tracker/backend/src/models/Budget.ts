import { db } from '../utils/database';
import { randomUUID } from 'crypto';

export interface Budget {
  id: string;
  category: string;
  amount: number;
  month: string;
  year: number;
  created_at: string;
  updated_at: string;
}

export class BudgetModel {
  static create(budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>): Budget {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO budgets (id, category, amount, month, year, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, budget.category, budget.amount, budget.month, budget.year, now, now);

    return this.findById(id)!;
  }

  static findById(id: string): Budget | undefined {
    return db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as Budget | undefined;
  }

  static findByMonthYear(month: string, year: number): Budget[] {
    return db.prepare('SELECT * FROM budgets WHERE month = ? AND year = ?').all(month, year) as Budget[];
  }

  static findByCategoryMonthYear(category: string, month: string, year: number): Budget | undefined {
    return db.prepare('SELECT * FROM budgets WHERE category = ? AND month = ? AND year = ?')
      .get(category, month, year) as Budget | undefined;
  }

  static update(id: string, amount: number): Budget | undefined {
    db.prepare('UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ?')
      .run(amount, new Date().toISOString(), id);
    return this.findById(id);
  }

  static delete(id: string): void {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
  }
}
