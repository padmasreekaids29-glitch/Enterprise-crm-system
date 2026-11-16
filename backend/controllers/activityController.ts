import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../middleware/errorHandler.ts';
import { assertValidObjectId, requireNonEmptyString } from '../middleware/validate.ts';
import {
  Activity,
  type ActivityPriority,
  type ActivityRelatedType,
  type ActivityType,
} from '../models/Activity.ts';
import { recordAudit } from '../utils/audit.ts';

const VALID_TYPES: ActivityType[] = ['Call', 'Meeting', 'Task', 'Note'];
const VALID_RELATED: ActivityRelatedType[] = ['Lead', 'Customer', 'Deal', 'General'];
const VALID_PRIORITIES: ActivityPriority[] = ['Low', 'Medium', 'High'];

export const getActivities = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const filter: Record<string, unknown> = {};
  if (type && type !== 'All') filter.type = type;
  if (status === 'pending') filter.completed = false;
  if (status === 'completed') filter.completed = true;
  if (status === 'overdue') {
    filter.completed = false;
    filter.followUpDate = { $lt: new Date(), $ne: null };
  }
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ subject: regex }, { description: regex }, { relatedName: regex }];
  }

  const activities = await Activity.find(filter)
    .populate('ownerId', 'name email avatar role')
    .sort({ completed: 1, followUpDate: 1, createdAt: -1 })
    .lean();

  res.json({
    success: true,
    activities: activities.map((a) => {
      const owner = a.ownerId as { _id?: unknown; name?: string; avatar?: string } | null;
      return {
        id: String(a._id),
        type: a.type,
        subject: a.subject,
        description: a.description,
        relatedType: a.relatedType,
        relatedId: a.relatedId ? String(a.relatedId) : null,
        relatedName: a.relatedName,
        followUpDate: a.followUpDate,
        completed: a.completed,
        completedAt: a.completedAt,
        priority: a.priority,
        owner: owner
          ? { id: String(owner._id), name: owner.name || '', avatar: owner.avatar || '' }
          : null,
        createdAt: a.createdAt,
      };
    }),
  });
});

export const createActivity = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const type = req.body.type as ActivityType;
  if (!VALID_TYPES.includes(type)) {
    throw new AppError('Activity type must be Call, Meeting, Task, or Note', 400);
  }
  const subject = requireNonEmptyString(req.body.subject, 'Activity subject');
  const relatedType: ActivityRelatedType = VALID_RELATED.includes(req.body.relatedType)
    ? req.body.relatedType
    : 'General';
  const priority: ActivityPriority = VALID_PRIORITIES.includes(req.body.priority)
    ? req.body.priority
    : 'Medium';

  let relatedId: string | null = null;
  if (typeof req.body.relatedId === 'string' && req.body.relatedId.trim()) {
    relatedId = assertValidObjectId(req.body.relatedId.trim(), 'related entity ID');
  }

  let followUpDate: Date | null = null;
  if (req.body.followUpDate) {
    followUpDate = new Date(req.body.followUpDate);
    if (Number.isNaN(followUpDate.getTime())) {
      throw new AppError('Invalid follow-up date', 400);
    }
  }

  let ownerId: string | null = null;
  if (typeof req.body.ownerId === 'string' && req.body.ownerId.trim()) {
    ownerId = assertValidObjectId(req.body.ownerId.trim(), 'owner ID');
  } else if (req.user) {
    ownerId = String(req.user._id);
  }

  const completed = Boolean(req.body.completed);

  const activity = await Activity.create({
    type,
    subject,
    description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
    relatedType,
    relatedId,
    relatedName: typeof req.body.relatedName === 'string' ? req.body.relatedName.trim() : '',
    followUpDate,
    completed,
    completedAt: completed ? new Date() : null,
    priority,
    ownerId,
    createdBy: req.user?._id || null,
  });

  if (req.user) {
    await recordAudit(
      req.user,
      'ACTIVITY_CREATED',
      'Activity',
      String(activity._id),
      `Logged ${activity.type}: "${activity.subject}"`
    );
  }

  res.status(201).json({ success: true, id: String(activity._id) });
});

export const updateActivity = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'activity ID');
  const activity = await Activity.findById(id);
  if (!activity) {
    throw new AppError('Activity not found', 404);
  }

  if (req.body.type !== undefined) {
    if (!VALID_TYPES.includes(req.body.type)) throw new AppError('Invalid activity type', 400);
    activity.type = req.body.type;
  }
  if (req.body.subject !== undefined) {
    activity.subject = requireNonEmptyString(req.body.subject, 'Activity subject');
  }
  if (req.body.description !== undefined) {
    activity.description = String(req.body.description || '').trim();
  }
  if (req.body.relatedName !== undefined) {
    activity.relatedName = String(req.body.relatedName || '').trim();
  }
  if (req.body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(req.body.priority)) throw new AppError('Invalid priority', 400);
    activity.priority = req.body.priority;
  }
  if (req.body.followUpDate !== undefined) {
    activity.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : null;
  }
  if (req.body.completed !== undefined) {
    activity.completed = Boolean(req.body.completed);
    activity.completedAt = activity.completed ? activity.completedAt || new Date() : null;
  }

  await activity.save();
  res.json({ success: true, message: 'Activity updated' });
});

export const toggleActivityComplete = asyncHandler<AuthenticatedRequest>(
  async (req, res: Response) => {
    const id = assertValidObjectId(req.params.id, 'activity ID');
    const activity = await Activity.findById(id);
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    activity.completed = !activity.completed;
    activity.completedAt = activity.completed ? new Date() : null;
    await activity.save();

    if (req.user) {
      await recordAudit(
        req.user,
        activity.completed ? 'ACTIVITY_COMPLETED' : 'ACTIVITY_REOPENED',
        'Activity',
        String(activity._id),
        `${activity.completed ? 'Completed' : 'Reopened'} ${activity.type}: "${activity.subject}"`
      );
    }

    res.json({
      success: true,
      completed: activity.completed,
      completedAt: activity.completedAt,
    });
  }
);

export const deleteActivity = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'activity ID');
  const activity = await Activity.findByIdAndDelete(id);
  if (!activity) {
    throw new AppError('Activity not found', 404);
  }
  res.json({ success: true, message: 'Activity deleted' });
});
