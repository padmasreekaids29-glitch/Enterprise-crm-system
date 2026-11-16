import { Router } from 'express';
import {
  convertLead,
  createLead,
  deleteLead,
  getLeads,
  updateLead,
} from '../controllers/leadController.ts';
import { authenticate, authorize } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.get('/', getLeads);
router.post('/', createLead);
router.put('/:id', updateLead);
router.post('/:id/convert', convertLead);
router.delete('/:id', authorize('Admin', 'Manager'), deleteLead);

export default router;
