import { Router } from 'express';
import { getDashboardOverview } from '../controllers/dashboardController.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.get('/overview', getDashboardOverview);

export default router;
