import Link from "next/link";
import { headers } from "next/headers";
import type { DashboardWeekDayColumn, DashboardWeekAppointmentRow } from "@/components/admin/DashboardOperationsSummary";
import { DashboardDesktopSummary } from "@/components/admin/dashboard/DashboardDesktopSummary";
import { DashboardMobileSummary } from "@/components/admin/dashboard/DashboardMobileSummary";
import type { DashboardOverduePendingItem, DashboardUpcomingItem } from "@/components/admin/dashboard/types";
import {
  daysOverdueFromStart,
  fetchOverduePendingAppointments,
  latestOverdueReviewNoteByAppointment,
  syncOverduePendingEvents,
} from "@/lib/appointment-overdue-pending";
import { isMobileUserAgent } from "@/lib/is-mobile-user-agent";
import { filterAppointmentsForSelfScope, resolveAppointmentPanelScope } from "@/lib/appointment-panel-access";
import {
  appointmentStaffLabelsEqual,
  isLikelyStaffUserId,
  parseAssignedStaffFromNotes,
} from "@/lib/appointment-staffing";
import {
  addCalendarDaysYmd,
  formatYmdInIstanbul,
  getIstanbulMondayYmdContaining,
  getIstanbulMonthFirstYmdContaining,
  getIstanbulMonthRangeUtcFromMonthFirst,
  getIstanbulTodayYmd,
  getIstanbulWeekRangeUtcFromMonday,
  istanbulDayUtcRange,
} from "@/lib/istanbul-day-bounds";
import { prisma, withPrismaEngine } from "@/lib/prisma";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";
import { getTenantForRequest, getTenantIdForRequest } from "@/lib/tenant-db";
import { requireStaffPage } from "@/lib/auth";
import { canAccessAdminReports } from "@/lib/admin-reports-gate";
import { hasStaffPermission } from "@/lib/staff-permissions";

export const dynamic = "force-dynamic";

/** Randevu takvimi aktif listesi ile aynı (cancel_request ve checked_in dahil değil). */
const APPT_ACTIVE_LIST_STATUSES = ["pending", "approved", "confirmed"] as const;
const APPT_CALENDAR_STATUSES = ["pending", "approved", "confirmed", "cancel_request", "checked_in"] as const;
const WEEK_PANEL_STATUSES = ["approved", "confirmed"] as const;
const MAX_APPOINTMENTS_PER_DAY_COLUMN = 6;

type Props = {
  /** Next can pass sync object veya Promise; ikisini güvenli kabul et */
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

function trimTitle(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const ISTANBUL_TZ = "Europe/Istanbul";

function formatRemindItemLabel(r: { startAt: Date; clientName: string; serviceName: string | null }): string {
  const when = new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(r.startAt);
  return `${when} · ${trimTitle(`${r.clientName} — ${r.serviceName?.trim() || "Randevu"}`, 56)}`;
}

function buildWeekStrip(
  mondayYmd: string,
  todayYmd: string,
  rows: Array<{ id: string; startAt: Date; clientName: string; serviceName: string | null }>,
): { rangeHint: string; days: DashboardWeekDayColumn[] } {
  const sundayYmd = addCalendarDaysYmd(mondayYmd, 6);
  const monStart = istanbulDayUtcRange(mondayYmd).startUtc;
  const sunStart = istanbulDayUtcRange(sundayYmd).startUtc;
  const rangeHint = `${new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" }).format(monStart)} – ${new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric" }).format(sunStart)}`;

  const timeFmt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  });
  const headFmt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    day: "numeric",
  });

  const byDay = new Map<string, DashboardWeekAppointmentRow[]>();
  for (let i = 0; i < 7; i++) {
    byDay.set(addCalendarDaysYmd(mondayYmd, i), []);
  }
  for (const r of rows) {
    const ymd = formatYmdInIstanbul(r.startAt);
    const bucket = byDay.get(ymd);
    if (!bucket) continue;
    const title = trimTitle(`${r.clientName} — ${r.serviceName?.trim() || "Randevu"}`, 44);
    bucket.push({
      id: r.id,
      timeLabel: timeFmt.format(r.startAt),
      title,
    });
  }

  const days: DashboardWeekDayColumn[] = [];
  for (let i = 0; i < 7; i++) {
    const ymd = addCalendarDaysYmd(mondayYmd, i);
    const dayStart = istanbulDayUtcRange(ymd).startUtc;
    const raw = byDay.get(ymd) ?? [];
    const appts = raw.slice(0, MAX_APPOINTMENTS_PER_DAY_COLUMN);
    const moreCount = Math.max(0, raw.length - MAX_APPOINTMENTS_PER_DAY_COLUMN);
    days.push({
      ymd,
      heading: headFmt.format(dayStart),
      isToday: ymd === todayYmd,
      appointments: appts,
      moreCount,
    });
  }

  return { rangeHint, days };
}

