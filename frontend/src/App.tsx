import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Layout, type NavSection } from './components/Layout.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { ActivitiesPage } from './pages/ActivitiesPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { CustomersPage } from './pages/CustomersPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { PipelinePage } from './pages/PipelinePage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

const SECTION_META: Record<NavSection, { title: string; breadcrumb: string }> = {
  dashboard: { title: 'Executive Dashboard', breadcrumb: 'NEXORA CRM / Overview' },
  leads: { title: 'Lead Management', breadcrumb: 'NEXORA CRM / Acquisition / Leads' },
  customers: { title: 'Customer Directory', breadcrumb: 'NEXORA CRM / Accounts / Customers' },
  pipeline: { title: 'Sales Pipeline', breadcrumb: 'NEXORA CRM / Deals / Kanban Board' },
  activities: { title: 'Activity Timeline & Tasks', breadcrumb: 'NEXORA CRM / Execution / Activities' },
  reports: { title: 'Reports & Analytics', breadcrumb: 'NEXORA CRM / Intelligence / Reports' },
  admin: { title: 'Administration Console', breadcrumb: 'NEXORA CRM / Governance / Admin Panel' },
  settings: { title: 'Account Settings', breadcrumb: 'NEXORA CRM / Workspace / Settings' },
};

function CrmShell() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [section, setSection] = useState<NavSection>('dashboard');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as NavSection;
    if (hash && hash in SECTION_META) {
      setSection(hash);
    }
  }, []);

  const navigate = (next: NavSection) => {
    setSection(next);
    window.location.hash = next;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
          <p className="text-sm font-medium text-slate-600">Loading NEXORA CRM workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  const meta = SECTION_META[section];

  const renderSection = () => {
    if (section === 'admin' && user.role !== 'Admin' && user.role !== 'Manager') {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            Restricted Access
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            The Administration Console is restricted to Manager and Admin roles.
          </p>
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (section) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'leads':
        return <LeadsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'pipeline':
        return <PipelinePage />;
      case 'activities':
        return <ActivitiesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'admin':
        return <AdminPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout
      activeSection={section}
      onNavigate={navigate}
      pageTitle={meta.title}
      breadcrumb={meta.breadcrumb}
    >
      {renderSection()}
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CrmShell />
      </AuthProvider>
    </ToastProvider>
  );
}
