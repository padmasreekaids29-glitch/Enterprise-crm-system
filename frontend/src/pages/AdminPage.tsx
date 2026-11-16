import {
  Activity,
  Database,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { KpiGridSkeleton, TableSkeleton } from '../components/LoadingSkeleton.tsx';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ApiError, apiRequest } from '../services/api.ts';
import type { AdminOverviewData, AdminTeamRow, AdminUserRow, UserRole } from '../types/crm.ts';
import { formatCurrency, formatDateTime } from '../utils/format.ts';

type AdminTab = 'users' | 'teams' | 'audit';

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('users');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Sales Executive' as UserRole,
    title: 'Account Executive',
    department: 'Enterprise Sales',
    teamId: '',
  });
  const [savingUser, setSavingUser] = useState(false);

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeamRow | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: '',
    region: 'North America',
    description: '',
    monthlyQuota: '250000',
    managerId: '',
  });
  const [savingTeam, setSavingTeam] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean } & AdminOverviewData>('/api/admin/overview');
      setData(res);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to load admin console', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await apiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          ...userForm,
          teamId: userForm.teamId || null,
        }),
      });
      showToast(`Provisioned ${userForm.role} account for ${userForm.name}`, 'success');
      setUserModalOpen(false);
      setUserForm({
        name: '',
        email: '',
        password: '',
        role: 'Sales Executive',
        title: 'Account Executive',
        department: 'Enterprise Sales',
        teamId: '',
      });
      await loadAdmin();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateUser = async (
    targetId: string,
    updates: { role?: UserRole; teamId?: string | null; isActive?: boolean }
  ) => {
    try {
      await apiRequest(`/api/admin/users/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      showToast('User permissions updated', 'success');
      await loadAdmin();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update user', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/users/${deleteUserTarget.id}`, { method: 'DELETE' });
      showToast('User account removed', 'info');
      setDeleteUserTarget(null);
      await loadAdmin();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to remove user', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openCreateTeam = () => {
    setEditingTeam(null);
    setTeamForm({
      name: '',
      region: 'North America',
      description: '',
      monthlyQuota: '250000',
      managerId: '',
    });
    setTeamModalOpen(true);
  };

  const openEditTeam = (team: AdminTeamRow) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      region: team.region,
      description: team.description,
      monthlyQuota: String(team.monthlyQuota),
      managerId: team.manager?.id || '',
    });
    setTeamModalOpen(true);
  };

  const handleSaveTeam = async (e: FormEvent) => {
    e.preventDefault();
    setSavingTeam(true);
    try {
      const payload = {
        ...teamForm,
        monthlyQuota: Number(teamForm.monthlyQuota) || 0,
        managerId: teamForm.managerId || null,
      };
      if (editingTeam) {
        await apiRequest(`/api/admin/teams/${editingTeam.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Sales team updated', 'success');
      } else {
        await apiRequest('/api/admin/teams', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Sales team created', 'success');
      }
      setTeamModalOpen(false);
      await loadAdmin();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to save team', 'error');
    } finally {
      setSavingTeam(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <KpiGridSkeleton count={4} />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  const { systemOverview, users, teams, auditLogs } = data;
  const totalRecords =
    systemOverview.collections.leads +
    systemOverview.collections.customers +
    systemOverview.collections.deals +
    systemOverview.collections.activities;

  return (
    <div className="space-y-6">
      {/* System Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Workspace Users</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {systemOverview.activeUsers} / {systemOverview.totalUsers}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active provisioned accounts</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sales Teams</span>
            <ShieldCheck className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {systemOverview.totalTeams}
          </p>
          <p className="mt-1 text-xs text-slate-500">Regional quota units</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>MongoDB Records</span>
            <Database className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">{totalRecords}</p>
          <p className="mt-1 text-xs text-slate-500">
            {systemOverview.collections.leads}L · {systemOverview.collections.customers}C ·{' '}
            {systemOverview.collections.deals}D · {systemOverview.collections.activities}A
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Audit Events</span>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {auditLogs.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Recent tracked workspace actions</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'users', label: 'Users & Roles' },
              { id: 'teams', label: 'Sales Teams' },
              { id: 'audit', label: 'User Activity Monitoring' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'users' && isAdmin && (
          <button
            type="button"
            onClick={() => setUserModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            <span>Provision User</span>
          </button>
        )}
        {tab === 'teams' && (
          <button
            type="button"
            onClick={openCreateTeam}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New Sales Team</span>
          </button>
        )}
      </div>

      {/* Tab 1: Users & Roles */}
      {tab === 'users' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Assigned Team</th>
                  <th className="px-4 py-3.5 text-right">Closed Revenue</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Last Login</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar} name={u.name} size="sm" />
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-500">
                            {u.email} · {u.title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        aria-label={`Role for ${u.name}`}
                        disabled={!isAdmin || u.id === currentUser?.id}
                        value={u.role}
                        onChange={(e) => handleUpdateUser(u.id, { role: e.target.value as UserRole })}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Sales Executive">Sales Executive</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        aria-label={`Team for ${u.name}`}
                        value={u.team?.id || ''}
                        onChange={(e) =>
                          handleUpdateUser(u.id, { teamId: e.target.value || null })
                        }
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                      >
                        <option value="">Unassigned</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-right font-semibold text-slate-900">
                      {formatCurrency(u.closedRevenue)}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        disabled={!isAdmin || u.id === currentUser?.id}
                        onClick={() => handleUpdateUser(u.id, { isActive: !u.isActive })}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                    <td className="font-mono-num px-4 py-3.5 text-xs text-slate-500">
                      {formatDateTime(u.lastLoginAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3.5 text-right">
                        {u.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            aria-label={`Delete ${u.name}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Sales Teams */}
      {tab === 'teams' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const attainment =
              team.monthlyQuota > 0
                ? Math.min(100, Math.round((team.teamRevenue / team.monthlyQuota) * 100))
                : 0;
            return (
              <div
                key={team.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {team.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {team.region} · Manager: {team.manager?.name || 'Unassigned'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditTeam(team)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Configure
                    </button>
                  </div>
                  {team.description && (
                    <p className="mt-3 text-sm text-slate-600">{team.description}</p>
                  )}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500">Members</p>
                      <p className="font-mono-num mt-0.5 text-base font-bold text-slate-900">
                        {team.memberCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Closed Revenue</p>
                      <p className="font-mono-num mt-0.5 text-base font-bold text-slate-900">
                        {formatCurrency(team.teamRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Monthly Quota</p>
                      <p className="font-mono-num mt-0.5 text-base font-bold text-violet-700">
                        {formatCurrency(team.monthlyQuota)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-600"
                      style={{ width: `${attainment}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: User Activity Monitoring */}
      {tab === 'audit' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Event</th>
                  <th className="px-6 py-3.5">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="font-mono-num px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{log.actorName}</p>
                      <p className="text-xs text-slate-500">{log.actorRole}</p>
                    </td>
                    <td className="font-mono-num px-4 py-3 text-xs font-medium text-violet-700">
                      {log.action}
                    </td>
                    <td className="px-6 py-3 text-slate-700">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision User Modal */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="Provision Enterprise User"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Email *</label>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Initial Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Role</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="Sales Executive">Sales Executive</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Sales Team</label>
              <select
                value={userForm.teamId}
                onChange={(e) => setUserForm({ ...userForm, teamId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {savingUser ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Team Modal */}
      <Modal
        open={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        title={editingTeam ? 'Configure Sales Team' : 'Create Sales Team'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveTeam} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Team Name *</label>
            <input
              type="text"
              required
              value={teamForm.name}
              onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Region</label>
              <input
                type="text"
                value={teamForm.region}
                onChange={(e) => setTeamForm({ ...teamForm, region: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Monthly Quota ($)</label>
              <input
                type="number"
                min={0}
                value={teamForm.monthlyQuota}
                onChange={(e) => setTeamForm({ ...teamForm, monthlyQuota: e.target.value })}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Team Manager</label>
            <select
              value={teamForm.managerId}
              onChange={(e) => setTeamForm({ ...teamForm, managerId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select Manager</option>
              {users
                .filter((u) => u.role === 'Admin' || u.role === 'Manager')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Description</label>
            <textarea
              rows={2}
              value={teamForm.description}
              onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setTeamModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTeam}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {savingTeam ? 'Saving...' : 'Save Team'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={handleDeleteUser}
        loading={deleting}
        title="Remove User Account"
        message={`Permanently delete "${deleteUserTarget?.name}" (${deleteUserTarget?.email})?`}
      />
    </div>
  );
}
