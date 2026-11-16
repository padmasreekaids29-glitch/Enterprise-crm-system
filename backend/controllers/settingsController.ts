import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../middleware/errorHandler.ts';
import { requireNonEmptyString } from '../middleware/validate.ts';
import { User } from '../models/User.ts';
import { recordAudit } from '../utils/audit.ts';

export const updateProfile = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User account not found', 404);
  }

  if (req.body.name !== undefined) user.name = requireNonEmptyString(req.body.name, 'Full name');
  if (req.body.phone !== undefined) user.phone = String(req.body.phone || '').trim();
  if (req.body.title !== undefined) user.title = String(req.body.title || '').trim();
  if (req.body.department !== undefined) user.department = String(req.body.department || '').trim();
  if (req.body.avatar !== undefined && typeof req.body.avatar === 'string' && req.body.avatar.trim()) {
    user.avatar = req.body.avatar.trim();
  }

  await user.save();

  await recordAudit(user, 'PROFILE_UPDATED', 'User', String(user._id), `${user.name} updated profile details`);

  res.json({
    success: true,
    user: {
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
    },
  });
});

export const changePassword = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const currentPassword = requireNonEmptyString(req.body.currentPassword, 'Current password');
  const newPassword = requireNonEmptyString(req.body.newPassword, 'New password');

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters long', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  await recordAudit(user, 'PASSWORD_CHANGED', 'User', String(user._id), `${user.name} changed account password`);

  res.json({ success: true, message: 'Password updated successfully' });
});

export const updatePreferences = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.notificationPreferences = {
    dealStageChanges:
      req.body.dealStageChanges !== undefined
        ? Boolean(req.body.dealStageChanges)
        : user.notificationPreferences.dealStageChanges,
    leadAssignments:
      req.body.leadAssignments !== undefined
        ? Boolean(req.body.leadAssignments)
        : user.notificationPreferences.leadAssignments,
    dailyTaskDigest:
      req.body.dailyTaskDigest !== undefined
        ? Boolean(req.body.dailyTaskDigest)
        : user.notificationPreferences.dailyTaskDigest,
    weeklySummary:
      req.body.weeklySummary !== undefined
        ? Boolean(req.body.weeklySummary)
        : user.notificationPreferences.weeklySummary,
  };

  await user.save();

  res.json({
    success: true,
    notificationPreferences: user.notificationPreferences,
  });
});
