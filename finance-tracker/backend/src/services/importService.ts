import path from 'path';
import { parseCSV, RawTransaction } from './parsers/csvParser';
import { parseXLSX } from './parsers/xlsxParser';
import { parsePDF } from './parsers/pdfParser';
import { detectColumns, ColumnMapping } from '../utils/columnDetector';
import { TransactionModel } from '../models/Transaction';
import { categorizeTransaction, determineTransactionType } from '../utils/categorizer';
import { format, parse, isValid } from 'date-fns';

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  category?: string;
  isDuplicate: boolean;
  confidence: number;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  mapping: ColumnMapping;
  duplicates: string[];
}

/**
 * Parse uploaded file based on file type
 */
export async function parseFile(filePath: string): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase();

  let rawData: RawTransaction[];

  // Parse based on file type
  if (ext === '.csv') {
    rawData = await parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    rawData = await parseXLSX(filePath);
  } else if (ext === '.pdf') {
    rawData = await parsePDF(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  if (rawData.length === 0) {
    throw new Error('File is empty or contains no transaction data');
  }

  // Auto-detect column mapping
  const mapping = detectColumns(rawData);

  // Transform to parsed transactions
  const transactions = transformToTransactions(rawData, mapping);

  // Check for duplicates
  const duplicateIds = await checkDuplicates(transactions);

  // Mark duplicates
  const transactionsWithDuplicates = transactions.map((txn, index) => ({
    ...txn,
    isDuplicate: duplicateIds.includes(index),
  }));

  return {
    transactions: transactionsWithDuplicates,
    mapping,
    duplicates: duplicateIds.map(id => String(id)),
  };
}

/**
 * Transform raw data to parsed transactions using column mapping
 */
function transformToTransactions(
  rawData: RawTransaction[],
  mapping: ColumnMapping
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (const row of rawData) {
    try {
      // Extract values using mapping
      const dateValue = row[mapping.date];
      const amountValue = row[mapping.amount];
      const descriptionValue = row[mapping.description];
      const categoryValue = mapping.category ? row[mapping.category] : undefined;

      // Parse date
      const date = parseDate(dateValue);
      if (!date) {
        console.warn(`Skipping row with invalid date: ${dateValue}`);
        continue;
      }

      // Parse amount
      const amount = parseAmount(amountValue);
      if (amount === 0) {
        console.warn(`Skipping row with zero amount`);
        continue;
      }

      // Parse description
      const description = String(descriptionValue || '').trim();
      if (!description) {
        console.warn(`Skipping row with empty description`);
        continue;
      }

      // Category (optional)
      const category = categoryValue ? String(categoryValue).trim() : undefined;

      transactions.push({
        date,
        amount,
        description,
        category,
        isDuplicate: false,
        confidence: mapping.confidence,
      });
    } catch (error) {
      console.error('Error parsing row:', error);
      // Continue with next row
    }
  }

  return transactions;
}

/**
 * Parse date from various formats
 */
function parseDate(value: any): string | null {
  if (!value) return null;

  const dateStr = String(value).trim();

  // Common date formats to try
  const formats = [
    'MM/dd/yyyy',
    'M/d/yyyy',
    'MM/dd/yy',
    'M/d/yy',
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'd/M/yyyy',
    'MMM dd, yyyy',
    'MMM d, yyyy',
  ];

  // Try ISO format first
  let parsedDate = new Date(dateStr);
  if (isValid(parsedDate)) {
    return format(parsedDate, 'yyyy-MM-dd');
  }

  // Try common formats
  for (const fmt of formats) {
    try {
      parsedDate = parse(dateStr, fmt, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    } catch {
      // Try next format
    }
  }

  return null;
}

/**
 * Parse amount from string or number
 */
function parseAmount(value: any): number {
  if (typeof value === 'number') {
    return Math.abs(value);
  }

  const amountStr = String(value).replace(/[$,]/g, '').trim();
  const parsed = parseFloat(amountStr);

  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

/**
 * Check for duplicate transactions in database
 */
async function checkDuplicates(transactions: ParsedTransaction[]): Promise<number[]> {
  if (transactions.length === 0) return [];

  // Get date range from import
  const dates = transactions.map(t => new Date(t.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Expand range by ±7 days for fuzzy matching
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 7);

  // Fetch existing transactions in date range
  const existingTransactions = TransactionModel.findByDateRange(
    format(minDate, 'yyyy-MM-dd'),
    format(maxDate, 'yyyy-MM-dd')
  );

  // Create lookup set for O(1) duplicate checking
  const existingSet = new Set<string>();
  for (const txn of existingTransactions) {
    const key = createDuplicateKey(txn.date, txn.amount, txn.name);
    existingSet.add(key);
  }

  // Check each transaction for duplicates
  const duplicateIndices: number[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];
    const key = createDuplicateKey(txn.date, txn.amount, txn.description);

    if (existingSet.has(key)) {
      duplicateIndices.push(i);
    }
  }

  return duplicateIndices;
}

/**
 * Create duplicate detection key
 */
function createDuplicateKey(date: string, amount: number, description: string): string {
  const normalizedDesc = description.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${date}_${amount.toFixed(2)}_${normalizedDesc}`;
}

/**
 * Import transactions to database
 */
export async function importTransactions(
  transactions: ParsedTransaction[],
  accountId?: string
): Promise<ImportSummary> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Filter out duplicates
  const uniqueTransactions = transactions.filter(txn => {
    if (txn.isDuplicate) {
      skipped++;
      return false;
    }
    return true;
  });

  if (uniqueTransactions.length === 0) {
    return { imported: 0, skipped, errors };
  }

  // Transform to transaction data
  const transactionsData = uniqueTransactions.map(txn => {
    const category = txn.category || categorizeTransaction(txn.description, undefined);
    const type = determineTransactionType(txn.amount, category);

    return {
      amount: txn.amount,
      date: txn.date,
      name: txn.description,
      merchant_name: undefined,
      category,
      type,
      account_id: accountId || undefined,
      is_manual: 1, // Imported transactions are considered manual
      pending: 0,
    };
  });

  // Batch insert in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < transactionsData.length; i += chunkSize) {
    const chunk = transactionsData.slice(i, i + chunkSize);

    try {
      TransactionModel.bulkCreate(chunk);
      imported += chunk.length;
    } catch (error: any) {
      errors.push(`Failed to import chunk starting at row ${i + 1}: ${error.message}`);
    }
  }

  return { imported, skipped, errors };
}
