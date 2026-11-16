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
import { Customer, type CustomerSegment, type CustomerStatus } from '../models/Customer.ts';
import { Deal } from '../models/Deal.ts';
import { recordAudit } from '../utils/audit.ts';

const VALID_SEGMENTS: CustomerSegment[] = ['Enterprise', 'Mid-Market', 'SMB'];
const VALID_STATUSES: CustomerStatus[] = ['Active', 'Onboarding', 'At Risk', 'Churned'];

export const getCustomers = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const segment = typeof req.query.segment === 'string' ? req.query.segment.trim() : '';

  const filter: Record<string, unknown> = {};
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { company: regex }, { email: regex }, { industry: regex }];
  }
  if (status && status !== 'All') filter.status = status;
  if (segment && segment !== 'All') filter.segment = segment;

  const [customers, dealCounts] = await Promise.all([
    Customer.find(filter)
      .populate('assignedTo', 'name email avatar role')
      .sort({ createdAt: -1 })
      .lean(),
    Deal.aggregate([
      { $match: { customerId: { $ne: null } } },
      {
        $group: {
          _id: '$customerId',
          totalDeals: { $sum: 1 },
          openValue: {
            $sum: {
              $cond: [{ $in: ['$stage', ['Won', 'Lost']] }, 0, '$value'],
            },
          },
        },
      },
    ]),
  ]);

  const dealMap = new Map<string, { totalDeals: number; openValue: number }>();
  for (const row of dealCounts) {
    dealMap.set(String(row._id), { totalDeals: row.totalDeals, openValue: row.openValue });
  }

  res.json({
    success: true,
    customers: customers.map((c) => {
      const owner = c.assignedTo as { _id?: unknown; name?: string; email?: string; avatar?: string } | null;
      const stats = dealMap.get(String(c._id)) || { totalDeals: 0, openValue: 0 };
      return {
        id: String(c._id),
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        industry: c.industry,
        segment: c.segment,
        status: c.status,
        lifetimeValue: c.lifetimeValue,
        address: c.address,
        website: c.website,
        notes: c.notes,
        assignedTo: owner
          ? { id: String(owner._id), name: owner.name || '', email: owner.email || '', avatar: owner.avatar || '' }
          : null,
        totalDeals: stats.totalDeals,
        openPipelineValue: stats.openValue,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }),
  });
});

export const getCustomerById = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'customer ID');
  const customer = await Customer.findById(id)
    .populate('assignedTo', 'name email avatar role')
    .lean();

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  const [deals, activities] = await Promise.all([
    Deal.find({ customerId: customer._id })
      .populate('assignedTo', 'name avatar')
      .sort({ createdAt: -1 })
      .lean(),
    Activity.find({
      $or: [
        { relatedType: 'Customer', relatedId: customer._id },
        { relatedName: customer.company },
      ],
    })
      .populate('ownerId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const owner = customer.assignedTo as { _id?: unknown; name?: string; email?: string; avatar?: string } | null;

  res.json({
    success: true,
    customer: {
      id: String(customer._id),
      name: customer.name,
      company: customer.company,
      email: customer.email,
      phone: customer.phone,
      industry: customer.industry,
      segment: customer.segment,
      status: customer.status,
      lifetimeValue: customer.lifetimeValue,
      address: customer.address,
      website: customer.website,
      notes: customer.notes,
      assignedTo: owner
        ? { id: String(owner._id), name: owner.name || '', email: owner.email || '', avatar: owner.avatar || '' }
        : null,
      createdAt: customer.createdAt,
    },
    deals: deals.map((d) => ({
      id: String(d._id),
      title: d.title,
      value: d.value,
      stage: d.stage,
      probability: d.probability,
      expectedCloseDate: d.expectedCloseDate,
    })),
    history: activities.map((a) => {
      const actOwner = a.ownerId as { name?: string; avatar?: string } | null;
      return {
        id: String(a._id),
        type: a.type,
        subject: a.subject,
        description: a.description,
        completed: a.completed,
        followUpDate: a.followUpDate,
        createdAt: a.createdAt,
        ownerName: actOwner?.name || 'Team Member',
      };
    }),
  });
});

export const createCustomer = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const name = requireNonEmptyString(req.body.name, 'Contact name');
  const company = requireNonEmptyString(req.body.company, 'Company name');
  const email = validateEmail(req.body.email, 'Customer email');
  const segment: CustomerSegment = VALID_SEGMENTS.includes(req.body.segment)
    ? req.body.segment
    : 'Mid-Market';
  const status: CustomerStatus = VALID_STATUSES.includes(req.body.status)
    ? req.body.status
    : 'Active';

  let assignedTo: string | null = null;
  if (typeof req.body.assignedTo === 'string' && req.body.assignedTo.trim()) {
    assignedTo = assertValidObjectId(req.body.assignedTo.trim(), 'assigned owner ID');
  } else if (req.user) {
    assignedTo = String(req.user._id);
  }

  const customer = await Customer.create({
    name,
    company,
    email,
    phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : '',
    industry: typeof req.body.industry === 'string' && req.body.industry.trim() ? req.body.industry.trim() : 'Technology',
    segment,
    status,
    lifetimeValue: parsePositiveNumber(req.body.lifetimeValue, 0),
    address: typeof req.body.address === 'string' ? req.body.address.trim() : '',
    website: typeof req.body.website === 'string' ? req.body.website.trim() : '',
    notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : '',
    assignedTo,
    createdBy: req.user?._id || null,
  });

  if (req.user) {
    await recordAudit(
      req.user,
      'CUSTOMER_CREATED',
      'Customer',
      String(customer._id),
      `Added customer account "${customer.company}" (${customer.name})`
    );
  }

  res.status(201).json({ success: true, id: String(customer._id) });
});

