"use client";

import Link from "next/link";
import { useI18n } from "../app/providers";
import { formatDuration } from "../lib/i18n";
import type {
  AuditMilestone,
  AuditReport,
  Kpis,
  TicketPriority,
  TicketStatus,
} from "../lib/types";

const STATUS_ORDER: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

const STATUS_COLOR: Record<TicketStatus, { bar: string; dot: string }> = {
  OPEN: { bar: "bg-sky-500", dot: "bg-sky-500" },
  IN_PROGRESS: { bar: "bg-amber-500", dot: "bg-amber-500" },
  WAITING: { bar: "bg-violet-500", dot: "bg-violet-500" },
  RESOLVED: { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  CLOSED: { bar: "bg-gray-400", dot: "bg-gray-400" },
  CANCELLED: { bar: "bg-red-500", dot: "bg-red-500" },
};

const PRIORITY_ORDER: TicketPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const PRIORITY_STYLE: Record<
  TicketPriority,
  { bar: string; stroke: string }
> = {
  URGENT: { bar: "bg-red-500", stroke: "#ef4444" },
  HIGH: { bar: "bg-orange", stroke: "#c96908" },
  MEDIUM: { bar: "bg-navy", stroke: "#0c1044" },
  LOW: { bar: "bg-gray-3", stroke: "#8e8e96" },
};

const EVENT_BADGE: Record<string, string> = {
  CREATED: "bg-sky-50 text-sky-800",
  READ: "bg-indigo-50 text-indigo-800",
  ASSIGNED: "bg-violet-50 text-violet-800",
  STATUS_CHANGED: "bg-amber-50 text-amber-800",
  COMMENTED: "bg-gray-100 text-gray-700",
  CLOSED: "bg-emerald-50 text-emerald-800",
  PRIORITY_CHANGED: "bg-red-50 text-red-700",
};

function summarizeMilestone(
  tickets: AuditReport["tickets"],
  pick: (ticket: AuditReport["tickets"][number]) => AuditMilestone | null,
) {
  let count = 0;
  let sumMs = 0;
  for (const ticket of tickets) {
    const milestone = pick(ticket);
    if (milestone) {
      count += 1;
      sumMs += milestone.elapsedMs;
    }
  }
  return {
    count,
    averageMs: count > 0 ? sumMs / count : null,
  };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function TraceabilityCharts({
  kpis,
  audit,
}: {
  kpis?: Kpis;
  audit?: AuditReport;
}) {
  const { t, language } = useI18n();

  const auditTickets = audit?.tickets ?? [];
  const statusTotal = STATUS_ORDER.reduce(
    (acc, status) => acc + (kpis?.byStatus?.[status] ?? 0),
    0,
  );
  const totalTickets =
    audit?.tickets.length ?? kpis?.total ?? statusTotal;

  const readStats = summarizeMilestone(auditTickets, (item) => item.firstRead);
  const startedStats = summarizeMilestone(
    auditTickets,
    (item) => item.firstStarted,
  );
  const resolvedStats = summarizeMilestone(
    auditTickets,
    (item) => item.firstResolved,
  );

  // Open tickets that still have no recorded firstRead
  const unviewedOpenCount = auditTickets.filter(
    (item) =>
      !["CLOSED", "CANCELLED"].includes(item.status) && item.firstRead === null,
  ).length;

  const slaCompliancePct = kpis?.slaCompliancePct ?? 100;
  const resolutionRatePct = kpis?.resolutionRatePct ?? 0;
  const dueSoonCount = kpis?.dueSoon ?? 0;
  const unassignedCount = kpis?.unassigned ?? 0;
  const criticalOpenCount = kpis?.criticalOpen ?? 0;

  const funnelStages = [
    {
      key: "created",
      step: "1",
      label: t("home.stageCreated"),
      count: totalTickets,
      percent: totalTickets > 0 ? 100 : 0,
      avgText: t("home.baseline"),
      barClass: "bg-navy",
      badgeClass: "bg-navy/10 text-navy",
    },
    {
      key: "read",
      step: "2",
      label: t("home.stageRead"),
      count: readStats.count,
      percent: pct(readStats.count, totalTickets),
      avgText:
        readStats.averageMs === null
          ? t("audit.missing")
          : formatDuration(readStats.averageMs, language),
      barClass: "bg-sky-500",
      badgeClass: "bg-sky-50 text-sky-800",
    },
    {
      key: "started",
      step: "3",
      label: t("home.stageStarted"),
      count: startedStats.count,
      percent: pct(startedStats.count, totalTickets),
      avgText:
        startedStats.averageMs === null
          ? t("audit.missing")
          : formatDuration(startedStats.averageMs, language),
      barClass: "bg-amber-500",
      badgeClass: "bg-amber-50 text-amber-800",
    },
    {
      key: "resolved",
      step: "4",
      label: t("home.stageResolved"),
      count: resolvedStats.count,
      percent: pct(resolvedStats.count, totalTickets),
      avgText:
        resolvedStats.averageMs === null
          ? t("audit.missing")
          : formatDuration(resolvedStats.averageMs, language),
      barClass: "bg-emerald-500",
      badgeClass: "bg-emerald-50 text-emerald-800",
    },
  ];

  // Priority Donut geometry
  const priorityTotal = PRIORITY_ORDER.reduce(
    (acc, priority) => acc + (kpis?.byPriority?.[priority] ?? 0),
    0,
  );
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let cumulativeArc = 0;
  const donutSegments = PRIORITY_ORDER.map((priority) => {
    const count = kpis?.byPriority?.[priority] ?? 0;
    const fraction = priorityTotal > 0 ? count / priorityTotal : 0;
    const arcLength = fraction * circumference;
    const offset = -cumulativeArc;
    cumulativeArc += arcLength;
    return {
      priority,
      count,
      percent: pct(count, priorityTotal),
      arcLength,
      offset,
      stroke: PRIORITY_STYLE[priority].stroke,
      barClass: PRIORITY_STYLE[priority].bar,
    };
  });

  const areas = kpis?.byArea ?? [];
  const maxAreaOpen = Math.max(1, ...areas.map((a) => a.open));
  const recentEvents = kpis?.recentEvents ?? [];

  return (
    <div className="space-y-6">
      {/* 1. Traceability Funnel & Average Milestone Times */}
      <section
        aria-label={t("home.traceabilityTitle")}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-navy">
              {t("home.traceabilityTitle")}
            </h2>
            <p className="mt-1 text-xs text-gray-2">
              {t("home.traceabilitySubtitle")}
            </p>
          </div>
          <Link
            href="/audit"
            className="text-xs font-semibold text-orange hover:underline"
          >
            {t("home.viewAudit")} →
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {funnelStages.map((stage) => (
            <div
              key={stage.key}
              className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-6 p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-navy shadow-xs">
                    {stage.step}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stage.badgeClass}`}
                  >
                    {stage.percent}% {t("home.coverage")}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-2">
                  {stage.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">
                  {stage.count}
                </p>
              </div>

              <div className="mt-4">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-gray-5"
                  role="progressbar"
                  aria-valuenow={stage.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={stage.label}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${stage.barClass}`}
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-gray-2">{t("home.avgTime")}</span>
                  <span className="font-semibold text-navy">
                    {stage.avgText}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Operational Health & Business Decision Support */}
      <section
        aria-label={t("home.opsTitle")}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div>
          <h2 className="text-base font-bold text-navy">
            {t("home.opsTitle")}
          </h2>
          <p className="mt-1 text-xs text-gray-2">{t("home.opsSubtitle")}</p>
        </div>

        {/* Operational KPI Strip */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-6 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-2">
                {t("home.slaHealth")}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  slaCompliancePct >= 90
                    ? "bg-emerald-50 text-emerald-800"
                    : slaCompliancePct >= 75
                      ? "bg-amber-50 text-amber-800"
                      : "bg-red-50 text-red-700"
                }`}
              >
                {t("home.resolutionRate")}: {resolutionRatePct}%
              </span>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-navy">
              {slaCompliancePct}%
            </p>
            <p className="mt-1 text-[11px] text-gray-3">
              {t("home.slaHealthHint")}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-6 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-2">
                {t("home.dueSoon")}
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  dueSoonCount > 0 ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-navy">
              {dueSoonCount}
            </p>
            <p className="mt-1 text-[11px] text-gray-3">
              {t("home.dueSoonHint")} · {t("home.criticalAlert")}:{" "}
              <strong className="text-navy">{criticalOpenCount}</strong>
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-6 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-2">
                {t("home.unassignedAlert")}
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  unassignedCount > 0 ? "bg-orange" : "bg-emerald-500"
                }`}
              />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-navy">
              {unassignedCount}
            </p>
            <p className="mt-1 text-[11px] text-gray-3">
              {t("home.unassignedHint")}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-6 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-2">
                {t("home.unviewedAlert")}
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  unviewedOpenCount > 0 ? "bg-sky-500" : "bg-emerald-500"
                }`}
              />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-navy">
              {unviewedOpenCount}
            </p>
            <p className="mt-1 text-[11px] text-gray-3">
              {t("home.unviewedHint")}
            </p>
          </div>
        </div>

        {/* Departmental Bottlenecks & Live Activity Feed */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* Departmental Bottlenecks Matrix */}
          <div className="min-w-0 rounded-xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-navy">
              {t("home.bottlenecksTitle")}
            </h3>
            {areas.length === 0 ? (
              <p className="mt-3 text-xs text-gray-3">{t("home.noAreaOpen")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-bold uppercase text-gray-3">
                      <th className="pb-2 pr-2">{t("home.colArea")}</th>
                      <th className="pb-2 px-2 text-right">
                        {t("home.colOpen")}
                      </th>
                      <th className="pb-2 px-2 text-right">
                        {t("home.colUnassigned")}
                      </th>
                      <th className="pb-2 px-2 text-right">
                        {t("home.colOverdue")}
                      </th>
                      <th className="pb-2 px-2 text-right">
                        {t("home.colCritical")}
                      </th>
                      <th className="pb-2 pl-2 text-right">
                        {t("home.colRisk")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {areas.map((area) => {
                      const widthPct = Math.round(
                        (area.open / maxAreaOpen) * 100,
                      );
                      const unassigned = area.unassigned ?? 0;
                      const overdue = area.overdue ?? 0;
                      const critical = area.critical ?? 0;
                      const isHighRisk =
                        overdue > 0 || unassigned >= 2 || critical >= 2;
                      const isWatch =
                        !isHighRisk && (unassigned > 0 || critical > 0);
                      return (
                        <tr key={area.areaId}>
                          <td className="py-2.5 pr-2">
                            <p className="font-semibold text-navy">
                              {area.name}
                            </p>
                            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-orange"
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right font-bold text-navy">
                            {area.open}
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold text-orange">
                            {unassigned}
                          </td>
                          <td
                            className={`px-2 py-2.5 text-right font-semibold ${
                              overdue > 0 ? "text-red-600" : "text-gray-3"
                            }`}
                          >
                            {overdue}
                          </td>
                          <td
                            className={`px-2 py-2.5 text-right font-semibold ${
                              critical > 0 ? "text-navy" : "text-gray-3"
                            }`}
                          >
                            {critical}
                          </td>
                          <td className="py-2.5 pl-2 text-right">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isHighRisk
                                  ? "bg-red-50 text-red-700"
                                  : isWatch
                                    ? "bg-amber-50 text-amber-800"
                                    : "bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {isHighRisk
                                ? t("home.riskHigh")
                                : isWatch
                                  ? t("home.riskWatch")
                                  : t("home.riskHealthy")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live Activity Event Stream */}
          <div className="flex flex-col rounded-xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-navy">
              {t("home.liveFeedTitle")}
            </h3>
            {recentEvents.length === 0 ? (
              <p className="mt-3 text-xs text-gray-3">
                {t("home.liveFeedEmpty")}
              </p>
            ) : (
              <ol className="mt-3 max-h-60 space-y-2.5 overflow-y-auto pr-1">
                {recentEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-lg bg-gray-6 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            EVENT_BADGE[ev.type] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ev.type}
                        </span>
                        <Link
                          href={`/tickets/${ev.ticket.id}`}
                          className="font-bold text-orange hover:underline"
                        >
                          {ev.ticket.number}
                        </Link>
                        <span className="text-gray-3">
                          · {ev.ticket.areaName}
                        </span>
                      </div>
                      <time
                        dateTime={ev.createdAt}
                        className="shrink-0 text-[10px] text-gray-3"
                      >
                        {new Date(ev.createdAt).toLocaleTimeString(language, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p className="mt-1 truncate text-gray-2">
                      <strong className="text-navy">{ev.actor.name}</strong>:{" "}
                      {ev.message}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* 3. Status Distribution & Priority Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status Distribution Chart */}
        <section
          aria-label={t("home.byStatus")}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy">
              {t("home.byStatus")}
            </h2>
            <span className="text-xs font-semibold text-gray-2">
              {t("home.totalTickets")}: {statusTotal}
            </span>
          </div>

          {/* Stacked multi-status bar */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {STATUS_ORDER.map((status) => {
              const count = kpis?.byStatus?.[status] ?? 0;
              if (count <= 0 || statusTotal <= 0) return null;
              const widthPct = (count / statusTotal) * 100;
              return (
                <div
                  key={status}
                  title={`${t(`status.${status}`)}: ${count}`}
                  className={`h-full transition-all duration-300 ${STATUS_COLOR[status].bar}`}
                  style={{ width: `${widthPct}%` }}
                />
              );
            })}
          </div>

          <ul className="mt-4 space-y-2.5">
            {STATUS_ORDER.map((status) => {
              const count = kpis?.byStatus?.[status] ?? 0;
              const percent = pct(count, statusTotal);
              return (
                <li key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-navy">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[status].dot}`}
                      />
                      {t(`status.${status}`)}
                    </span>
                    <span className="font-semibold text-navy">
                      {count}{" "}
                      <span className="font-normal text-gray-3">
                        ({percent}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${STATUS_COLOR[status].bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Priority Distribution Donut & Bars */}
        <section
          aria-label={t("home.byPriority")}
          className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy">
              {t("home.byPriority")}
            </h2>
            <span className="text-xs font-semibold text-gray-2">
              {t("home.totalTickets")}: {priorityTotal}
            </span>
          </div>

          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            {/* SVG Donut */}
            <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
              <svg
                viewBox="0 0 120 120"
                className="h-full w-full -rotate-90"
                role="img"
                aria-label={t("home.byPriority")}
              >
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#e5e7eb"
                  strokeWidth="14"
                />
                {donutSegments.map((seg) =>
                  seg.count > 0 ? (
                    <circle
                      key={seg.priority}
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="transparent"
                      stroke={seg.stroke}
                      strokeWidth="14"
                      strokeDasharray={`${seg.arcLength} ${circumference}`}
                      strokeDashoffset={seg.offset}
                    />
                  ) : null,
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-navy">
                  {priorityTotal}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-3">
                  Tickets
                </span>
              </div>
            </div>

            {/* Priority legend & bars */}
            <ul className="w-full flex-1 space-y-3">
              {donutSegments.map((seg) => (
                <li key={seg.priority} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-navy">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${seg.barClass}`}
                      />
                      {t(`priority.${seg.priority}`)}
                    </span>
                    <span className="font-semibold text-navy">
                      {seg.count}{" "}
                      <span className="font-normal text-gray-3">
                        ({seg.percent}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${seg.barClass}`}
                      style={{ width: `${seg.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
