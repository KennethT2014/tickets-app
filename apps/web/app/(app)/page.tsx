"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { KpiCard } from "../../components/KpiCard";
import { TicketTable } from "../../components/TicketTable";
import { api } from "../../lib/api";
import type { Kpis, Ticket } from "../../lib/types";
import { useI18n } from "../providers";

export default function HomePage() {
  const { t } = useI18n();
  const { data: kpis } = useQuery({
    queryKey: ["kpis"],
    queryFn: () => api<Kpis>("/tickets/kpis"),
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", "mine"],
    queryFn: () => api<Ticket[]>("/tickets?mine=true"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{t("home.title")}</h1>
        <Link
          href="/tickets/new"
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
        >
          {t("home.new")}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label={t("home.open")} value={kpis?.open ?? 0} />
        <KpiCard label={t("home.overdue")} value={kpis?.overdue ?? 0} />
        <KpiCard label={t("home.mine")} value={kpis?.mine ?? 0} />
      </div>
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">{t("home.byArea")}</h2>
        <ul className="space-y-2">
          {(kpis?.byArea ?? []).map((area) => (
            <li key={area.areaId} className="flex justify-between text-sm">
              <span>{area.name}</span>
              <span className="font-semibold text-orange">{area.open}</span>
            </li>
          ))}
        </ul>
      </section>
      <TicketTable tickets={tickets.slice(0, 8)} />
    </div>
  );
}
