import {
  Calendar,
  Edit3,
  GripVertical,
  KanbanSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ApiError, apiRequest } from '../services/api.ts';
import type { CustomerItem, DealItem, DealPriority, DealStage } from '../types/crm.ts';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  toDateInputValue,
} from '../utils/format.ts';

const PIPELINE_STAGES: Array<{ stage: DealStage; probability: number; accent: string }> = [
  { stage: 'Prospecting', probability: 15, accent: 'bg-slate-600' },
  { stage: 'Qualification', probability: 35, accent: 'bg-sky-600' },
  { stage: 'Proposal', probability: 60, accent: 'bg-indigo-600' },
  { stage: 'Negotiation', probability: 80, accent: 'bg-violet-600' },
  { stage: 'Won', probability: 100, accent: 'bg-emerald-600' },
  { stage: 'Lost', probability: 0, accent: 'bg-rose-600' },
];

const PRIORITY_STYLE: Record<DealPriority, string> = {
  High: 'text-rose-700',
  Medium: 'text-amber-700',
  Low: 'text-slate-500',
};

interface DealFormState {
  title: string;
  customerId: string;
  companyName: string;
  value: string;
  stage: DealStage;
  expectedCloseDate: string;
  priority: DealPriority;
  assignedTo: string;
  notes: string;
}

const DEFAULT_CLOSE_DATE = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

