import { Router } from 'express';
import {
  changePassword,
  updatePreferences,
  updateProfile,
} from '../controllers/settingsController.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

router.use(authenticate);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.put('/preferences', updatePreferences);

export default router;
