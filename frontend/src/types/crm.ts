export type UserRole = 'Admin' | 'Manager' | 'Sales Executive';

export interface NotificationPreferences {
  dealStageChanges: boolean;
  leadAssignments: boolean;
  dailyTaskDigest: boolean;
  weeklySummary: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  phone: string;
  department: string;
  avatar: string;
  teamId: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  notificationPreferences: NotificationPreferences;
  createdAt?: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  avatar: string;
  department: string;
}

export type LeadSource =
  | 'Website'
  | 'Referral'
  | 'LinkedIn'
  | 'Cold Outreach'
  | 'Partner'
  | 'Conference';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';

export interface LeadItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  estimatedValue: number;
  notes: string;
  assignedTo: { id: string; name: string; email: string; avatar: string } | null;
  convertedCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomerSegment = 'Enterprise' | 'Mid-Market' | 'SMB';
export type CustomerStatus = 'Active' | 'Onboarding' | 'At Risk' | 'Churned';

export interface CustomerItem {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  segment: CustomerSegment;
  status: CustomerStatus;
  lifetimeValue: number;
  address: string;
  website: string;
  notes: string;
  assignedTo: { id: string; name: string; email: string; avatar: string } | null;
  totalDeals: number;
  openPipelineValue: number;
  createdAt: string;
  updatedAt: string;
}

export type DealStage =
  | 'Prospecting'
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type DealPriority = 'Low' | 'Medium' | 'High';

export interface DealItem {
  id: string;
  title: string;
  customerId: string | null;
  companyName: string;
  value: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate: string;
  closedAt?: string | null;
  priority: DealPriority;
  notes: string;
  assignedTo: { id: string; name: string; avatar: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = 'Call' | 'Meeting' | 'Task' | 'Note';
export type ActivityRelatedType = 'Lead' | 'Customer' | 'Deal' | 'General';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  subject: string;
  description: string;
  relatedType: ActivityRelatedType;
  relatedId: string | null;
  relatedName: string;
  followUpDate: string | null;
  completed: boolean;
  completedAt: string | null;
  priority: 'Low' | 'Medium' | 'High';
  owner: { id: string; name: string; avatar: string } | null;
  createdAt: string;
}

export interface DashboardData {
  kpis: {
    totalLeads: number;
    totalCustomers: number;
    totalRevenue: number;
    activeDealsCount: number;
    activePipelineValue: number;
    weightedPipeline: number;
    conversionRate: number;
    wonDealsCount: number;
  };
  monthlySales: Array<{ month: string; revenue: number; deals: number; target: number }>;
  leadSources: Array<{ source: string; count: number; estimatedValue: number }>;
  recentActivities: Array<{
    id: string;
    type: ActivityType;
    subject: string;
    relatedType: string;
    relatedName: string;
    completed: boolean;
    priority: string;
    followUpDate: string | null;
    createdAt: string;
    ownerName: string;
    ownerAvatar: string;
  }>;
  salesPerformance: Array<{
    id: string;
    name: string;
    role: string;
    avatar: string;
    dealsWon: number;
    openDeals: number;
    revenue: number;
    pipeline: number;
    quotaAttainment: number;
  }>;
}

export interface ReportsData {
  summary: {
    totalWonRevenue: number;
    openPipelineValue: number;
    winRate: number;
    avgWonDealSize: number;
    totalLeads: number;
    leadConversionRate: number;
  };
  monthlyRevenue: Array<{
    month: string;
    actualRevenue: number;
    targetRevenue: number;
    dealsClosed: number;
  }>;
  salesPerformance: Array<{
    id: string;
    name: string;
    role: string;
    avatar: string;
    dealsWon: number;
    dealsLost: number;
    winRate: number;
    revenue: number;
    pipeline: number;
    avgDealSize: number;
  }>;
  leadFunnel: Array<{ status: string; count: number; value: number }>;
  leadSourceAnalytics: Array<{
    source: string;
    total: number;
    qualifiedOrConverted: number;
    qualificationRate: number;
    estimatedValue: number;
  }>;
  dealStageAnalytics: Array<{
    stage: string;
    count: number;
    value: number;
    weightedValue: number;
  }>;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  department: string;
  avatar: string;
  isActive: boolean;
  lastLoginAt: string | null;
  team: { id: string; name: string } | null;
  closedRevenue: number;
  createdAt: string;
}

export interface AdminTeamRow {
  id: string;
  name: string;
  region: string;
  description: string;
  monthlyQuota: number;
  manager: { id: string; name: string } | null;
  memberCount: number;
  teamRevenue: number;
}

export interface AuditLogRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  summary: string;
  createdAt: string;
}

export interface AdminOverviewData {
  systemOverview: {
    totalUsers: number;
    activeUsers: number;
    totalTeams: number;
    collections: {
      leads: number;
      customers: number;
      deals: number;
      activities: number;
    };
  };
  users: AdminUserRow[];
  teams: AdminTeamRow[];
  auditLogs: AuditLogRow[];
}
