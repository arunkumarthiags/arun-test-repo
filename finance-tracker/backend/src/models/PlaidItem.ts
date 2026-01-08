import { db } from '../utils/database';
import { encrypt, decrypt } from '../utils/encryption';
import { randomUUID } from 'crypto';

export interface PlaidItem {
  id: string;
  access_token: string;
  item_id: string;
  institution_id?: string;
  institution_name?: string;
  cursor?: string;
  created_at: string;
  updated_at: string;
}

export class PlaidItemModel {
  static create(item: Omit<PlaidItem, 'id' | 'created_at' | 'updated_at'>): PlaidItem {
    const id = randomUUID();
    const now = new Date().toISOString();
    const encryptedToken = encrypt(item.access_token);

    const stmt = db.prepare(`
      INSERT INTO plaid_items (
        id, access_token, item_id, institution_id, institution_name, cursor, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      encryptedToken,
      item.item_id,
      item.institution_id || null,
      item.institution_name || null,
      item.cursor || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  static findById(id: string): PlaidItem | undefined {
    const item = db.prepare('SELECT * FROM plaid_items WHERE id = ?').get(id) as PlaidItem | undefined;
    if (item) {
      item.access_token = decrypt(item.access_token);
    }
    return item;
  }

  static findByItemId(itemId: string): PlaidItem | undefined {
    const item = db.prepare('SELECT * FROM plaid_items WHERE item_id = ?').get(itemId) as PlaidItem | undefined;
    if (item) {
      item.access_token = decrypt(item.access_token);
    }
    return item;
  }

  static findAll(): PlaidItem[] {
    const items = db.prepare('SELECT * FROM plaid_items ORDER BY created_at DESC').all() as PlaidItem[];
    return items.map(item => ({
      ...item,
      access_token: decrypt(item.access_token)
    }));
  }

  static updateCursor(itemId: string, cursor: string): void {
    db.prepare('UPDATE plaid_items SET cursor = ?, updated_at = ? WHERE item_id = ?')
      .run(cursor, new Date().toISOString(), itemId);
  }

  static delete(itemId: string): void {
    db.prepare('DELETE FROM plaid_items WHERE item_id = ?').run(itemId);
  }
}
