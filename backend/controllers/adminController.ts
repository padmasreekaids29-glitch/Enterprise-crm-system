import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../middleware/errorHandler.ts';
import {
  assertValidObjectId,
  parsePositiveNumber,
  requireNonEmptyString,
  validateEmail,
} from '../middleware/validate.ts';
import { Activity } from '../models/Activity.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Customer } from '../models/Customer.ts';
import { Deal } from '../models/Deal.ts';
import { Lead } from '../models/Lead.ts';
import { Team } from '../models/Team.ts';
import { User, type UserRole } from '../models/User.ts';
import { recordAudit } from '../utils/audit.ts';

const VALID_ROLES: UserRole[] = ['Admin', 'Manager', 'Sales Executive'];

export const getAdminOverview = asyncHandler<AuthenticatedRequest>(async (_req, res: Response) => {
  const [users, teams, auditLogs, leadCount, customerCount, dealCount, activityCount] =
    await Promise.all([
      User.find().populate('teamId', 'name region').sort({ createdAt: -1 }).lean(),
      Team.find().populate('managerId', 'name email').sort({ name: 1 }).lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(40).lean(),
      Lead.countDocuments(),
      Customer.countDocuments(),
      Deal.countDocuments(),
      Activity.countDocuments(),
    ]);

  const deals = await Deal.find({ stage: 'Won' }).select('assignedTo value').lean();
  const revenueByUser = new Map<string, number>();
  for (const deal of deals) {
    if (deal.assignedTo) {
      const uid = String(deal.assignedTo);
      revenueByUser.set(uid, (revenueByUser.get(uid) || 0) + (deal.value || 0));
    }
  }

  res.json({
    success: true,
    systemOverview: {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      totalTeams: teams.length,
      collections: {
        leads: leadCount,
        customers: customerCount,
        deals: dealCount,
        activities: activityCount,
      },
    },
    users: users.map((u) => {
      const team = u.teamId as { _id?: unknown; name?: string; region?: string } | null;
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
        department: u.department,
        avatar: u.avatar,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        team: team ? { id: String(team._id), name: team.name || '' } : null,
        closedRevenue: revenueByUser.get(String(u._id)) || 0,
        createdAt: u.createdAt,
      };
    }),
    teams: teams.map((t) => {
      const mgr = t.managerId as { _id?: unknown; name?: string } | null;
      const members = users.filter(
        (u) => u.teamId && String((u.teamId as { _id?: unknown })._id) === String(t._id)
      );
      const teamRevenue = members.reduce(
        (sum, m) => sum + (revenueByUser.get(String(m._id)) || 0),
        0
      );
      return {
        id: String(t._id),
        name: t.name,
        region: t.region,
        description: t.description,
        monthlyQuota: t.monthlyQuota,
        manager: mgr ? { id: String(mgr._id), name: mgr.name || '' } : null,
        memberCount: members.length,
        teamRevenue,
      };
    }),
    auditLogs: auditLogs.map((log) => ({
      id: String(log._id),
      actorName: log.actorName,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      summary: log.summary,
      createdAt: log.createdAt,
    })),
  });
});

export const adminCreateUser = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const name = requireNonEmptyString(req.body.name, 'Full name');
  const email = validateEmail(req.body.email);
  const password = requireNonEmptyString(req.body.password, 'Initial password');
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }
  const role: UserRole = VALID_ROLES.includes(req.body.role) ? req.body.role : 'Sales Executive';
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  let teamId: string | null = null;
  if (typeof req.body.teamId === 'string' && req.body.teamId.trim()) {
    teamId = assertValidObjectId(req.body.teamId.trim(), 'team ID');
  }

  const avatarMap: Record<UserRole, string> = {
    Admin: '/src/assets/images/avatar_admin_user_1794844537853.jpg',
    Manager: '/src/assets/images/avatar_manager_user_1794844537088.jpg',
    'Sales Executive': '/src/assets/images/avatar_exec_two_1794844537761.jpg',
  };

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await User.create({
    name,
    email,
    password: passwordHash,
    role,
    title: typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : role,
    department: typeof req.body.department === 'string' ? req.body.department.trim() : 'Enterprise Sales',
    teamId,
    avatar: avatarMap[role],
    isActive: true,
  });

  if (req.user) {
    await recordAudit(
      req.user,
      'ADMIN_USER_CREATED',
      'User',
      String(created._id),
      `Provisioned ${created.role} account for ${created.name}`
    );
  }

  res.status(201).json({ success: true, id: String(created._id) });
});

