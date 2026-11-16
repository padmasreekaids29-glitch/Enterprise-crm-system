import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { Activity } from '../models/Activity.ts';
import { Customer } from '../models/Customer.ts';
import { Deal } from '../models/Deal.ts';
import { Lead } from '../models/Lead.ts';
import { User } from '../models/User.ts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const getDashboardOverview = asyncHandler<AuthenticatedRequest>(async (_req, res: Response) => {
  const [totalLeads, convertedLeads, totalCustomers, allDeals, recentActivities, users] =
    await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'Converted' }),
      Customer.countDocuments(),
      Deal.find().populate('assignedTo', 'name role avatar').lean(),
      Activity.find().sort({ createdAt: -1 }).limit(6).populate('ownerId', 'name avatar role').lean(),
      User.find({ isActive: true }).select('name role avatar title').lean(),
    ]);

  const wonDeals = allDeals.filter((d) => d.stage === 'Won');
  const activeDeals = allDeals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
  const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const activePipelineValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedPipeline = activeDeals.reduce(
    (sum, d) => sum + ((d.value || 0) * (d.probability || 0)) / 100,
    0
  );

  const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

  // Build 6-month sales series from actual Won deals
  const now = new Date();
  const monthlySales: Array<{ month: string; revenue: number; deals: number; target: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthWon = wonDeals.filter((deal) => {
      const refDate = new Date(deal.closedAt || deal.expectedCloseDate || deal.createdAt);
      return refDate.getFullYear() === year && refDate.getMonth() === month;
    });
    const revenue = monthWon.reduce((acc, item) => acc + (item.value || 0), 0);
    monthlySales.push({
      month: `${MONTH_LABELS[month]} ${String(year).slice(2)}`,
      revenue,
      deals: monthWon.length,
      target: 140000 + (5 - i) * 10000,
    });
  }

  // Lead source breakdown via MongoDB aggregation
  const leadSourceAgg = await Lead.aggregate([
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        estimatedValue: { $sum: '$estimatedValue' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const leadSources = leadSourceAgg.map((entry) => ({
    source: entry._id || 'Other',
    count: entry.count,
    estimatedValue: entry.estimatedValue,
  }));

  // Sales performance per team member
  const salesPerformance = users
    .filter((u) => u.role === 'Sales Executive' || u.role === 'Manager' || u.role === 'Admin')
    .map((u) => {
      const uid = String(u._id);
      const userDeals = allDeals.filter((d) => {
        const owner = d.assignedTo as { _id?: unknown } | null;
        return owner && String(owner._id) === uid;
      });
      const userWon = userDeals.filter((d) => d.stage === 'Won');
      const userOpen = userDeals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
      const revenue = userWon.reduce((sum, d) => sum + (d.value || 0), 0);
      const pipeline = userOpen.reduce((sum, d) => sum + (d.value || 0), 0);
      const quota = u.role === 'Sales Executive' ? 350000 : 200000;
      return {
        id: uid,
        name: u.name,
        role: u.role,
        avatar: u.avatar,
        dealsWon: userWon.length,
        openDeals: userOpen.length,
        revenue,
        pipeline,
        quotaAttainment: Math.min(100, Math.round((revenue / quota) * 100)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  res.json({
    success: true,
    kpis: {
      totalLeads,
      totalCustomers,
      totalRevenue,
      activeDealsCount: activeDeals.length,
      activePipelineValue,
      weightedPipeline: Math.round(weightedPipeline),
      conversionRate,
      wonDealsCount: wonDeals.length,
    },
    monthlySales,
    leadSources,
    recentActivities: recentActivities.map((act) => {
      const owner = act.ownerId as { _id?: unknown; name?: string; avatar?: string } | null;
      return {
        id: String(act._id),
        type: act.type,
        subject: act.subject,
        relatedType: act.relatedType,
        relatedName: act.relatedName,
        completed: act.completed,
        priority: act.priority,
        followUpDate: act.followUpDate,
        createdAt: act.createdAt,
        ownerName: owner?.name || 'System',
        ownerAvatar: owner?.avatar || '',
      };
    }),
    salesPerformance,
  });
});
