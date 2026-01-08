import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { TransactionModel } from '../models/Transaction';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG) and PDFs are allowed'));
    }
  }
});

/**
 * Get all transactions with optional filters
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, category, accountId, type, search } = req.query;

  const filters = {
    startDate: startDate as string,
    endDate: endDate as string,
    category: category as string,
    accountId: accountId as string,
    type: type as string,
    search: search as string,
  };

  const transactions = TransactionModel.findAll(filters);

  res.json({ transactions });
});

/**
 * Get a single transaction by ID
 */
export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const transaction = TransactionModel.findById(id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json({ transaction });
});

/**
 * Create a new transaction (manual entry)
 */
export const createTransaction = asyncHandler(async (req: Request, res: Response) => {
  const {
    account_id,
    amount,
    date,
    name,
    merchant_name,
    category,
    type,
    notes,
  } = req.body;

  // Validation
  if (!amount || !date || !name || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const transaction = TransactionModel.create({
    account_id,
    amount: parseFloat(amount),
    date,
    name,
    merchant_name,
    category,
    type,
    notes,
    is_manual: 1,
    pending: 0,
  });

  res.status(201).json({ transaction });
});

/**
 * Update a transaction
 */
export const updateTransaction = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const transaction = TransactionModel.findById(id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Don't allow updating certain fields for Plaid transactions
  if (transaction.plaid_transaction_id && !transaction.is_manual) {
    delete updates.amount;
    delete updates.date;
    delete updates.name;
  }

  const updated = TransactionModel.update(id, updates);

  res.json({ transaction: updated });
});

/**
 * Delete a transaction
 */
export const deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const transaction = TransactionModel.findById(id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Only allow deleting manual transactions
  if (transaction.plaid_transaction_id && !transaction.is_manual) {
    return res.status(400).json({ error: 'Cannot delete synced transactions from Plaid' });
  }

  // Delete receipt file if exists
  if (transaction.receipt_path && fs.existsSync(transaction.receipt_path)) {
    fs.unlinkSync(transaction.receipt_path);
  }

  TransactionModel.delete(id);

  res.json({ success: true });
});

/**
 * Upload receipt for a transaction
 */
export const uploadReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const transaction = TransactionModel.findById(id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Delete old receipt if exists
  if (transaction.receipt_path && fs.existsSync(transaction.receipt_path)) {
    fs.unlinkSync(transaction.receipt_path);
  }

  // Update transaction with new receipt path
  const updated = TransactionModel.update(id, {
    receipt_path: req.file.path,
  });

  res.json({ transaction: updated });
});
