import {
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  KanbanSquare,
  Phone,
  RefreshCw,
  StickyNote,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar } from '../components/Avatar.tsx';
import { KpiGridSkeleton, TableSkeleton } from '../components/LoadingSkeleton.tsx';
import type { NavSection } from '../components/Layout.tsx';
import { apiRequest } from '../services/api.ts';
import type { DashboardData } from '../types/crm.ts';
import { formatCompactCurrency, formatCurrency, formatDate } from '../utils/format.ts';

interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ success: boolean } & DashboardData>('/api/dashboard/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <KpiGridSkeleton count={5} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-8" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-4" />
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-rose-700">{error || 'Unable to load dashboard'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { kpis, monthlySales, leadSources, recentActivities, salesPerformance } = data;

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(kpis.totalRevenue),
      meta: `${kpis.wonDealsCount} closed won deals`,
      icon: DollarSign,
      action: () => onNavigate('reports'),
    },
    {
      label: 'Active Deals',
      value: String(kpis.activeDealsCount),
      meta: `${formatCompactCurrency(kpis.activePipelineValue)} open pipeline`,
      icon: KanbanSquare,
      action: () => onNavigate('pipeline'),
    },
    {
      label: 'Total Leads',
      value: String(kpis.totalLeads),
      meta: `${kpis.conversionRate}% lead conversion`,
      icon: Users,
      action: () => onNavigate('leads'),
    },
    {
      label: 'Total Customers',
      value: String(kpis.totalCustomers),
      meta: 'Active & onboarding accounts',
      icon: Building2,
      action: () => onNavigate('customers'),
    },
    {
      label: 'Conversion Rate',
      value: `${kpis.conversionRate}%`,
      meta: `${formatCompactCurrency(kpis.weightedPipeline)} weighted forecast`,
      icon: TrendingUp,
      action: () => onNavigate('reports'),
    },
  ];

  const getActivityIcon = (type: string) => {
    if (type === 'Call') return Phone;
    if (type === 'Meeting') return Calendar;
    if (type === 'Note') return StickyNote;
    return CheckCircle2;
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section aria-label="Key Revenue Metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={card.action}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-violet-300"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-violet-600" />
              </div>
              <p className="font-mono-num mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                {card.value}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="truncate">{card.meta}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-violet-600" />
              </div>
            </button>
          );
        })}
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Monthly Sales Revenue
              </h2>
              <p className="text-xs text-slate-500">
                Closed-won revenue compared against monthly quota targets
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" />
                Closed Revenue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                Target
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nexoraRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value ?? 0)),
                    name === 'revenue' ? 'Closed Revenue' : 'Monthly Target',
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth={1.75}
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7C3AED"
                  strokeWidth={2.5}
                  fill="url(#nexoraRevenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
          <div className="mb-5">
            <h2 className="font-display text-base font-semibold text-slate-900">Lead Sources</h2>
            <p className="text-xs text-slate-500">Acquisition channel volume across active funnel</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={leadSources}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  width={95}
                  tick={{ fontSize: 12, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0)} leads`, 'Volume']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#0F172A" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Bottom Row: Sales Performance + Recent Activities */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Sales Performance Overview
              </h2>
              <p className="text-xs text-slate-500">Quota attainment and active pipeline by representative</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              Full Reports
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-6 py-3">Representative</th>
                  <th className="px-4 py-3 text-right">Won</th>
                  <th className="px-4 py-3 text-right">Closed Revenue</th>
                  <th className="px-4 py-3 text-right">Open Pipeline</th>
                  <th className="px-6 py-3">Attainment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesPerformance.map((rep) => (
                  <tr key={rep.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={rep.avatar} name={rep.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{rep.name}</p>
                          <p className="truncate text-xs text-slate-500">{rep.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right text-slate-700">
                      {rep.dealsWon}
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right font-semibold text-slate-900">
                      {formatCurrency(rep.revenue)}
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right text-slate-600">
                      {formatCurrency(rep.pipeline)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-600"
                            style={{ width: `${rep.quotaAttainment}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-xs font-medium text-slate-700">
                          {rep.quotaAttainment}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Activities
              </h2>
              <p className="text-xs text-slate-500">Latest calls, meetings, tasks, and notes</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('activities')}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              Manage All
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivities.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-500">No recent activities recorded.</p>
            ) : (
              recentActivities.map((act) => {
                const Icon = getActivityIcon(act.type);
                return (
                  <div key={act.id} className="flex items-start gap-3 px-6 py-3.5">
                    <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{act.subject}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>{act.type}</span>
                        {act.relatedName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{act.relatedName}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{act.ownerName}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          act.completed ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {act.completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {act.completed ? 'Done' : 'Pending'}
                      </span>
                      {act.followUpDate && (
                        <p className="font-mono-num mt-0.5 text-[11px] text-slate-400">
                          {formatDate(act.followUpDate)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