export function PipelinePage() {
  const { user, directory } = useAuth();
  const { showToast } = useToast();

  const [deals, setDeals] = useState<DealItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('All');

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<DealStage | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealItem | null>(null);
  const [form, setForm] = useState<DealFormState>({
    title: '',
    customerId: '',
    companyName: '',
    value: '45000',
    stage: 'Prospecting',
    expectedCloseDate: DEFAULT_CLOSE_DATE(),
    priority: 'Medium',
    assignedTo: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DealItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = user?.role === 'Admin' || user?.role === 'Manager';

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (ownerFilter !== 'All') params.set('assignedTo', ownerFilter);

      const [dealsRes, custRes] = await Promise.all([
        apiRequest<{ success: boolean; deals: DealItem[] }>(`/api/deals?${params.toString()}`),
        apiRequest<{ success: boolean; customers: CustomerItem[] }>('/api/customers'),
      ]);
      setDeals(dealsRes.deals);
      setCustomers(custRes.customers);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load sales pipeline', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, ownerFilter, showToast]);

  useEffect(() => {
    void fetchPipeline();
  }, [fetchPipeline]);

  const moveDealStage = async (dealId: string, nextStage: DealStage) => {
    const target = deals.find((d) => d.id === dealId);
    if (!target || target.stage === nextStage) return;

    const previousDeals = deals;
    const stageProb = PIPELINE_STAGES.find((s) => s.stage === nextStage)?.probability ?? 0;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stage: nextStage, probability: stageProb } : d
      )
    );

    try {
      await apiRequest(`/api/deals/${dealId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: nextStage }),
      });
      showToast(`Moved "${target.title}" to ${nextStage}`, 'success');
    } catch (err) {
      setDeals(previousDeals);
      showToast(err instanceof ApiError ? err.message : 'Failed to update stage', 'error');
    }
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(dealId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, stage: DealStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropStage !== stage) setDropStage(stage);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, stage: DealStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDropStage(null);
    if (dealId) {
      void moveDealStage(dealId, stage);
    }
  };

  const openCreateModal = (initialStage: DealStage = 'Prospecting') => {
    setEditingDeal(null);
    setForm({
      title: '',
      customerId: '',
      companyName: '',
      value: '45000',
      stage: initialStage,
      expectedCloseDate: DEFAULT_CLOSE_DATE(),
      priority: 'Medium',
      assignedTo: user?.id || '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (deal: DealItem) => {
    setEditingDeal(deal);
    setForm({
      title: deal.title,
      customerId: deal.customerId || '',
      companyName: deal.companyName,
      value: String(deal.value),
      stage: deal.stage,
      expectedCloseDate: toDateInputValue(deal.expectedCloseDate) || DEFAULT_CLOSE_DATE(),
      priority: deal.priority,
      assignedTo: deal.assignedTo?.id || '',
      notes: deal.notes,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        value: Number(form.value) || 0,
        customerId: form.customerId || null,
        assignedTo: form.assignedTo || null,
      };
      if (editingDeal) {
        await apiRequest(`/api/deals/${editingDeal.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Deal updated', 'success');
      } else {
        await apiRequest('/api/deals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Deal added to pipeline', 'success');
      }
      setModalOpen(false);
      await fetchPipeline();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to save deal', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/deals/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Deal removed from pipeline', 'info');
      setDeleteTarget(null);
      await fetchPipeline();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete deal', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openDeals = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
  const wonDeals = deals.filter((d) => d.stage === 'Won');
  const totalOpenValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const weightedForecast = openDeals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);
  const totalPipelineVolume = totalOpenValue + totalWonValue || 1;

  return (
    <div className="space-y-6">
      {/* Sales Progress Visualization & Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-6 sm:flex sm:items-center sm:gap-8">
            <div>
              <p className="text-xs text-slate-500">Open Pipeline</p>
              <p className="font-mono-num text-xl font-bold text-slate-900">
                {formatCurrency(totalOpenValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Weighted Forecast</p>
              <p className="font-mono-num text-xl font-bold text-violet-700">
                {formatCurrency(Math.round(weightedForecast))}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Closed Won</p>
              <p className="font-mono-num text-xl font-bold text-emerald-700">
                {formatCurrency(totalWonValue)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter deals..."
                className="w-48 rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm focus:border-violet-600 focus:outline-none sm:w-56"
              />
            </div>

            <select
              aria-label="Filter deals by owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-600 focus:outline-none"
            >
              <option value="All">All Owners</option>
              {directory.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => openCreateModal('Prospecting')}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Deal</span>
            </button>
          </div>
        </div>

        {/* Stage Distribution Progress Bar */}
        <div className="mt-5">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {PIPELINE_STAGES.filter((s) => s.stage !== 'Lost').map((col) => {
              const stageSum = deals
                .filter((d) => d.stage === col.stage)
                .reduce((acc, d) => acc + d.value, 0);
              const pct = (stageSum / totalPipelineVolume) * 100;
              if (pct <= 0) return null;
              return (
                <div
                  key={col.stage}
                  title={`${col.stage}: ${formatCurrency(stageSum)}`}
                  className={`${col.accent} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
            {PIPELINE_STAGES.filter((s) => s.stage !== 'Lost').map((col) => {
              const stageSum = deals
                .filter((d) => d.stage === col.stage)
                .reduce((acc, d) => acc + d.value, 0);
              return (
                <span key={col.stage} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-sm ${col.accent}`} />
                  {col.stage}:{' '}
                  <span className="font-mono-num font-medium text-slate-800">
                    {formatCompactCurrency(stageSum)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {PIPELINE_STAGES.map((col) => (
            <div
              key={col.stage}
              className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No deals in your pipeline"
          description="Create an opportunity to start tracking deal stages and revenue forecasting."
          actionLabel="Create First Deal"
          onAction={() => openCreateModal('Prospecting')}
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[1140px] grid-cols-6 gap-4">
            {PIPELINE_STAGES.map((col) => {
              const stageDeals = deals.filter((d) => d.stage === col.stage);
              const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);
              const isDropTarget = dropStage === col.stage;

              return (
                <div
                  key={col.stage}
                  onDragOver={(e) => handleDragOver(e, col.stage)}
                  onDragLeave={() => setDropStage(null)}
                  onDrop={(e) => handleDrop(e, col.stage)}
                  className={`flex min-h-[540px] flex-col rounded-xl border transition-colors ${
                    isDropTarget
                      ? 'border-violet-500 bg-violet-50/40'
                      : 'border-slate-200 bg-slate-100/70'
                  }`}
                >
                  <div className="border-b border-slate-200 bg-white px-3.5 py-3 rounded-t-xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${col.accent}`} />
                        <h3 className="truncate font-display text-sm font-semibold text-slate-900">
                          {col.stage}
                        </h3>
                      </div>
                      <span className="font-mono-num text-xs font-medium text-slate-500">
                        {stageDeals.length}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono-num font-semibold text-slate-800">
                        {formatCompactCurrency(stageTotal)}
                      </span>
                      <span className="font-mono-num">{col.probability}% prob.</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2.5 p-2.5">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropStage(null);
                        }}
                        className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs transition-transform active:cursor-grabbing ${
                          draggingId === deal.id ? 'opacity-50' : 'hover:border-violet-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-slate-900">
                            {deal.title}
                          </p>
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                        </div>

                        <p className="mt-1 text-xs text-slate-500">{deal.companyName}</p>

                        <div className="mt-3 flex items-baseline justify-between gap-2">
                          <span className="font-mono-num text-sm font-bold text-slate-900">
                            {formatCurrency(deal.value)}
                          </span>
                          <span className={`text-[11px] font-semibold ${PRIORITY_STYLE[deal.priority]}`}>
                            {deal.priority}
                          </span>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 font-mono-num text-[11px]">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDate(deal.expectedCloseDate)}
                          </span>
                          {deal.assignedTo && (
                            <Avatar
                              src={deal.assignedTo.avatar}
                              name={deal.assignedTo.name}
                              size="sm"
                            />
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-1.5">
                          <select
                            aria-label={`Change stage for ${deal.title}`}
                            value={deal.stage}
                            onChange={(e) => moveDealStage(deal.id, e.target.value as DealStage)}
                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 focus:border-violet-600 focus:outline-none"
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s.stage} value={s.stage}>
                                {s.stage}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => openEditModal(deal)}
                            aria-label={`Edit ${deal.title}`}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(deal)}
                              aria-label={`Delete ${deal.title}`}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => openCreateModal(col.stage)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-violet-400 hover:bg-white hover:text-violet-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Deal</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Deal Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDeal ? 'Edit Pipeline Deal' : 'Create Pipeline Deal'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Deal Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Global Enterprise Seat Expansion"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Linked Customer</label>
              <select
                value={form.customerId}
                onChange={(e) => {
                  const selected = customers.find((c) => c.id === e.target.value);
                  setForm({
                    ...form,
                    customerId: e.target.value,
                    companyName: selected ? selected.company : form.companyName,
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                <option value="">Select existing customer (optional)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Company Name *</label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Deal Value ($) *</label>
              <input
                type="number"
                min={0}
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.stage} value={s.stage}>
                    {s.stage}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Expected Close *</label>
              <input
                type="date"
                required
                value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as DealPriority })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Deal Owner</label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {directory.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Deal Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingDeal ? 'Save Deal' : 'Create Deal'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Pipeline Deal"
        message={`Remove "${deleteTarget?.title}" (${formatCurrency(deleteTarget?.value || 0)}) from the sales pipeline?`}
      />
    </div>
  );
}