export const updateCustomer = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'customer ID');
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  if (req.body.name !== undefined) customer.name = requireNonEmptyString(req.body.name, 'Contact name');
  if (req.body.company !== undefined) customer.company = requireNonEmptyString(req.body.company, 'Company name');
  if (req.body.email !== undefined) customer.email = validateEmail(req.body.email, 'Customer email');
  if (req.body.phone !== undefined) customer.phone = String(req.body.phone || '').trim();
  if (req.body.industry !== undefined) customer.industry = String(req.body.industry || '').trim();
  if (req.body.address !== undefined) customer.address = String(req.body.address || '').trim();
  if (req.body.website !== undefined) customer.website = String(req.body.website || '').trim();
  if (req.body.notes !== undefined) customer.notes = String(req.body.notes || '').trim();
  if (req.body.lifetimeValue !== undefined) {
    customer.lifetimeValue = parsePositiveNumber(req.body.lifetimeValue, customer.lifetimeValue);
  }
  if (req.body.segment !== undefined) {
    if (!VALID_SEGMENTS.includes(req.body.segment)) throw new AppError('Invalid segment', 400);
    customer.segment = req.body.segment;
  }
  if (req.body.status !== undefined) {
    if (!VALID_STATUSES.includes(req.body.status)) throw new AppError('Invalid status', 400);
    customer.status = req.body.status;
  }
  if (req.body.assignedTo !== undefined) {
    if (!req.body.assignedTo) {
      customer.assignedTo = null;
    } else {
      assertValidObjectId(String(req.body.assignedTo), 'assigned owner ID');
      customer.assignedTo = req.body.assignedTo;
    }
  }

  await customer.save();

  if (req.user) {
    await recordAudit(
      req.user,
      'CUSTOMER_UPDATED',
      'Customer',
      String(customer._id),
      `Updated customer profile "${customer.company}"`
    );
  }

  res.json({ success: true, message: 'Customer updated' });
});

export const deleteCustomer = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const id = assertValidObjectId(req.params.id, 'customer ID');
  const customer = await Customer.findByIdAndDelete(id);
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  if (req.user) {
    await recordAudit(
      req.user,
      'CUSTOMER_DELETED',
      'Customer',
      id,
      `Deleted customer "${customer.company}"`
    );
  }

  res.json({ success: true, message: 'Customer deleted' });
});
