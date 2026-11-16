import {
  Building2,
  Edit3,
  Eye,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
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
import type { CustomerItem, CustomerSegment, CustomerStatus } from '../types/crm.ts';
import { formatCurrency, formatDate } from '../utils/format.ts';

const SEGMENTS: CustomerSegment[] = ['Enterprise', 'Mid-Market', 'SMB'];
const CUSTOMER_STATUSES: CustomerStatus[] = ['Active', 'Onboarding', 'At Risk', 'Churned'];

const STATUS_STYLE: Record<CustomerStatus, string> = {
  Active: 'text-emerald-800 bg-emerald-50',
  Onboarding: 'text-violet-800 bg-violet-50',
  'At Risk': 'text-amber-800 bg-amber-50',
  Churned: 'text-rose-800 bg-rose-50',
};

interface CustomerDetailPayload {
  customer: CustomerItem;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    stage: string;
    probability: number;
    expectedCloseDate: string;
  }>;
  history: Array<{
    id: string;
    type: string;
    subject: string;
    description: string;
    completed: boolean;
    followUpDate: string | null;
    createdAt: string;
    ownerName: string;
  }>;
}

interface CustomerFormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  segment: CustomerSegment;
  status: CustomerStatus;
  lifetimeValue: string;
  address: string;
  website: string;
  assignedTo: string;
  notes: string;
}

const INITIAL_FORM: CustomerFormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  industry: 'Technology',
  segment: 'Mid-Market',
  status: 'Active',
  lifetimeValue: '50000',
  address: '',
  website: '',
  assignedTo: '',
  notes: '',
};

