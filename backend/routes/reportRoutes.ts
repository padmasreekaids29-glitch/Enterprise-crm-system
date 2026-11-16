import { Router } from 'express';
import { getReportsOverview } from '../controllers/reportController.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.get('/overview', getReportsOverview);

export default router;
