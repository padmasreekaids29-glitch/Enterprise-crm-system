import { Router } from 'express';
import {
  createDeal,
  deleteDeal,
  getDeals,
  updateDeal,
  updateDealStage,
} from '../controllers/dealController.ts';
import { authenticate, authorize } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.get('/', getDeals);
router.post('/', createDeal);
router.put('/:id', updateDeal);
router.patch('/:id/stage', updateDealStage);
router.delete('/:id', authorize('Admin', 'Manager'), deleteDeal);

export default router;
