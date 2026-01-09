import { Router } from 'express';
import * as importController from '../controllers/importController';

const router = Router();

// Parse uploaded file
router.post('/parse',
  importController.importUpload.single('file'),
  importController.parseFile
);

// Confirm and import transactions
router.post('/confirm', importController.confirmImport);

export default router;
