import { Router } from 'express';
import {
  createActivity,
  deleteActivity,
  getActivities,
  toggleActivityComplete,
  updateActivity,
} from '../controllers/activityController.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.get('/', getActivities);
router.post('/', createActivity);
router.put('/:id', updateActivity);
router.patch('/:id/toggle', toggleActivityComplete);
router.delete('/:id', deleteActivity);

export default router;
