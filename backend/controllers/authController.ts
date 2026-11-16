import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { signToken, type AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../middleware/errorHandler.ts';
import { requireNonEmptyString, validateEmail } from '../middleware/validate.ts';
import { User, type IUser, type UserRole } from '../models/User.ts';
import { recordAudit } from '../utils/audit.ts';

function sanitizeUser(user: IUser) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    phone: user.phone,
    department: user.department,
    avatar: user.avatar,
    teamId: user.teamId ? String(user.teamId) : null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    notificationPreferences: user.notificationPreferences,
    createdAt: user.createdAt,
  };
}

export const register = asyncHandler(async (req, res: Response) => {
  const name = requireNonEmptyString(req.body.name, 'Full name');
  const email = validateEmail(req.body.email);
  const password = requireNonEmptyString(req.body.password, 'Password');

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const allowedSignupRoles: UserRole[] = ['Admin', 'Manager', 'Sales Executive'];
  const requestedRole = allowedSignupRoles.includes(req.body.role)
    ? (req.body.role as UserRole)
    : 'Sales Executive';

  const avatarByRole: Record<UserRole, string> = {
    Admin: '/src/assets/images/avatar_admin_user_1794844537853.jpg',
    Manager: '/src/assets/images/avatar_manager_user_1794844537088.jpg',
    'Sales Executive': '/src/assets/images/avatar_exec_one_1794844537623.jpg',
  };

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: passwordHash,
    role: requestedRole,
    title: typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : requestedRole,
    department:
      typeof req.body.department === 'string' && req.body.department.trim()
        ? req.body.department.trim()
        : 'Enterprise Sales',
    avatar: avatarByRole[requestedRole],
    lastLoginAt: new Date(),
  });

  const token = signToken(String(user._id), user.role);

  await recordAudit(
    user,
    'USER_REGISTERED',
    'User',
    String(user._id),
    `New ${user.role} account registered: ${user.name} (${user.email})`
  );

  res.status(201).json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

export const login = asyncHandler(async (req, res: Response) => {
  const email = validateEmail(req.body.email);
  const password = requireNonEmptyString(req.body.password, 'Password');

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact an administrator.', 403);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(String(user._id), user.role);

  await recordAudit(
    user,
    'USER_LOGIN',
    'User',
    String(user._id),
    `${user.name} signed into NEXORA CRM`
  );

  res.json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

export const getMe = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  res.json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

export const logout = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  if (req.user) {
    await recordAudit(
      req.user,
      'USER_LOGOUT',
      'User',
      String(req.user._id),
      `${req.user.name} signed out`
    );
  }
  res.json({ success: true, message: 'Signed out successfully' });
});

export const getUsersDirectory = asyncHandler<AuthenticatedRequest>(async (_req, res: Response) => {
  const users = await User.find({ isActive: true })
    .select('name email role title avatar department teamId')
    .sort({ name: 1 })
    .lean();

  res.json({
    success: true,
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      title: u.title,
      avatar: u.avatar,
      department: u.department,
    })),
  });
});
