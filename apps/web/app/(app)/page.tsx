"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { TicketTable } from "../../components/TicketTable";
import { TraceabilityCharts } from "../../components/TraceabilityCharts";
import { api } from "../../lib/api";
import type { AuditReport, Kpis, Ticket } from "../../lib/types";
import { useI18n } from "../providers";

const LIVE_INTERVAL_MS = 5000;

export default function HomePage() {
  const { t, language } = useI18n();
  const [isLive, setIsLive] = useState(true);

  const refetchInterval = isLive ? LIVE_INTERVAL_MS : false;

  const kpisQuery = useQuery({
    queryKey: ["kpis"],
    queryFn: () => api<Kpis>("/tickets/kpis"),
    refetchInterval,
    refetchOnWindowFocus: true,
  });
  const auditQuery = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<AuditReport>("/tickets/audit"),
    refetchInterval,
    refetchOnWindowFocus: true,
  });
  const ticketsQuery = useQuery({
    queryKey: ["tickets", "mine"],
    queryFn: () => api<Ticket[]>("/tickets?mine=true"),
    refetchInterval,
    refetchOnWindowFocus: true,
  });

  const kpis = kpisQuery.data;
  const audit = auditQuery.data;
  const tickets = ticketsQuery.data ?? [];
  const isSyncing =
    kpisQuery.isFetching || auditQuery.isFetching || ticketsQuery.isFetching;

  const lastUpdatedMs = Math.max(
    kpisQuery.dataUpdatedAt,
    auditQuery.dataUpdatedAt,
    ticketsQuery.dataUpdatedAt,
  );

  const handleManualSync = () => {
    void Promise.all([
      kpisQuery.refetch(),
      auditQuery.refetch(),
      ticketsQuery.refetch(),
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t("home.title")}</h1>
          {lastUpdatedMs > 0 && (
            <p className="mt-0.5 text-xs text-gray-3">
              {t("home.lastUpdated")}:{" "}
              <time dateTime={new Date(lastUpdatedMs).toISOString()}>
                {new Date(lastUpdatedMs).toLocaleTimeString(language, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLive((prev) => !prev)}
            aria-pressed={isLive}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              isLive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-gray-200 bg-white text-gray-2"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? "animate-pulse bg-emerald-500" : "bg-gray-400"
              }`}
            />
            {isLive ? t("home.liveActive") : t("home.livePaused")}
          </button>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-navy hover:bg-gray-6 disabled:opacity-50"
          >
            {isSyncing ? t("home.syncing") : t("home.syncNow")}
          </button>

          <Link
            href="/tickets/new"
            className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
          >
            {t("home.new")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label={t("home.open")} value={kpis?.open ?? 0} />
        <KpiCard label={t("home.overdue")} value={kpis?.overdue ?? 0} />
        <KpiCard label={t("home.mine")} value={kpis?.mine ?? 0} />
      </div>

      <TraceabilityCharts kpis={kpis} audit={audit} />

      <TicketTable tickets={tickets.slice(0, 8)} />
    </div>
  );
}
