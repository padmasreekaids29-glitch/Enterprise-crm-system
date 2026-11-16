import { Briefcase, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ApiError } from '../services/api.ts';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    name: 'Elena Vance',
    email: 'admin@nexoracrm.com',
  },
  {
    label: 'Manager',
    name: 'Marcus Chen',
    email: 'manager@nexoracrm.com',
  },
  {
    label: 'Sales Executive',
    name: 'Sophia Patel',
    email: 'sophia@nexoracrm.com',
  },
];

export function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('admin@nexoracrm.com');
  const [password, setPassword] = useState('Nexora@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      showToast('Welcome back to NEXORA CRM', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoFill = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Nexora@2026');
    setError('');
    setSubmitting(true);
    try {
      await login(demoEmail, 'Nexora@2026');
      showToast('Signed in with demo workspace account', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-12">
      {/* Left Executive Architectural Panel */}
      <div className="relative hidden overflow-hidden bg-[#0B132B] lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
        <img
          src="/src/assets/images/auth_enterprise_backdrop_1794844538652.jpg"
          alt="NEXORA Enterprise Headquarters"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B132B] via-[#0B132B]/75 to-[#0B132B]/40" />

        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              NEXORA CRM
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6 p-10">
          <h2 className="font-display text-3xl leading-tight font-bold text-white text-balance">
            Unified revenue operations for enterprise sales teams.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-slate-300">
            Manage qualified leads, monitor multi-stage pipeline velocity, track customer account
            histories, and enforce role-based governance from a single platform.
          </p>
          <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <div>
              <p className="font-mono-num text-xl font-semibold text-white">6 Stages</p>
              <p className="mt-0.5 text-xs text-slate-400">Kanban pipeline</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-semibold text-white">RBAC</p>
              <p className="mt-0.5 text-xs text-slate-400">3 role tiers</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-semibold text-white">REST API</p>
              <p className="mt-0.5 text-xs text-slate-400">MongoDB backed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:col-span-7 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold text-slate-900">NEXORA CRM</span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Sign in to your workspace
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your corporate credentials to access pipeline and account records.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
                Work Email
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-900 transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Role-Based Quick Demo Access */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-xs font-medium text-slate-500">
              Quick Sign-In by Enterprise Role (Password: <span className="font-mono-num">Nexora@2026</span>)
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoFill(acct.email)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/60 disabled:opacity-60"
                >
                  <p className="text-xs font-semibold text-slate-900">{acct.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{acct.name}</p>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Need a new workspace account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-semibold text-violet-600 hover:text-violet-700 hover:underline"
            >
              Register account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
