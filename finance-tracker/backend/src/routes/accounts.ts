import { Router } from 'express';
import * as accountController from '../controllers/accountController';

const router = Router();

router.get('/', accountController.getAccounts);
router.get('/:id', accountController.getAccount);
router.delete('/:id', accountController.deleteAccount);

export default router;
