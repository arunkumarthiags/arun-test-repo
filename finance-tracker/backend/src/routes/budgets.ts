import { Router } from 'express';
import * as budgetController from '../controllers/budgetController';

const router = Router();

router.get('/', budgetController.getBudgets);
router.post('/', budgetController.createBudget);
router.put('/:id', budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

export default router;
