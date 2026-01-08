import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';

const router = Router();

router.get('/', categoryController.getCategories);
router.get('/:type', categoryController.getCategoriesByType);

export default router;
