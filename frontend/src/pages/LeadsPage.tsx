import {
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { TableSkeleton } from '../components/LoadingSkeleton.tsx';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ApiError, apiRequest } from '../services/api.ts';
import type { LeadItem, LeadSource, LeadStatus } from '../types/crm.ts';
import { formatCurrency, formatDate } from '../utils/format.ts';

const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
const LEAD_SOURCES: LeadSource[] = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold Outreach',
  'Partner',
  'Conference',
];

const STATUS_STYLE: Record<LeadStatus, string> = {
  New: 'text-slate-700 bg-slate-100',
  Contacted: 'text-sky-800 bg-sky-50',
  Qualified: 'text-violet-800 bg-violet-50',
  Converted: 'text-emerald-800 bg-emerald-50',
  Lost: 'text-rose-800 bg-rose-50',
};

interface LeadFormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  estimatedValue: string;
  assignedTo: string;
  notes: string;
}

const INITIAL_FORM: LeadFormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  source: 'Website',
  status: 'New',
  estimatedValue: '25000',
  assignedTo: '',
  notes: '',
};

export function LeadsPage() {
  const { user, directory } = useAuth();
  const { showToast } = useToast();

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [assignedFilter, setAssignedFilter] = useState('All');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);
  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LeadItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const canDelete = user?.role === 'Admin' || user?.role === 'Manager';

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '8',
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (sourceFilter !== 'All') params.set('source', sourceFilter);
      if (assignedFilter !== 'All') params.set('assignedTo', assignedFilter);

      const res = await apiRequest<{
        success: boolean;
        leads: LeadItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
        summary: Record<string, number>;
      }>(`/api/leads?${params.toString()}`);

      setLeads(res.leads);
      setPagination(res.pagination);
      setSummary(res.summary || {});
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter, assignedFilter, showToast]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const openCreateModal = () => {
    setEditingLead(null);
    setForm({
      ...INITIAL_FORM,
      assignedTo: user?.id || '',
    });
    setModalOpen(true);
  };

  const openEditModal = (lead: LeadItem) => {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      status: lead.status,
      estimatedValue: String(lead.estimatedValue || 0),
      assignedTo: lead.assignedTo?.id || '',
      notes: lead.notes,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        estimatedValue: Number(form.estimatedValue) || 0,
        assignedTo: form.assignedTo || null,
      };
      if (editingLead) {
        await apiRequest(`/api/leads/${editingLead.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Lead updated successfully', 'success');
      } else {
        await apiRequest('/api/leads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('New lead created', 'success');
      }
      setModalOpen(false);
      await fetchLeads();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to save lead', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAssign = async (leadId: string, assignedTo: string) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ assignedTo: assignedTo || null }),
      });
      showToast('Lead assignment updated', 'success');
      await fetchLeads();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to assign lead', 'error');
    }
  };

  const handleConvert = async (lead: LeadItem) => {
    setConvertingId(lead.id);
    try {
      await apiRequest(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ createDeal: true }),
      });
      showToast(`Converted ${lead.company} into Customer & Pipeline Deal`, 'success');
      await fetchLeads();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Conversion failed', 'error');
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/leads/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Lead deleted', 'info');
      setDeleteTarget(null);
      await fetchLeads();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete lead', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const totalAcrossAll = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            {(['All', ...LEAD_STATUSES] as const).map((status) => {
              const count = status === 'All' ? totalAcrossAll : summary[status] || 0;
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status} <span className="font-mono-num ml-1 text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lead</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search leads by name, email, or company..."
              className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-10 text-sm focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by source"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-600 focus:outline-none"
            >
              <option value="All">All Sources</option>
              {LEAD_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by assigned executive"
              value={assignedFilter}
              onChange={(e) => {
                setAssignedFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-600 focus:outline-none"
            >
              <option value="All">All Sales Executives</option>
              <option value="Unassigned">Unassigned</option>
              {directory.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matching leads found"
          description="Try clearing active search or status filters, or add a new inbound lead to begin qualification."
          actionLabel="Add New Lead"
          onAction={openCreateModal}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-6 py-3.5">Lead &amp; Company</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5">Source</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Est. Value</th>
                  <th className="px-4 py-3.5">Assigned Executive</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-slate-900">{lead.name}</p>
                      <p className="text-xs text-slate-500">
                        {lead.company} · Added {formatDate(lead.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-700">{lead.email}</p>
                      <p className="font-mono-num text-xs text-slate-500">{lead.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{lead.source}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLE[lead.status]
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right font-semibold text-slate-900">
                      {formatCurrency(lead.estimatedValue)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {lead.assignedTo && (
                          <Avatar
                            src={lead.assignedTo.avatar}
                            name={lead.assignedTo.name}
                            size="sm"
                          />
                        )}
                        <select
                          aria-label={`Assign ${lead.name}`}
                          value={lead.assignedTo?.id || ''}
                          onChange={(e) => handleQuickAssign(lead.id, e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-violet-600 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {directory.map((rep) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {lead.status !== 'Converted' && (
                          <button
                            type="button"
                            disabled={convertingId === lead.id}
                            onClick={() => handleConvert(lead)}
                            title="Convert to Customer & Deal"
                            className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
                          >
                            <ArrowRightCircle className="h-3.5 w-3.5" />
                            <span>{convertingId === lead.id ? 'Converting...' : 'Convert'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(lead)}
                          aria-label={`Edit ${lead.name}`}
                          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(lead)}
                            aria-label={`Delete ${lead.name}`}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-3.5">
            <p className="text-xs text-slate-500">
              Showing <span className="font-mono-num font-semibold text-slate-800">{leads.length}</span>{' '}
              of <span className="font-mono-num font-semibold text-slate-800">{pagination.total}</span>{' '}
              leads
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>
              <span className="font-mono-num px-2 text-xs text-slate-600">
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Lead Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLead ? 'Edit Lead Record' : 'Create New Lead'}
        subtitle="Capture inbound or outbound prospect metadata and assign an owner."
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Lead Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Company *</label>
              <input
                type="text"
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (415) 555-0100"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Est. Value ($)</label>
              <input
                type="number"
                min={0}
                value={form.estimatedValue}
                onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Assigned Sales Executive</label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {directory.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name} ({rep.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Qualification Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Key discovery findings, budget timeline, stakeholder contacts..."
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
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              <span>{saving ? 'Saving...' : editingLead ? 'Save Changes' : 'Create Lead'}</span>
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Lead Record"
        message={`Are you sure you want to permanently remove "${deleteTarget?.name}" (${deleteTarget?.company}) from the lead database?`}
      />
    </div>
  );
}
