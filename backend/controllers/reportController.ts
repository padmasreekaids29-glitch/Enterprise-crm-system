import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { Deal, type DealStage } from '../models/Deal.ts';
import { Lead, type LeadStatus } from '../models/Lead.ts';
import { User } from '../models/User.ts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STAGES: DealStage[] = [
  'Prospecting',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Won',
  'Lost',
];
const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

export const getReportsOverview = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const monthsWindow = Math.min(12, Math.max(3, Number(req.query.months) || 6));

  const [deals, leads, users] = await Promise.all([
    Deal.find().populate('assignedTo', 'name role avatar').lean(),
    Lead.find().lean(),
    User.find({ isActive: true }).select('name role avatar').lean(),
  ]);

  const wonDeals = deals.filter((d) => d.stage === 'Won');
  const lostDeals = deals.filter((d) => d.stage === 'Lost');
  const openDeals = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');

  const now = new Date();
  const monthlyRevenue: Array<{
    month: string;
    actualRevenue: number;
    targetRevenue: number;
    dealsClosed: number;
  }> = [];

  for (let i = monthsWindow - 1; i >= 0; i -= 1) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const monthWon = wonDeals.filter((d) => {
      const dt = new Date(d.closedAt || d.expectedCloseDate || d.createdAt);
      return dt.getFullYear() === y && dt.getMonth() === m;
    });
    const actualRevenue = monthWon.reduce((s, d) => s + (d.value || 0), 0);
    monthlyRevenue.push({
      month: `${MONTH_LABELS[m]} ${String(y).slice(2)}`,
      actualRevenue,
      targetRevenue: 135000 + (monthsWindow - 1 - i) * 12000,
      dealsClosed: monthWon.length,
    });
  }

  // Sales performance by representative
  const salesPerformance = users.map((u) => {
    const uid = String(u._id);
    const repDeals = deals.filter((d) => {
      const owner = d.assignedTo as { _id?: unknown } | null;
      return owner && String(owner._id) === uid;
    });
    const repWon = repDeals.filter((d) => d.stage === 'Won');
    const repLost = repDeals.filter((d) => d.stage === 'Lost');
    const closedTotal = repWon.length + repLost.length;
    const revenue = repWon.reduce((s, d) => s + (d.value || 0), 0);
    const pipeline = repDeals
      .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
      .reduce((s, d) => s + (d.value || 0), 0);

    return {
      id: uid,
      name: u.name,
      role: u.role,
      avatar: u.avatar,
      dealsWon: repWon.length,
      dealsLost: repLost.length,
      winRate: closedTotal > 0 ? Math.round((repWon.length / closedTotal) * 100) : 0,
      revenue,
      pipeline,
      avgDealSize: repWon.length > 0 ? Math.round(revenue / repWon.length) : 0,
    };
  });

  // Lead conversion funnel & source conversion
  const leadFunnel = LEAD_STATUSES.map((status) => {
    const matching = leads.filter((l) => l.status === status);
    return {
      status,
      count: matching.length,
      value: matching.reduce((s, l) => s + (l.estimatedValue || 0), 0),
    };
  });

  const sourceBreakdownMap = new Map<string, { total: number; converted: number; value: number }>();
  for (const lead of leads) {
    const entry = sourceBreakdownMap.get(lead.source) || { total: 0, converted: 0, value: 0 };
    entry.total += 1;
    entry.value += lead.estimatedValue || 0;
    if (lead.status === 'Converted' || lead.status === 'Qualified') {
      entry.converted += 1;
    }
    sourceBreakdownMap.set(lead.source, entry);
  }

  const leadSourceAnalytics = Array.from(sourceBreakdownMap.entries()).map(([source, stats]) => ({
    source,
    total: stats.total,
    qualifiedOrConverted: stats.converted,
    qualificationRate: stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0,
    estimatedValue: stats.value,
  }));

  // Deal stage analytics
  const dealStageAnalytics = STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const value = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
    const weightedValue = Math.round(
      stageDeals.reduce((s, d) => s + ((d.value || 0) * (d.probability || 0)) / 100, 0)
    );
    return {
      stage,
      count: stageDeals.length,
      value,
      weightedValue,
    };
  });

  const closedCount = wonDeals.length + lostDeals.length;
  const totalWonRevenue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);

  res.json({
    success: true,
    summary: {
      totalWonRevenue,
      openPipelineValue: openDeals.reduce((s, d) => s + (d.value || 0), 0),
      winRate: closedCount > 0 ? Number(((wonDeals.length / closedCount) * 100).toFixed(1)) : 0,
      avgWonDealSize: wonDeals.length > 0 ? Math.round(totalWonRevenue / wonDeals.length) : 0,
      totalLeads: leads.length,
      leadConversionRate:
        leads.length > 0
          ? Number(
              ((leads.filter((l) => l.status === 'Converted').length / leads.length) * 100).toFixed(1)
            )
          : 0,
    },
    monthlyRevenue,
    salesPerformance,
    leadFunnel,
    leadSourceAnalytics,
    dealStageAnalytics,
  });
});
