import { Router } from 'express';
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUser,
  createTeam,
  deleteTeam,
  getAdminOverview,
  updateTeam,
} from '../controllers/adminController.ts';
import { authenticate, authorize } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.use(authorize('Admin', 'Manager'));

router.get('/overview', getAdminOverview);
router.post('/users', authorize('Admin'), adminCreateUser);
router.put('/users/:id', adminUpdateUser);
router.delete('/users/:id', authorize('Admin'), adminDeleteUser);

router.post('/teams', createTeam);
router.put('/teams/:id', updateTeam);
router.delete('/teams/:id', authorize('Admin'), deleteTeam);

export default router;
