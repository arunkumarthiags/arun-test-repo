import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../middleware/errorHandler';
import * as importService from '../services/importService';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/imports';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const importUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLSX, and PDF files are allowed'));
    }
  }
});

/**
 * Parse uploaded file and return parsed transactions with column mapping
 */
export const parseFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
    });
  }

  try {
    const filePath = req.file.path;

    // Parse the file
    const result = await importService.parseFile(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json(result);
  } catch (error: any) {
    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting temp file:', unlinkError);
      }
    }

    if (error.message.includes('Could not auto-detect')) {
      return res.status(422).json({
        error: 'Unable to parse file',
        message: error.message,
        suggestion: 'Please ensure your file has proper headers (Date, Amount, Description) and contains transaction data.',
      });
    }

    if (error.message.includes('empty') || error.message.includes('no data')) {
      return res.status(422).json({
        error: 'File is empty',
        message: error.message,
      });
    }

    if (error.message.includes('Unsupported file type')) {
      return res.status(415).json({
        error: 'Unsupported file type',
        message: error.message,
      });
    }

    throw error; // Let error handler deal with it
  }
});

/**
 * Confirm import and insert transactions into database
 */
export const confirmImport = asyncHandler(async (req: Request, res: Response) => {
  const { transactions, accountId } = req.body;

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'transactions array is required',
    });
  }

  if (transactions.length === 0) {
    return res.json({
      imported: 0,
      skipped: 0,
      errors: [],
    });
  }

  try {
    const summary = await importService.importTransactions(transactions, accountId);

    res.json(summary);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Import failed',
      message: error.message,
    });
  }
});
