import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../middleware/errorHandler.ts';
import {
  assertValidObjectId,
  parsePositiveNumber,
  requireNonEmptyString,
} from '../middleware/validate.ts';
import { Customer } from '../models/Customer.ts';
import { Deal, STAGE_PROBABILITY, type DealPriority, type DealStage } from '../models/Deal.ts';
import { recordAudit } from '../utils/audit.ts';

const VALID_STAGES: DealStage[] = [
  'Prospecting',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Won',
  'Lost',
];
const VALID_PRIORITIES: DealPriority[] = ['Low', 'Medium', 'High'];

export const getDeals = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const stage = typeof req.query.stage === 'string' ? req.query.stage.trim() : '';
  const assignedTo = typeof req.query.assignedTo === 'string' ? req.query.assignedTo.trim() : '';

  const filter: Record<string, unknown> = {};
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: regex }, { companyName: regex }];
  }
  if (stage && stage !== 'All') filter.stage = stage;
  if (assignedTo && assignedTo !== 'All') {
    assertValidObjectId(assignedTo, 'assigned owner ID');
    filter.assignedTo = assignedTo;
  }

  const deals = await Deal.find(filter)
    .populate('assignedTo', 'name email avatar role')
    .populate('customerId', 'name company')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({
    success: true,
    deals: deals.map((d) => {
      const owner = d.assignedTo as { _id?: unknown; name?: string; avatar?: string } | null;
      const customer = d.customerId as { _id?: unknown; name?: string; company?: string } | null;
      return {
        id: String(d._id),
        title: d.title,
        customerId: customer ? String(customer._id) : null,
        companyName: d.companyName || customer?.company || '',
        value: d.value,
        stage: d.stage,
        probability: d.probability,
        expectedCloseDate: d.expectedCloseDate,
        closedAt: d.closedAt,
        priority: d.priority,
        notes: d.notes,
        assignedTo: owner
          ? { id: String(owner._id), name: owner.name || '', avatar: owner.avatar || '' }
          : null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    }),
  });
});

export const createDeal = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const title = requireNonEmptyString(req.body.title, 'Deal title');
  const value = parsePositiveNumber(req.body.value, 0);
  const stage: DealStage = VALID_STAGES.includes(req.body.stage) ? req.body.stage : 'Prospecting';
  const priority: DealPriority = VALID_PRIORITIES.includes(req.body.priority)
    ? req.body.priority
    : 'Medium';

  let customerId: string | null = null;
  let companyName = typeof req.body.companyName === 'string' ? req.body.companyName.trim() : '';

  if (typeof req.body.customerId === 'string' && req.body.customerId.trim()) {
    customerId = assertValidObjectId(req.body.customerId.trim(), 'customer ID');
    const customer = await Customer.findById(customerId).lean();
    if (customer && !companyName) {
      companyName = customer.company;
    }
  }

  if (!companyName) {
    throw new AppError('Company name or customer is required', 400);
  }

  const expectedCloseDate = req.body.expectedCloseDate
    ? new Date(req.body.expectedCloseDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(expectedCloseDate.getTime())) {
    throw new AppError('Invalid expected closing date', 400);
  }

  let assignedTo: string | null = null;
  if (typeof req.body.assignedTo === 'string' && req.body.assignedTo.trim()) {
    assignedTo = assertValidObjectId(req.body.assignedTo.trim(), 'assigned owner ID');
  } else if (req.user) {
    assignedTo = String(req.user._id);
  }

  const deal = await Deal.create({
    title,
    customerId,
    companyName,
    value,
    stage,
    probability: STAGE_PROBABILITY[stage],
    expectedCloseDate,
    closedAt: stage === 'Won' || stage === 'Lost' ? new Date() : null,
    priority,
    assignedTo,
    notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : '',
    createdBy: req.user?._id || null,
  });

  if (req.user) {
    await recordAudit(
      req.user,
      'DEAL_CREATED',
      'Deal',
      String(deal._id),
      `Created deal "${deal.title}" ($${deal.value.toLocaleString()}) in ${deal.stage}`
    );
  }

  res.status(201).json({ success: true, id: String(deal._id) });
});

export const updateDeal = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'deal ID');
  const deal = await Deal.findById(id);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  if (req.body.title !== undefined) deal.title = requireNonEmptyString(req.body.title, 'Deal title');
  if (req.body.companyName !== undefined) {
    deal.companyName = requireNonEmptyString(req.body.companyName, 'Company name');
  }
  if (req.body.value !== undefined) deal.value = parsePositiveNumber(req.body.value, deal.value);
  if (req.body.notes !== undefined) deal.notes = String(req.body.notes || '').trim();
  if (req.body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(req.body.priority)) throw new AppError('Invalid priority', 400);
    deal.priority = req.body.priority;
  }
  if (req.body.expectedCloseDate !== undefined) {
    const parsed = new Date(req.body.expectedCloseDate);
    if (Number.isNaN(parsed.getTime())) throw new AppError('Invalid expected close date', 400);
    deal.expectedCloseDate = parsed;
  }
  if (req.body.stage !== undefined) {
    const nextStage = req.body.stage as DealStage;
    if (!VALID_STAGES.includes(nextStage)) throw new AppError('Invalid pipeline stage', 400);
    deal.stage = nextStage;
    deal.probability = STAGE_PROBABILITY[nextStage];
    deal.closedAt = nextStage === 'Won' || nextStage === 'Lost' ? deal.closedAt || new Date() : null;
  }
  if (req.body.assignedTo !== undefined) {
    if (!req.body.assignedTo) {
      deal.assignedTo = null;
    } else {
      assertValidObjectId(String(req.body.assignedTo), 'assigned owner ID');
      deal.assignedTo = req.body.assignedTo;
    }
  }
  if (req.body.customerId !== undefined) {
    if (!req.body.customerId) {
      deal.customerId = null;
    } else {
      assertValidObjectId(String(req.body.customerId), 'customer ID');
      deal.customerId = req.body.customerId;
    }
  }

  await deal.save();

  if (req.user) {
    await recordAudit(
      req.user,
      'DEAL_UPDATED',
      'Deal',
      String(deal._id),
      `Updated deal "${deal.title}" ($${deal.value.toLocaleString()})`
    );
  }

  res.json({ success: true, message: 'Deal updated' });
});

export const updateDealStage = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'deal ID');
  const stage = req.body.stage as DealStage;
  if (!VALID_STAGES.includes(stage)) {
    throw new AppError('Invalid pipeline stage', 400);
  }

  const deal = await Deal.findById(id);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  const previousStage = deal.stage;
  deal.stage = stage;
  deal.probability = STAGE_PROBABILITY[stage];
  deal.closedAt = stage === 'Won' || stage === 'Lost' ? new Date() : null;
  await deal.save();

  if (req.user) {
    await recordAudit(
      req.user,
      'DEAL_STAGE_UPDATED',
      'Deal',
      String(deal._id),
      `Moved "${deal.title}" from ${previousStage} to ${stage}`
    );
  }

  res.json({
    success: true,
    deal: {
      id: String(deal._id),
      stage: deal.stage,
      probability: deal.probability,
      closedAt: deal.closedAt,
    },
  });
});

export const deleteDeal = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'deal ID');
  const deal = await Deal.findByIdAndDelete(id);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  if (req.user) {
    await recordAudit(
      req.user,
      'DEAL_DELETED',
      'Deal',
      id,
      `Deleted deal "${deal.title}"`
    );
  }

  res.json({ success: true, message: 'Deal removed from pipeline' });
});