export const adminUpdateUser = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'user ID');
  const target = await User.findById(id);
  if (!target) {
    throw new AppError('User not found', 404);
  }

  if (req.body.role !== undefined) {
    if (req.user?.role !== 'Admin') {
      throw new AppError('Only Administrators can change user roles', 403);
    }
    if (!VALID_ROLES.includes(req.body.role)) {
      throw new AppError('Invalid role selected', 400);
    }
    target.role = req.body.role;
  }

  if (req.body.isActive !== undefined) {
    if (req.user?.role !== 'Admin') {
      throw new AppError('Only Administrators can change user activation status', 403);
    }
    if (String(target._id) === String(req.user?._id) && !req.body.isActive) {
      throw new AppError('You cannot deactivate your own active administrator account', 400);
    }
    target.isActive = Boolean(req.body.isActive);
  }

  if (req.body.teamId !== undefined) {
    if (!req.body.teamId) {
      target.teamId = null;
    } else {
      assertValidObjectId(String(req.body.teamId), 'team ID');
      target.teamId = req.body.teamId;
    }
  }

  if (req.body.title !== undefined) {
    target.title = String(req.body.title || '').trim();
  }

  await target.save();

  if (req.user) {
    await recordAudit(
      req.user,
      'ADMIN_USER_UPDATED',
      'User',
      String(target._id),
      `Updated access/team assignment for ${target.name} (${target.role})`
    );
  }

  res.json({ success: true, message: 'User updated' });
});

export const adminDeleteUser = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'user ID');
  if (req.user && String(req.user._id) === id) {
    throw new AppError('You cannot delete your own account', 400);
  }
  const target = await User.findByIdAndDelete(id);
  if (!target) {
    throw new AppError('User not found', 404);
  }

  if (req.user) {
    await recordAudit(
      req.user,
      'ADMIN_USER_DELETED',
      'User',
      id,
      `Removed user account ${target.name} (${target.email})`
    );
  }

  res.json({ success: true, message: 'User removed' });
});

export const createTeam = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const name = requireNonEmptyString(req.body.name, 'Team name');
  const region = typeof req.body.region === 'string' && req.body.region.trim() ? req.body.region.trim() : 'Global';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const monthlyQuota = parsePositiveNumber(req.body.monthlyQuota, 250000);

  let managerId: string | null = null;
  if (typeof req.body.managerId === 'string' && req.body.managerId.trim()) {
    managerId = assertValidObjectId(req.body.managerId.trim(), 'manager ID');
  }

  const team = await Team.create({ name, region, description, monthlyQuota, managerId });

  if (req.user) {
    await recordAudit(
      req.user,
      'TEAM_CREATED',
      'Team',
      String(team._id),
      `Created sales team "${team.name}" (${team.region})`
    );
  }

  res.status(201).json({ success: true, id: String(team._id) });
});

export const updateTeam = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'team ID');
  const team = await Team.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  if (req.body.name !== undefined) team.name = requireNonEmptyString(req.body.name, 'Team name');
  if (req.body.region !== undefined) team.region = String(req.body.region || '').trim();
  if (req.body.description !== undefined) team.description = String(req.body.description || '').trim();
  if (req.body.monthlyQuota !== undefined) {
    team.monthlyQuota = parsePositiveNumber(req.body.monthlyQuota, team.monthlyQuota);
  }
  if (req.body.managerId !== undefined) {
    if (!req.body.managerId) {
      team.managerId = null;
    } else {
      assertValidObjectId(String(req.body.managerId), 'manager ID');
      team.managerId = req.body.managerId;
    }
  }

  await team.save();
  res.json({ success: true, message: 'Team updated' });
});

export const deleteTeam = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'team ID');
  const team = await Team.findByIdAndDelete(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }
  await User.updateMany({ teamId: id }, { $set: { teamId: null } });
  res.json({ success: true, message: 'Team deleted' });
});
