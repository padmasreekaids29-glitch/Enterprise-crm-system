import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../middleware/errorHandler.ts';
import {
  assertValidObjectId,
  parsePositiveNumber,
  requireNonEmptyString,
  validateEmail,
} from '../middleware/validate.ts';
import { Customer } from '../models/Customer.ts';
import { Deal, STAGE_PROBABILITY } from '../models/Deal.ts';
import { Lead, type LeadSource, type LeadStatus } from '../models/Lead.ts';
import { recordAudit } from '../utils/audit.ts';

const VALID_SOURCES: LeadSource[] = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold Outreach',
  'Partner',
  'Conference',
];
const VALID_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

export const getLeads = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 8));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const source = typeof req.query.source === 'string' ? req.query.source.trim() : '';
  const assignedTo = typeof req.query.assignedTo === 'string' ? req.query.assignedTo.trim() : '';

  const filter: Record<string, unknown> = {};

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { company: regex }];
  }
  if (status && status !== 'All') {
    filter.status = status;
  }
  if (source && source !== 'All') {
    filter.source = source;
  }
  if (assignedTo && assignedTo !== 'All') {
    if (assignedTo === 'Unassigned') {
      filter.assignedTo = null;
    } else {
      assertValidObjectId(assignedTo, 'assigned user ID');
      filter.assignedTo = assignedTo;
    }
  }

  const [total, leads, statusCounts] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.find(filter)
      .populate('assignedTo', 'name email role avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const summary = VALID_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {});
  for (const row of statusCounts) {
    if (row._id) summary[row._id] = row.count;
  }

  res.json({
    success: true,
    leads: leads.map((l) => {
      const owner = l.assignedTo as { _id?: unknown; name?: string; email?: string; avatar?: string } | null;
      return {
        id: String(l._id),
        name: l.name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        source: l.source,
        status: l.status,
        estimatedValue: l.estimatedValue,
        notes: l.notes,
        assignedTo: owner
          ? { id: String(owner._id), name: owner.name || '', email: owner.email || '', avatar: owner.avatar || '' }
          : null,
        convertedCustomerId: l.convertedCustomerId ? String(l.convertedCustomerId) : null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary,
  });
});

export const createLead = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const name = requireNonEmptyString(req.body.name, 'Lead name');
  const email = validateEmail(req.body.email, 'Lead email');
  const company = requireNonEmptyString(req.body.company, 'Company name');
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const source: LeadSource = VALID_SOURCES.includes(req.body.source) ? req.body.source : 'Website';
  const status: LeadStatus = VALID_STATUSES.includes(req.body.status) ? req.body.status : 'New';
  const estimatedValue = parsePositiveNumber(req.body.estimatedValue, 15000);
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

  let assignedTo: string | null = null;
  if (typeof req.body.assignedTo === 'string' && req.body.assignedTo.trim()) {
    assignedTo = assertValidObjectId(req.body.assignedTo.trim(), 'assigned sales executive ID');
  } else if (req.user) {
    assignedTo = String(req.user._id);
  }

  const lead = await Lead.create({
    name,
    email,
    phone,
    company,
    source,
    status,
    estimatedValue,
    notes,
    assignedTo,
    createdBy: req.user?._id || null,
  });

  if (req.user) {
    await recordAudit(
      req.user,
      'LEAD_CREATED',
      'Lead',
      String(lead._id),
      `Added lead "${lead.name}" (${lead.company})`
    );
  }

  res.status(201).json({ success: true, id: String(lead._id) });
});

export const updateLead = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'lead ID');
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  if (req.body.name !== undefined) lead.name = requireNonEmptyString(req.body.name, 'Lead name');
  if (req.body.email !== undefined) lead.email = validateEmail(req.body.email, 'Lead email');
  if (req.body.company !== undefined) lead.company = requireNonEmptyString(req.body.company, 'Company name');
  if (req.body.phone !== undefined) lead.phone = String(req.body.phone || '').trim();
  if (req.body.notes !== undefined) lead.notes = String(req.body.notes || '').trim();
  if (req.body.estimatedValue !== undefined) {
    lead.estimatedValue = parsePositiveNumber(req.body.estimatedValue, lead.estimatedValue);
  }
  if (req.body.source !== undefined) {
    if (!VALID_SOURCES.includes(req.body.source)) {
      throw new AppError('Invalid lead source', 400);
    }
    lead.source = req.body.source;
  }
  if (req.body.status !== undefined) {
    if (!VALID_STATUSES.includes(req.body.status)) {
      throw new AppError('Invalid lead status', 400);
    }
    lead.status = req.body.status;
  }
  if (req.body.assignedTo !== undefined) {
    if (!req.body.assignedTo) {
      lead.assignedTo = null;
    } else {
      assertValidObjectId(String(req.body.assignedTo), 'assigned user ID');
      lead.assignedTo = req.body.assignedTo;
    }
  }

  await lead.save();

  if (req.user) {
    await recordAudit(
      req.user,
      'LEAD_UPDATED',
      'Lead',
      String(lead._id),
      `Updated lead "${lead.name}" (${lead.status})`
    );
  }

  res.json({ success: true, message: 'Lead updated' });
});

export const deleteLead = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'lead ID');
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  if (req.user) {
    await recordAudit(
      req.user,
      'LEAD_DELETED',
      'Lead',
      id,
      `Deleted lead "${lead.name}" (${lead.company})`
    );
  }

  res.json({ success: true, message: 'Lead deleted' });
});

export const convertLead = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'lead ID');
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }
  if (lead.status === 'Converted' && lead.convertedCustomerId) {
    throw new AppError('This lead has already been converted to a customer', 400);
  }

  const customer = await Customer.create({
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    industry: typeof req.body.industry === 'string' && req.body.industry.trim() ? req.body.industry.trim() : 'Technology',
    segment: req.body.segment || 'Mid-Market',
    status: 'Onboarding',
    lifetimeValue: lead.estimatedValue || 0,
    notes: lead.notes,
    assignedTo: lead.assignedTo || req.user?._id || null,
    createdBy: req.user?._id || null,
  });

  const createDealFlag = req.body.createDeal !== false;
  let createdDealId: string | null = null;
  if (createDealFlag) {
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 30);
    const deal = await Deal.create({
      title:
        typeof req.body.dealTitle === 'string' && req.body.dealTitle.trim()
          ? req.body.dealTitle.trim()
          : `${lead.company} — Enterprise Platform`,
      customerId: customer._id,
      companyName: lead.company,
      value: lead.estimatedValue || 25000,
      stage: 'Qualification',
      probability: STAGE_PROBABILITY.Qualification,
      expectedCloseDate: closeDate,
      priority: 'Medium',
      assignedTo: lead.assignedTo || req.user?._id || null,
      notes: `Converted from lead ${lead.name}`,
      createdBy: req.user?._id || null,
    });
    createdDealId = String(deal._id);
  }

  lead.status = 'Converted';
  lead.convertedCustomerId = customer._id;
  await lead.save();

  if (req.user) {
    await recordAudit(
      req.user,
      'LEAD_CONVERTED',
      'Lead',
      String(lead._id),
      `Converted lead "${lead.name}" (${lead.company}) into Customer account`
    );
  }

  res.status(201).json({
    success: true,
    customerId: String(customer._id),
    dealId: createdDealId,
  });
});
