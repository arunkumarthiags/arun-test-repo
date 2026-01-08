import { Router } from 'express';
import * as transactionController from '../controllers/transactionController';

const router = Router();

// Get all transactions
router.get('/', transactionController.getTransactions);

// Get single transaction
router.get('/:id', transactionController.getTransaction);

// Create transaction
router.post('/', transactionController.createTransaction);

// Update transaction
router.put('/:id', transactionController.updateTransaction);

// Delete transaction
router.delete('/:id', transactionController.deleteTransaction);

// Upload receipt
router.post('/:id/receipt', transactionController.upload.single('receipt'), transactionController.uploadReceipt);

export default router;
