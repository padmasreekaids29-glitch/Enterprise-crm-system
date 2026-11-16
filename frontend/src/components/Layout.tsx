import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { Avatar } from './Avatar.tsx';

export type NavSection =
  | 'dashboard'
  | 'leads'
  | 'customers'
  | 'pipeline'
  | 'activities'
  | 'reports'
  | 'admin'
  | 'settings';

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  pageTitle: string;
  breadcrumb: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Array<'Admin' | 'Manager' | 'Sales Executive'>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'customers', label: 'Customers', icon: Building2 },
  { id: 'pipeline', label: 'Sales Pipeline', icon: KanbanSquare },
  { id: 'activities', label: 'Activities', icon: Activity },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'admin', label: 'Admin Panel', icon: ShieldCheck, roles: ['Admin', 'Manager'] },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Layout({
  activeSection,
  onNavigate,
  pageTitle,
  breadcrumb,
  headerAction,
  children,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const handleNavClick = (section: NavSection) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    showToast('Signed out of NEXORA CRM', 'info');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B132B] text-slate-200">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            NEXORA CRM
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Primary Navigation">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar src={user.avatar} name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw]">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{breadcrumb}</p>
                <h1 className="truncate font-display text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {headerAction}
              {user && (
                <button
                  type="button"
                  onClick={() => handleNavClick('settings')}
                  className="hidden items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left transition-colors hover:bg-slate-50 sm:flex"
                >
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <div className="min-w-0">
                    <p className="max-w-[130px] truncate text-xs font-semibold text-slate-900">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-500">{user.role}</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
