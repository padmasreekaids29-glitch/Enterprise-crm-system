import {
  Activity,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Phone,
  Plus,
  Search,
  StickyNote,
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
import type { ActivityItem, ActivityRelatedType, ActivityType } from '../types/crm.ts';
import { formatDate, toDateInputValue } from '../utils/format.ts';

const ACTIVITY_TYPES: ActivityType[] = ['Call', 'Meeting', 'Task', 'Note'];
const RELATED_TYPES: ActivityRelatedType[] = ['General', 'Customer', 'Deal', 'Lead'];

interface ActivityFormState {
  type: ActivityType;
  subject: string;
  description: string;
  relatedType: ActivityRelatedType;
  relatedName: string;
  followUpDate: string;
  priority: 'Low' | 'Medium' | 'High';
  ownerId: string;
  completed: boolean;
}

export function ActivitiesPage() {
  const { user, directory } = useAuth();
  const { showToast } = useToast();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityItem | null>(null);
  const [form, setForm] = useState<ActivityFormState>({
    type: 'Call',
    subject: '',
    description: '',
    relatedType: 'Customer',
    relatedName: '',
    followUpDate: '',
    priority: 'Medium',
    ownerId: '',
    completed: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'All') params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiRequest<{ success: boolean; activities: ActivityItem[] }>(
        `/api/activities?${params.toString()}`
      );
      setActivities(res.activities);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load activities', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search, showToast]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  const openCreateModal = (defaultType: ActivityType = 'Call') => {
    setEditing(null);
    setForm({
      type: defaultType,
      subject: '',
      description: '',
      relatedType: 'Customer',
      relatedName: '',
      followUpDate: new Date().toISOString().slice(0, 10),
      priority: 'Medium',
      ownerId: user?.id || '',
      completed: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (act: ActivityItem) => {
    setEditing(act);
    setForm({
      type: act.type,
      subject: act.subject,
      description: act.description,
      relatedType: act.relatedType,
      relatedName: act.relatedName,
      followUpDate: toDateInputValue(act.followUpDate),
      priority: act.priority,
      ownerId: act.owner?.id || '',
      completed: act.completed,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        followUpDate: form.followUpDate || null,
        ownerId: form.ownerId || null,
      };
      if (editing) {
        await apiRequest(`/api/activities/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Activity updated', 'success');
      } else {
        await apiRequest('/api/activities', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`${form.type} logged to timeline`, 'success');
      }
      setModalOpen(false);
      await fetchActivities();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to save activity', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (act: ActivityItem) => {
    try {
      const res = await apiRequest<{ success: boolean; completed: boolean }>(
        `/api/activities/${act.id}/toggle`,
        { method: 'PATCH' }
      );
      setActivities((prev) =>
        prev.map((item) => (item.id === act.id ? { ...item, completed: res.completed } : item))
      );
      showToast(res.completed ? 'Marked as completed' : 'Reopened task', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to update task status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/activities/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Activity deleted', 'info');
      setDeleteTarget(null);
      await fetchActivities();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete activity', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type: ActivityType) => {
    if (type === 'Call') return Phone;
    if (type === 'Meeting') return Calendar;
    if (type === 'Note') return StickyNote;
    return CheckCircle2;
  };

  const pendingCount = activities.filter((a) => !a.completed).length;
  const completedCount = activities.filter((a) => a.completed).length;
  const overdueCount = activities.filter(
    (a) => !a.completed && a.followUpDate && new Date(a.followUpDate) < new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Logged</p>
          <p className="font-mono-num mt-1 text-2xl font-bold text-slate-900">
            {activities.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pending Follow-Ups</p>
          <p className="font-mono-num mt-1 text-2xl font-bold text-amber-700">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="font-mono-num mt-1 text-2xl font-bold text-emerald-700">
            {completedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Overdue</p>
          <p className="font-mono-num mt-1 text-2xl font-bold text-rose-700">{overdueCount}</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'all', label: 'All Activities' },
                { id: 'pending', label: 'Pending' },
                { id: 'completed', label: 'Completed' },
                { id: 'overdue', label: 'Overdue' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openCreateModal('Call')}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Log Activity</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-8">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search calls, meetings, tasks, notes, or accounts..."
              className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-10 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>
          <div className="md:col-span-4">
            <select
              aria-label="Filter by activity type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-600 focus:outline-none"
            >
              <option value="All">All Types</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activities in this view"
          description="Schedule a call, meeting, follow-up task, or executive note to keep deal momentum clear."
          actionLabel="Log First Activity"
          onAction={() => openCreateModal('Task')}
        />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {activities.map((act) => {
            const TypeIcon = getTypeIcon(act.type);
            const isOverdue =
              !act.completed && act.followUpDate && new Date(act.followUpDate) < new Date();
            return (
              <div
                key={act.id}
                className="flex flex-col justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(act)}
                    aria-label={act.completed ? 'Mark as pending' : 'Mark as completed'}
                    className={`mt-0.5 shrink-0 transition-colors ${
                      act.completed
                        ? 'text-emerald-600 hover:text-emerald-700'
                        : 'text-slate-300 hover:text-violet-600'
                    }`}
                  >
                    {act.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                        <TypeIcon className="h-3.5 w-3.5" />
                        {act.type}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <p
                        className={`text-sm font-semibold ${
                          act.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {act.subject}
                      </p>
                    </div>
                    {act.description && (
                      <p className="mt-1 text-sm text-slate-600">{act.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {act.relatedName && (
                        <span>
                          {act.relatedType}: <strong className="font-medium text-slate-700">{act.relatedName}</strong>
                        </span>
                      )}
                      <span>Priority: {act.priority}</span>
                      {act.followUpDate && (
                        <span
                          className={`inline-flex items-center gap-1 font-mono-num ${
                            isOverdue ? 'font-semibold text-rose-600' : 'text-slate-500'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          Follow-up: {formatDate(act.followUpDate)}
                          {isOverdue ? ' (Overdue)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  {act.owner && (
                    <div className="flex items-center gap-2">
                      <Avatar src={act.owner.avatar} name={act.owner.name} size="sm" />
                      <span className="text-xs font-medium text-slate-700">{act.owner.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(act)}
                      aria-label={`Edit ${act.subject}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(act)}
                      aria-label={`Delete ${act.subject}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Activity Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Activity' : 'Log CRM Activity'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ActivityType })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as 'Low' | 'Medium' | 'High' })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Follow-Up Date</label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Subject *</label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Security architecture follow-up with CTO"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Related To</label>
              <select
                value={form.relatedType}
                onChange={(e) =>
                  setForm({ ...form, relatedType: e.target.value as ActivityRelatedType })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {RELATED_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Account / Record Name</label>
              <input
                type="text"
                value={form.relatedName}
                onChange={(e) => setForm({ ...form, relatedName: e.target.value })}
                placeholder="e.g. NordicGrid Energy"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Assigned Owner</label>
              <select
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              >
                {directory.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Notes &amp; Details</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.completed}
              onChange={(e) => setForm({ ...form, completed: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600"
            />
            <span>Mark activity as completed</span>
          </label>

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
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Log Activity'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Activity"
        message={`Delete activity "${deleteTarget?.subject}" from the timeline?`}
      />
    </div>
  );
}
