import { Bell, Lock, Save, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ApiError, apiRequest } from '../services/api.ts';
import type { AuthUser, NotificationPreferences } from '../types/crm.ts';

const AVATAR_CHOICES = [
  '/src/assets/images/avatar_admin_user_1794844537853.jpg',
  '/src/assets/images/avatar_manager_user_1794844537088.jpg',
  '/src/assets/images/avatar_exec_one_1794844537623.jpg',
  '/src/assets/images/avatar_exec_two_1794844537761.jpg',
];

export function SettingsPage() {
  const { user, updateLocalUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [title, setTitle] = useState(user?.title || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatar, setAvatar] = useState(user?.avatar || AVATAR_CHOICES[0]);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    user?.notificationPreferences || {
      dealStageChanges: true,
      leadAssignments: true,
      dailyTaskDigest: true,
      weeklySummary: false,
    }
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ success: boolean; user: AuthUser }>('/api/settings/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone, title, department, avatar }),
      });
      updateLocalUser(res.user);
      showToast('Profile details updated', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await apiRequest('/api/settings/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        notificationPreferences: NotificationPreferences;
      }>('/api/settings/preferences', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      if (user) {
        updateLocalUser({ ...user, notificationPreferences: res.notificationPreferences });
      }
      showToast('Notification preferences saved', 'success');
    } catch (err) {
      setPrefs(prefs);
      showToast(err instanceof ApiError ? err.message : 'Failed to update preferences', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* User Profile Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <User className="h-5 w-5 text-violet-600" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">User Profile</h2>
            <p className="text-xs text-slate-500">Manage your identity and workspace contact details</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar src={avatar} name={name || user?.name || 'User'} size="lg" />
            <div>
              <p className="text-xs font-medium text-slate-700">Executive Portrait</p>
              <div className="mt-2 flex items-center gap-2">
                {AVATAR_CHOICES.map((choice, idx) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setAvatar(choice)}
                    className={`rounded-lg border-2 p-0.5 transition-colors ${
                      avatar === choice ? 'border-violet-600' : 'border-transparent hover:border-slate-300'
                    }`}
                    aria-label={`Select portrait ${idx + 1}`}
                  >
                    <img
                      src={choice}
                      alt={`Portrait option ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-md object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Work Email</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Job Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Assigned Role</label>
              <input
                type="text"
                disabled
                value={user?.role || ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Change Password Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <Lock className="h-5 w-5 text-violet-600" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500">Update your workspace authentication credentials</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Confirm Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            />
          </div>
          <div className="flex justify-end sm:col-span-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Notification Preferences Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Notification Preferences
              </h2>
              <p className="text-xs text-slate-500">
                Choose which real-time CRM events trigger alert digests
              </p>
            </div>
          </div>
          {savingPrefs && <span className="text-xs text-slate-400">Syncing...</span>}
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {(
            [
              {
                key: 'dealStageChanges',
                title: 'Deal Stage Transitions',
                desc: 'Notify when assigned opportunities advance to Proposal, Negotiation, or Won.',
              },
              {
                key: 'leadAssignments',
                title: 'Lead Assignments',
                desc: 'Alert immediately when an inbound or outbound lead is assigned to you.',
              },
              {
                key: 'dailyTaskDigest',
                title: 'Daily Follow-Up Digest',
                desc: 'Morning summary of pending calls, meetings, and overdue follow-up tasks.',
              },
              {
                key: 'weeklySummary',
                title: 'Weekly Executive Pipeline Report',
                desc: 'Consolidated Monday morning revenue velocity and quota attainment snapshot.',
              },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[item.key]}
                onClick={() => handleTogglePreference(item.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  prefs[item.key] ? 'bg-violet-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    prefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
