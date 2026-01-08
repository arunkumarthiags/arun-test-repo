import { db } from '../utils/database';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

export class CategoryModel {
  static findAll(): Category[] {
    return db.prepare('SELECT * FROM categories ORDER BY type, name').all() as Category[];
  }

  static findByType(type: 'income' | 'expense'): Category[] {
    return db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type) as Category[];
  }

  static findByName(name: string): Category | undefined {
    return db.prepare('SELECT * FROM categories WHERE name = ?').get(name) as Category | undefined;
  }
}
