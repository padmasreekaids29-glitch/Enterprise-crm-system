import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar } from '../components/Avatar.tsx';
import { KpiGridSkeleton, TableSkeleton } from '../components/LoadingSkeleton.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ApiError, apiRequest } from '../services/api.ts';
import type { ReportsData } from '../types/crm.ts';
import { formatCompactCurrency, formatCurrency } from '../utils/format.ts';

const FUNNEL_COLORS = ['#64748B', '#0284C7', '#7C3AED', '#16A34A', '#E11D48'];

export function ReportsPage() {
  const { showToast } = useToast();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean } & ReportsData>(
        `/api/reports/overview?months=${months}`
      );
      setData(res);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [months, showToast]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Month', 'Actual Revenue (USD)', 'Target Revenue (USD)', 'Deals Closed'],
      ...data.monthlyRevenue.map((r) => [
        r.month,
        String(r.actualRevenue),
        String(r.targetRevenue),
        String(r.dealsClosed),
      ]),
    ];
    const csv = rows.map((line) => line.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nexora-revenue-report-${months}m.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported monthly revenue CSV report', 'success');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <KpiGridSkeleton count={4} />
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">Unable to load report data.</p>
        <button
          type="button"
          onClick={loadReports}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
          {[3, 6, 12].map((win) => (
            <button
              key={win}
              type="button"
              onClick={() => setMonths(win)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                months === win
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last {win} Months
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Executive Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Closed Won Revenue</p>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.summary.totalWonRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Open Pipeline Value</p>
          <p className="font-mono-num mt-2 text-2xl font-bold text-violet-700">
            {formatCurrency(data.summary.openPipelineValue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Deal Win Rate</p>
          <p className="font-mono-num mt-2 text-2xl font-bold text-emerald-700">
            {data.summary.winRate}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Average Won Deal</p>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.summary.avgWonDealSize)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Lead Conversion</p>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {data.summary.leadConversionRate}%
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Revenue vs Target */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Monthly Revenue vs. Quota Target
            </h2>
            <p className="text-xs text-slate-500">Closed deal revenue by month</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyRevenue} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                  formatter={(val, name) => [
                    formatCurrency(Number(val ?? 0)),
                    name === 'actualRevenue' ? 'Actual Revenue' : 'Target Quota',
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="actualRevenue"
                  name="Actual Revenue"
                  fill="#7C3AED"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="targetRevenue"
                  name="Target Quota"
                  fill="#CBD5E1"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Conversion Funnel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Lead Conversion Funnel
            </h2>
            <p className="text-xs text-slate-500">Lead distribution across qualification stages</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leadFunnel} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val) => [`${Number(val ?? 0)} leads`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {data.leadFunnel.map((entry, idx) => (
                    <Cell key={entry.status} fill={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Deal Stage Analytics Chart + Source Conversion Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Deal Status &amp; Weighted Value Analytics
            </h2>
            <p className="text-xs text-slate-500">Gross stage value compared to probability-weighted value</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.dealStageAnalytics}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: '#64748B' }}
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
                  formatter={(val, name) => [
                    formatCurrency(Number(val ?? 0)),
                    name === 'value' ? 'Total Stage Value' : 'Weighted Value',
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="value" name="Total Value" fill="#0F172A" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="weightedValue"
                  name="Weighted Value"
                  fill="#7C3AED"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-6">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Lead Source Conversion Report
            </h2>
            <p className="text-xs text-slate-500">Qualification efficiency and pipeline potential per channel</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-6 py-3">Channel</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Qualified+</th>
                  <th className="px-4 py-3 text-right">Qual. Rate</th>
                  <th className="px-6 py-3 text-right">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leadSourceAnalytics.map((row) => (
                  <tr key={row.source} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 font-medium text-slate-900">{row.source}</td>
                    <td className="font-mono-num px-4 py-3 text-right text-slate-700">{row.total}</td>
                    <td className="font-mono-num px-4 py-3 text-right text-slate-700">
                      {row.qualifiedOrConverted}
                    </td>
                    <td className="font-mono-num px-4 py-3 text-right font-semibold text-violet-700">
                      {row.qualificationRate}%
                    </td>
                    <td className="font-mono-num px-6 py-3 text-right font-medium text-slate-900">
                      {formatCompactCurrency(row.estimatedValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sales Executive Performance Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Sales Representative Performance Report
          </h2>
          <p className="text-xs text-slate-500">Win rate, deal velocity, and revenue contribution</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Sales Representative</th>
                <th className="px-4 py-3 text-right">Won</th>
                <th className="px-4 py-3 text-right">Lost</th>
                <th className="px-4 py-3 text-right">Win Rate</th>
                <th className="px-4 py-3 text-right">Avg Deal Size</th>
                <th className="px-4 py-3 text-right">Open Pipeline</th>
                <th className="px-6 py-3 text-right">Closed Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.salesPerformance.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar src={rep.avatar} name={rep.name} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-900">{rep.name}</p>
                        <p className="text-xs text-slate-500">{rep.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono-num px-4 py-3.5 text-right text-emerald-700 font-semibold">
                    {rep.dealsWon}
                  </td>
                  <td className="font-mono-num px-4 py-3.5 text-right text-slate-500">
                    {rep.dealsLost}
                  </td>
                  <td className="font-mono-num px-4 py-3.5 text-right font-semibold text-slate-900">
                    {rep.winRate}%
                  </td>
                  <td className="font-mono-num px-4 py-3.5 text-right text-slate-700">
                    {formatCurrency(rep.avgDealSize)}
                  </td>
                  <td className="font-mono-num px-4 py-3.5 text-right text-slate-700">
                    {formatCurrency(rep.pipeline)}
                  </td>
                  <td className="font-mono-num px-6 py-3.5 text-right font-bold text-slate-900">
                    {formatCurrency(rep.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
