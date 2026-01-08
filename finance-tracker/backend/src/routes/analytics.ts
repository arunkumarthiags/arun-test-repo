import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

router.get('/spending-by-category', analyticsController.getSpendingByCategory);
router.get('/income-vs-expenses', analyticsController.getIncomeVsExpenses);
router.get('/net-worth', analyticsController.getNetWorth);
router.get('/trends', analyticsController.getSpendingTrends);
router.get('/summary', analyticsController.getSummary);
router.get('/export', analyticsController.exportTransactions);

export default router;