export function CustomersPage() {
  const { user, directory } = useAuth();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [segmentFilter, setSegmentFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [form, setForm] = useState<CustomerFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CustomerDetailPayload | null>(null);
  const [quickNote, setQuickNote] = useState('');
  const [loggingNote, setLoggingNote] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = user?.role === 'Admin' || user?.role === 'Manager';

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (segmentFilter !== 'All') params.set('segment', segmentFilter);

      const res = await apiRequest<{ success: boolean; customers: CustomerItem[] }>(
        `/api/customers?${params.toString()}`
      );
      setCustomers(res.customers);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, segmentFilter, showToast]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const openProfile = async (customerId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiRequest<{ success: boolean } & CustomerDetailPayload>(
        `/api/customers/${customerId}`
      );
      setDetail({ customer: res.customer, deals: res.deals, history: res.history });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load profile', 'error');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleLogQuickNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail || !quickNote.trim()) return;
    setLoggingNote(true);
    try {
      await apiRequest('/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          type: 'Note',
          subject: quickNote.trim(),
          relatedType: 'Customer',
          relatedId: detail.customer.id,
          relatedName: detail.customer.company,
          completed: true,
        }),
      });
      setQuickNote('');
      showToast('Added note to customer history', 'success');
      await openProfile(detail.customer.id);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not log note', 'error');
    } finally {
      setLoggingNote(false);
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm({ ...INITIAL_FORM, assignedTo: user?.id || '' });
    setModalOpen(true);
  };

  const openEditModal = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      company: customer.company,
      email: customer.email,
      phone: customer.phone,
      industry: customer.industry,
      segment: customer.segment,
      status: customer.status,
      lifetimeValue: String(customer.lifetimeValue || 0),
      address: customer.address,
      website: customer.website,
      assignedTo: customer.assignedTo?.id || '',
      notes: customer.notes,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        lifetimeValue: Number(form.lifetimeValue) || 0,
        assignedTo: form.assignedTo || null,
      };
      if (editingCustomer) {
        await apiRequest(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Customer profile updated', 'success');
      } else {
        await apiRequest('/api/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Customer account created', 'success');
      }
      setModalOpen(false);
      await fetchCustomers();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Customer removed', 'info');
      setDeleteTarget(null);
      await fetchCustomers();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete customer', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            {(['All', ...CUSTOMER_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Customer</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-8">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by company, primary contact, email, or industry..."
              className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-10 text-sm focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 focus:outline-none"
            />
          </div>
          <div className="md:col-span-4">
            <select
              aria-label="Filter by segment"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-600 focus:outline-none"
            >
              <option value="All">All Segments</option>
              {SEGMENTS.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customer accounts match your filters"
          description="Adjust your search criteria or add an enterprise customer record."
          actionLabel="Add Customer"
          onAction={openCreateModal}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-6 py-3.5">Account &amp; Primary Contact</th>
                  <th className="px-4 py-3.5">Segment &amp; Industry</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Lifetime Value</th>
                  <th className="px-4 py-3.5 text-right">Open Pipeline</th>
                  <th className="px-4 py-3.5">Account Owner</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => openProfile(customer.id)}
                        className="text-left group"
                      >
                        <p className="font-semibold text-slate-900 group-hover:text-violet-700">
                          {customer.company}
                        </p>
                        <p className="text-xs text-slate-500">
                          {customer.name} · {customer.email}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800">{customer.segment}</p>
                      <p className="text-xs text-slate-500">{customer.industry}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLE[customer.status]
                        }`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right font-semibold text-slate-900">
                      {formatCurrency(customer.lifetimeValue)}
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right text-slate-600">
                      {formatCurrency(customer.openPipelineValue)}
                    </td>
                    <td className="px-4 py-3.5">
                      {customer.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={customer.assignedTo.avatar}
                            name={customer.assignedTo.name}
                            size="sm"
                          />
                          <span className="text-xs font-medium text-slate-700">
                            {customer.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openProfile(customer.id)}
                          aria-label={`View profile for ${customer.company}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(customer)}
                          aria-label={`Edit ${customer.company}`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(customer)}
                            aria-label={`Delete ${customer.company}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
        </div>
      )}

      {/* Customer Profile & History Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.customer.company || 'Customer Profile'}
        subtitle={
          detail
            ? `${detail.customer.segment} · ${detail.customer.industry} · ${detail.customer.status}`
            : ''
        }
        maxWidth="xl"
      >
        {detailLoading || !detail ? (
          <div className="space-y-4 py-4">
            <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Primary Contact</p>
                <p className="mt-1 font-semibold text-slate-900">{detail.customer.name}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {detail.customer.email}
                  </p>
                  {detail.customer.phone && (
                    <p className="font-mono-num flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {detail.customer.phone}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Account Location &amp; Web</p>
                <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{detail.customer.address || 'No address on file'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{detail.customer.website || '—'}</span>
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Lifetime Value</p>
                <p className="font-mono-num mt-1 text-2xl font-bold text-slate-900">
                  {formatCurrency(detail.customer.lifetimeValue)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Account Owner: {detail.customer.assignedTo?.name || 'Unassigned'}
                </p>
              </div>
            </div>

            {detail.customer.notes && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500">Account Notes</h3>
                <p className="mt-1 text-sm text-slate-700">{detail.customer.notes}</p>
              </div>
            )}

            {/* Associated Deals */}
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Associated Deals ({detail.deals.length})
              </h3>
              {detail.deals.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No deals linked to this account yet.</p>
              ) : (
                <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {detail.deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{d.title}</p>
                        <p className="text-xs text-slate-500">
                          Stage: {d.stage} · Close target {formatDate(d.expectedCloseDate)}
                        </p>
                      </div>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer History & Quick Log */}
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Customer Activity History
              </h3>
              <form onSubmit={handleLogQuickNote} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Log an executive note or touchpoint to customer timeline..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loggingNote || !quickNote.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {loggingNote ? 'Saving...' : 'Add Note'}
                </button>
              </form>

              <div className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {detail.history.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500">
                    No activity history logged yet.
                  </p>
                ) : (
                  detail.history.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{item.subject}</p>
                        <span className="font-mono-num text-xs text-slate-400">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.type} · {item.ownerName}
                        {item.description ? ` — ${item.description}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Customer Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Update Customer Account' : 'Add Enterprise Customer'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Company Name *</label>
              <input
                type="text"
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Primary Contact Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Segment</label>
              <select
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value as CustomerSegment })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {SEGMENTS.map((s) => (
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
                onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {CUSTOMER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Lifetime Value ($)</label>
              <input
                type="number"
                min={0}
                value={form.lifetimeValue}
                onChange={(e) => setForm({ ...form, lifetimeValue: e.target.value })}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://company.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Account Owner</label>
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
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Headquarters Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Account Notes</label>
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
              {saving ? 'Saving...' : editingCustomer ? 'Save Account' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Customer Account"
        message={`Permanently delete "${deleteTarget?.company}"? Historical deals will remain in the pipeline archive.`}
      />
    </div>
  );
}