async function buildOverduePendingItems(
  tenantId: string,
  rows: Awaited<ReturnType<typeof fetchOverduePendingAppointments>>,
  nowUtc: Date,
): Promise<DashboardOverduePendingItem[]> {
  const reviewNotes = await latestOverdueReviewNoteByAppointment(
    prisma,
    tenantId,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    label: formatRemindItemLabel(r),
    daysOverdue: daysOverdueFromStart(r.startAt, nowUtc),
    reviewNote: reviewNotes.get(r.id) ?? null,
  }));
}

function mapUpcomingToday(
  rows: Array<{
    id: string;
    startAt: Date;
    clientName: string;
    serviceName: string | null;
    status: string;
  }>,
): DashboardUpcomingItem[] {
  const timeFmt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  return rows.map((r) => ({
    id: r.id,
    timeLabel: timeFmt.format(r.startAt),
    clientName: r.clientName,
    serviceName: r.serviceName?.trim() || "Randevu",
    status: r.status,
  }));
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  const qp = await Promise.resolve(searchParams ?? {});
  const forbiddenKey = firstSearchParam(qp.forbidden);
  const access = await requireStaffPage();
  const p = access.permissions;
  const { scope: apptScope, selfStaffLabel } = resolveAppointmentPanelScope(access);
  const t = await getTenantIdForRequest();
  const tenantRow = await getTenantForRequest();
  const tenantLabel = tenantRow?.slug?.trim() || tenantRow?.name?.trim() || t;
  const hdrs = await headers();
  const isMobileLayout = isMobileUserAgent(hdrs.get("user-agent"));
  const greetingName = access.staffDisplayName?.trim() || access.username;

  const { summaryAppointments, summaryCommerce, summaryStaffWork, summaryKpi } = await withPrismaEngine(async () => {
    const tenantRow = await prisma.tenant.findUnique({ where: { id: t }, select: { featuresJson: true } });
    const appointmentsModuleEnabledInner = isAppointmentsModuleEnabled(tenantRow?.featuresJson);
    const commerceModuleEnabledInner = isCommerceModuleEnabled(tenantRow?.featuresJson);

    const hasFullAppt = hasStaffPermission(p, "crm.appointments");
    const hasSelfAppt = hasStaffPermission(p, "crm.appointments.self");
    const canCommerce = commerceModuleEnabledInner && hasStaffPermission(p, "commerce.manage");
    const showStaffWork =
      (appointmentsModuleEnabledInner && (hasFullAppt || hasSelfAppt)) || canCommerce;

    const todayYmd = getIstanbulTodayYmd();
    const { startUtc: dayStart, endUtc: dayEnd } = istanbulDayUtcRange(todayYmd);
    const todayLabelPretty = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dayStart);
    const mondayYmd = getIstanbulMondayYmdContaining(todayYmd);
    const { startUtc: isoWeekStart, endExclusiveUtc: isoWeekEnd } = getIstanbulWeekRangeUtcFromMonday(mondayYmd);
    const monthFirstYmd = getIstanbulMonthFirstYmdContaining(todayYmd);
    const { startUtc: monthStartUtc, endExclusiveUtc: monthEndUtc } =
      getIstanbulMonthRangeUtcFromMonthFirst(monthFirstYmd);
    const yRemind = addCalendarDaysYmd(todayYmd, -1);
    const toRemindCutoffUtc = istanbulDayUtcRange(yRemind).startUtc;

    let summaryAppointmentsInner: {
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
      todayPending: number;
      todayCancelRequests: number;
    } | null = null;

    const nowUtc = new Date();

    if (
      appointmentsModuleEnabledInner &&
      (hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self"))
    ) {
      await syncOverduePendingEvents(prisma, t, nowUtc);

      const upcomingTodaySelect = {
        id: true,
        startAt: true,
        clientName: true,
        serviceName: true,
        status: true,
        notes: true,
      } as const;

      if (apptScope === "self") {
        const pendingRows = await prisma.appointment.findMany({
          where: { tenantId: t, status: "pending" },
          select: { notes: true, startAt: true },
        });
        const pendingScoped = filterAppointmentsForSelfScope(pendingRows, selfStaffLabel);
        const pendingActionable = pendingScoped.filter((r) => r.startAt >= nowUtc).length;

        const panelWeekRows = await prisma.appointment.findMany({
          where: {
            tenantId: t,
            startAt: { gte: isoWeekStart, lt: isoWeekEnd },
            status: { in: [...WEEK_PANEL_STATUSES] },
          },
          select: {
            id: true,
            startAt: true,
            clientName: true,
            serviceName: true,
            notes: true,
          },
          orderBy: { startAt: "asc" },
        });
        const panelScoped = filterAppointmentsForSelfScope(panelWeekRows, selfStaffLabel);
        const weekStrip = buildWeekStrip(
          mondayYmd,
          todayYmd,
          panelScoped.map(({ id, startAt, clientName, serviceName }) => ({ id, startAt, clientName, serviceName })),
        );

        const remindCandidates = await prisma.appointment.findMany({
          where: {
            tenantId: t,
            status: "approved",
            startAt: { gte: toRemindCutoffUtc },
          },
          select: {
            id: true,
            startAt: true,
            clientName: true,
            serviceName: true,
            notes: true,
          },
          orderBy: { startAt: "asc" },
        });
        const remindScoped = filterAppointmentsForSelfScope(remindCandidates, selfStaffLabel);
        const toRemindItems = remindScoped.map((r) => ({
          id: r.id,
          label: formatRemindItemLabel(r),
        }));
        const toRemind = remindScoped.length;

        const doneWeekRows = await prisma.appointment.findMany({
          where: {
            tenantId: t,
            status: "checked_in",
            startAt: { gte: isoWeekStart, lt: isoWeekEnd },
          },
          select: { notes: true },
        });
        const completedThisWeek = filterAppointmentsForSelfScope(doneWeekRows, selfStaffLabel).length;

        const doneTodayRows = await prisma.appointment.findMany({
          where: {
            tenantId: t,
            status: "checked_in",
            startAt: { gte: dayStart, lt: dayEnd },
          },
          select: { notes: true },
        });
        const completedToday = filterAppointmentsForSelfScope(doneTodayRows, selfStaffLabel).length;

        const overdueRaw = await fetchOverduePendingAppointments(prisma, t, nowUtc);
        const overdueScoped = filterAppointmentsForSelfScope(overdueRaw, selfStaffLabel);
        const overduePending = await buildOverduePendingItems(t, overdueScoped, nowUtc);

        const upcomingRaw = await prisma.appointment.findMany({
          where: {
            tenantId: t,
            startAt: { gte: dayStart, lt: dayEnd },
            status: { in: [...APPT_ACTIVE_LIST_STATUSES] },
          },
          select: upcomingTodaySelect,
          orderBy: { startAt: "asc" },
          take: 12,
        });
        const upcomingScoped = filterAppointmentsForSelfScope(upcomingRaw, selfStaffLabel);
        const todayCancelRequests = await prisma.appointment.count({
          where: {
            tenantId: t,
            startAt: { gte: dayStart, lt: dayEnd },
            status: "cancel_request",
          },
        });
        const today = upcomingScoped.length;
        const todayPending = upcomingScoped.filter((r) => r.status === "pending").length;

        summaryAppointmentsInner = {
          pendingActionable,
          today,
          todayLabel: todayLabelPretty,
          toRemind,
          toRemindItems,
          completedToday,
          completedThisWeek,
          weekStrip,
          overduePending,
          upcomingToday: mapUpcomingToday(upcomingScoped),
          todayPending,
          todayCancelRequests,
        };
      } else if (hasStaffPermission(p, "crm.appointments")) {
        const panelWeekRows = await prisma.appointment.findMany({
          where: {
            tenantId: t,
            startAt: { gte: isoWeekStart, lt: isoWeekEnd },
            status: { in: [...WEEK_PANEL_STATUSES] },
          },
          select: {
            id: true,
            startAt: true,
            clientName: true,
            serviceName: true,
          },
          orderBy: { startAt: "asc" },
        });
        const weekStrip = buildWeekStrip(mondayYmd, todayYmd, panelWeekRows);

        const [pendingRows, todayActiveCount, todayCancelRequests, remindRows, completedToday, completedThisWeek, overdueRaw, upcomingRaw] =
          await Promise.all([
          prisma.appointment.findMany({
            where: { tenantId: t, status: "pending" },
            select: { startAt: true },
          }),
          prisma.appointment.count({
            where: {
              tenantId: t,
              startAt: { gte: dayStart, lt: dayEnd },
              status: { in: [...APPT_ACTIVE_LIST_STATUSES] },
            },
          }),
          prisma.appointment.count({
            where: {
              tenantId: t,
              startAt: { gte: dayStart, lt: dayEnd },
              status: "cancel_request",
            },
          }),
          prisma.appointment.findMany({
            where: {
              tenantId: t,
              status: "approved",
              startAt: { gte: toRemindCutoffUtc },
            },
            select: {
              id: true,
              startAt: true,
              clientName: true,
              serviceName: true,
            },
            orderBy: { startAt: "asc" },
          }),
          prisma.appointment.count({
            where: {
              tenantId: t,
              status: "checked_in",
              startAt: { gte: dayStart, lt: dayEnd },
            },
          }),
          prisma.appointment.count({
            where: {
              tenantId: t,
              status: "checked_in",
              startAt: { gte: isoWeekStart, lt: isoWeekEnd },
            },
          }),
          fetchOverduePendingAppointments(prisma, t, nowUtc),
          prisma.appointment.findMany({
            where: {
              tenantId: t,
              startAt: { gte: dayStart, lt: dayEnd },
              status: { in: [...APPT_ACTIVE_LIST_STATUSES] },
            },
            select: upcomingTodaySelect,
            orderBy: { startAt: "asc" },
            take: 12,
          }),
        ]);
        const pendingActionable = pendingRows.filter((r) => r.startAt >= nowUtc).length;
        const overduePending = await buildOverduePendingItems(t, overdueRaw, nowUtc);
        const todayPending = upcomingRaw.filter((r) => r.status === "pending").length;
        const toRemindItems = remindRows.map((r) => ({
          id: r.id,
          label: formatRemindItemLabel(r),
        }));
        const toRemind = remindRows.length;
        summaryAppointmentsInner = {
          pendingActionable,
          today: todayActiveCount,
          todayLabel: todayLabelPretty,
          toRemind,
          toRemindItems,
          completedToday,
          completedThisWeek,
          weekStrip,
          overduePending,
          upcomingToday: mapUpcomingToday(upcomingRaw),
          todayPending,
          todayCancelRequests,
        };
      }
    }

    let summaryCommerceInner: {
      activePackages: number;
      today: { receiptCount: number; sumMinor: number };
      week: { receiptCount: number; sumMinor: number };
      month: { receiptCount: number; sumMinor: number };
    } | null = null;

    if (canCommerce) {
      const cashAgg = (start: Date, end: Date) =>
        prisma.commerceCashReceipt.aggregate({
          where: { tenantId: t, occurredAt: { gte: start, lt: end } },
          _count: { _all: true },
          _sum: { amountMinor: true },
        });
      const [activePackages, aToday, aWeek, aMonth] = await Promise.all([
        prisma.commercePackagePurchase.count({ where: { tenantId: t, status: "active" } }),
        cashAgg(dayStart, dayEnd),
        cashAgg(isoWeekStart, isoWeekEnd),
        cashAgg(monthStartUtc, monthEndUtc),
      ]);
      const pack = (a: typeof aToday) => ({
        receiptCount: a._count._all,
        sumMinor: a._sum.amountMinor ?? 0,
      });
      summaryCommerceInner = {
        activePackages,
        today: pack(aToday),
        week: pack(aWeek),
        month: pack(aMonth),
      };
    }

    let summaryStaffWorkInner: {
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
    } | null = null;

    if (showStaffWork) {
      type Bucket = { operations: number; cashEntries: number; total: number };
      const emptyBucket = (): Bucket => ({ operations: 0, cashEntries: 0, total: 0 });
      const bumpOperations = (b: Bucket) => {
        b.operations += 1;
        b.total = b.operations + b.cashEntries;
      };
      const bumpCash = (b: Bucket) => {
        b.cashEntries += 1;
        b.total = b.operations + b.cashEntries;
      };
      const addBuckets = (a: Bucket, b: Bucket): Bucket => ({
        operations: a.operations + b.operations,
        cashEntries: a.cashEntries + b.cashEntries,
        total: a.operations + b.operations + a.cashEntries + b.cashEntries,
      });

      const operationAttributesToStaff = (
        st: { id: string; username: string; displayName: string | null },
        notes: string | null,
      ): boolean => {
        const assigned = parseAssignedStaffFromNotes(notes);
        if (!assigned?.trim()) return false;
        if (isLikelyStaffUserId(assigned)) return assigned.trim() === st.id;
        if (appointmentStaffLabelsEqual(assigned, st.username)) return true;
        const dn = st.displayName?.trim();
        if (dn && appointmentStaffLabelsEqual(assigned, dn)) return true;
        return false;
      };

      const reportStart = new Date(Math.min(dayStart.getTime(), isoWeekStart.getTime(), monthStartUtc.getTime()));
      const reportEnd = new Date(Math.max(dayEnd.getTime(), isoWeekEnd.getTime(), monthEndUtc.getTime()));

      const staffWhere =
        hasSelfAppt && !hasFullAppt && access.staffUserId
          ? { id: access.staffUserId as string }
          : hasSelfAppt && !hasFullAppt && !access.staffUserId
            ? { username: access.username.trim().toLowerCase() }
            : {};

      const [staffList, operationsAllRaw, cashAllRaw] = await Promise.all([
        prisma.staffUser.findMany({
          where: { tenantId: t, active: true, ...staffWhere },
          select: { id: true, username: true, displayName: true },
          orderBy: { username: "asc" },
        }),
        appointmentsModuleEnabledInner && (hasFullAppt || hasSelfAppt)
          ? prisma.appointment.findMany({
              where: {
                tenantId: t,
                startAt: { gte: reportStart, lt: reportEnd },
                status: { in: ["checked_in", "no_show"] },
              },
              select: { notes: true, startAt: true },
            })
          : Promise.resolve([] as Array<{ notes: string | null; startAt: Date }>),
        canCommerce
          ? prisma.commerceCashReceipt.findMany({
              where: {
                tenantId: t,
                occurredAt: { gte: reportStart, lt: reportEnd },
                staffUserId: { not: null },
                ...(!hasFullAppt && hasSelfAppt && access.staffUserId ? { staffUserId: access.staffUserId } : {}),
              },
              select: { staffUserId: true, occurredAt: true },
            })
          : Promise.resolve([] as Array<{ staffUserId: string; occurredAt: Date }>),
      ]);

      let operationsAll = operationsAllRaw;
      if (hasSelfAppt && !hasFullAppt && selfStaffLabel?.trim()) {
        operationsAll = filterAppointmentsForSelfScope(operationsAllRaw, selfStaffLabel);
      } else if (!hasFullAppt && !hasSelfAppt) {
        operationsAll = [];
      }

      const inRange = (d: Date, lo: Date, hi: Date) => d.getTime() >= lo.getTime() && d.getTime() < hi.getTime();

      const byStaff = staffList.map((st) => {
        const today = emptyBucket();
        const week = emptyBucket();
        const month = emptyBucket();
        for (const row of operationsAll) {
          if (!operationAttributesToStaff(st, row.notes)) continue;
          if (inRange(row.startAt, dayStart, dayEnd)) bumpOperations(today);
          if (inRange(row.startAt, isoWeekStart, isoWeekEnd)) bumpOperations(week);
          if (inRange(row.startAt, monthStartUtc, monthEndUtc)) bumpOperations(month);
        }
        for (const c of cashAllRaw) {
          if (c.staffUserId !== st.id) continue;
          if (inRange(c.occurredAt, dayStart, dayEnd)) bumpCash(today);
          if (inRange(c.occurredAt, isoWeekStart, isoWeekEnd)) bumpCash(week);
          if (inRange(c.occurredAt, monthStartUtc, monthEndUtc)) bumpCash(month);
        }
        return {
          staffUserId: st.id,
          displayLabel: st.displayName?.trim() || st.username,
          username: st.username,
          today,
          week,
          month,
        };
      });

      const totals = byStaff.reduce(
        (acc, r) => ({
          today: addBuckets(acc.today, r.today),
          week: addBuckets(acc.week, r.week),
          month: addBuckets(acc.month, r.month),
        }),
        { today: emptyBucket(), week: emptyBucket(), month: emptyBucket() },
      );

      summaryStaffWorkInner = { totals, byStaff };
    }

    let summaryKpiInner: {
      appointmentsToday: number;
      pendingApprovals: number;
      overduePending: number;
      totalCustomers: number;
      dailyRevenueMinor: number;
      monthRevenueMinor: number;
    } | null = null;

    const showKpi =
      summaryAppointmentsInner != null ||
      summaryCommerceInner != null ||
      (appointmentsModuleEnabledInner &&
        (hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self")));

    if (showKpi) {
      const overdueFallback =
        summaryAppointmentsInner != null
          ? summaryAppointmentsInner.overduePending.length
          : appointmentsModuleEnabledInner &&
              (hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self"))
            ? (
                await prisma.appointment.count({
                  where: { tenantId: t, status: "pending", startAt: { lt: nowUtc } },
                })
              )
            : 0;

      const [pendingApprovals, appointmentsToday, totalCustomers, dailyRevenueAgg] = await Promise.all([
        summaryAppointmentsInner != null
          ? Promise.resolve(summaryAppointmentsInner.pendingActionable)
          : appointmentsModuleEnabledInner &&
              (hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self"))
            ? prisma.appointment.count({
                where: { tenantId: t, status: "pending", startAt: { gte: nowUtc } },
              })
            : Promise.resolve(0),
        summaryAppointmentsInner != null
          ? Promise.resolve(summaryAppointmentsInner.today)
          : appointmentsModuleEnabledInner &&
              (hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self"))
            ? prisma.appointment.count({
                where: {
                  tenantId: t,
                  startAt: { gte: dayStart, lt: dayEnd },
                  status: { in: [...APPT_ACTIVE_LIST_STATUSES] },
                },
              })
            : Promise.resolve(0),
        hasStaffPermission(p, "crm.leads") || hasStaffPermission(p, "crm.appointments")
          ? prisma.crmContact.count({ where: { tenantId: t } })
          : Promise.resolve(0),
        canCommerce
          ? prisma.commerceCashReceipt.aggregate({
              where: { tenantId: t, occurredAt: { gte: dayStart, lt: dayEnd } },
              _sum: { amountMinor: true },
            })
          : Promise.resolve({ _sum: { amountMinor: 0 } }),
      ]);
      summaryKpiInner = {
        appointmentsToday,
        pendingApprovals,
        overduePending: overdueFallback,
        totalCustomers,
        dailyRevenueMinor: dailyRevenueAgg._sum.amountMinor ?? 0,
        monthRevenueMinor: summaryCommerceInner?.month.sumMinor ?? 0,
      };
    }

    return {
      summaryAppointments: summaryAppointmentsInner,
      summaryCommerce: summaryCommerceInner,
      summaryStaffWork: summaryStaffWorkInner,
      summaryKpi: summaryKpiInner,
    };
  });

  const todayLabelHeader = summaryAppointments?.todayLabel ?? "";

  return (
    <div className="space-y-8">
      {!isMobileLayout ? (
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Özet</h1>
      ) : null}
      {forbiddenKey ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {forbiddenKey === "appointment_module"
            ? "Bu site için randevu modülü kapalı; Genel ayarlardan açabilirsiniz."
            : "Bu bölüme erişim yetkiniz yok. Sol menüden size açık olan sayfaları kullanın."}
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Aktif salon: <span className="font-medium text-zinc-700 dark:text-zinc-300">{tenantLabel}</span>
        {process.env.NODE_ENV === "development" ? (
          <span className="text-zinc-400"> · kiracı id: {t.slice(0, 12)}…</span>
        ) : null}
      </p>
      {isMobileLayout ? (
        <DashboardMobileSummary
          greetingName={greetingName}
          todayLabel={todayLabelHeader}
          kpi={summaryKpi}
          appointments={summaryAppointments}
          commerce={summaryCommerce}
        />
      ) : (
        <DashboardDesktopSummary
          greetingName={greetingName}
          todayLabel={todayLabelHeader}
          kpi={summaryKpi}
          appointments={summaryAppointments}
          commerce={summaryCommerce}
          staffWork={summaryStaffWork}
          showReportsLink={canAccessAdminReports(p)}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasStaffPermission(p, "social.instagram") ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Instagram</p>
            <p className="mt-1 text-xs text-zinc-500">Yayınlanacak gönderileri seçin</p>
            <Link href="/admin/instagram" className="mt-2 inline-block text-sm text-rose-600">
              Vitrin →
            </Link>
          </div>
        ) : null}
      </div>
      {!summaryAppointments && !summaryCommerce && !summaryStaffWork && !hasStaffPermission(p, "social.instagram") ? (
        <p className="text-sm text-zinc-500">Bu hesap için özet kutusu tanımlı değil. Sol menüden erişebildiğiniz bölümleri kullanın.</p>
      ) : null}
    </div>
  );
}
