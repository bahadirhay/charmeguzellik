import type { DashboardWeekDayColumn } from "@/components/admin/DashboardOperationsSummary";

export type DashboardOverduePendingItem = {
  id: string;
  label: string;
  daysOverdue: number;
  reviewNote: string | null;
};

export type DashboardUpcomingItem = {
  id: string;
  timeLabel: string;
  clientName: string;
  serviceName: string;
  status: string;
};

export type DashboardKpiData = {
  appointmentsToday: number;
  pendingApprovals: number;
  overduePending: number;
  totalCustomers: number;
  dailyRevenueMinor: number;
  monthRevenueMinor: number;
};

export type DashboardAppointmentsBlock = {
  pendingActionable: number;
  today: number;
  todayLabel: string;
  toRemind: number;
  toRemindItems: Array<{ id: string; label: string }>;
  completedToday: number;
  completedThisWeek: number;
  weekStrip: { rangeHint: string; days: DashboardWeekDayColumn[] };
  overduePending: DashboardOverduePendingItem[];
  upcomingToday: DashboardUpcomingItem[];
  /** Bugün, takvimdeki aktif liste ile aynı filtre */
  todayPending: number;
  todayCancelRequests: number;
};

export type DashboardCommerceBlock = {
  activePackages: number;
  today: { receiptCount: number; sumMinor: number };
  week: { receiptCount: number; sumMinor: number };
  month: { receiptCount: number; sumMinor: number };
};

export type DashboardStaffWorkBlock = {
  totals: {
    today: { total: number; operations: number; cashEntries: number };
    week: { total: number; operations: number; cashEntries: number };
    month: { total: number; operations: number; cashEntries: number };
  };
  byStaff: Array<{
    staffUserId: string;
    displayLabel: string;
    username: string;
    today: { total: number; operations: number; cashEntries: number };
    week: { total: number; operations: number; cashEntries: number };
    month: { total: number; operations: number; cashEntries: number };
  }>;
};
