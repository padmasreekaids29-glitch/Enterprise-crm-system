import { Router } from 'express';
import { getMe, getUsersDirectory, login, logout, register } from '../controllers/authController.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/users-directory', authenticate, getUsersDirectory);

export default router;
