"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TicketKanban } from "../../../components/TicketKanban";
import { TicketTable } from "../../../components/TicketTable";
import { api } from "../../../lib/api";
import type { AreaNode, Ticket, TicketStatus } from "../../../lib/types";
import { flattenAreas } from "../../../lib/org-layout";
import { useI18n } from "../../providers";

const statuses: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export default function TicketsPage() {
  const { t } = useI18n();
  const [view, setView] = useState<"list" | "board">("list");
  const [status, setStatus] = useState("");
  const [areaId, setAreaId] = useState("");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (areaId) params.set("areaId", areaId);
  if (q) params.set("q", q);
  if (mine) params.set("mine", "true");

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", status, areaId, q, mine],
    queryFn: () => api<Ticket[]>(`/tickets?${params.toString()}`),
  });
  const { data: forest = [] } = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });
  const areas = useMemo(() => flattenAreas(forest), [forest]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">{t("tickets.title")}</h1>
        <Link
          href="/tickets/new"
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
        >
          {t("tickets.new")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("tickets.search")}
          className="rounded-lg border border-gray-5 bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-gray-5 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t("tickets.all")}</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {t(`status.${item}`)}
            </option>
          ))}
        </select>
        <select
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
          className="rounded-lg border border-gray-5 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t("tickets.area")}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => setMine(event.target.checked)}
          />
          {t("tickets.mine")}
        </label>
        <div className="ml-auto flex rounded-lg bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1 text-sm ${view === "list" ? "bg-navy text-white" : "text-navy"}`}
          >
            {t("tickets.list")}
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            className={`rounded-md px-3 py-1 text-sm ${view === "board" ? "bg-navy text-white" : "text-navy"}`}
          >
            {t("tickets.board")}
          </button>
        </div>
      </div>
      {view === "list" ? <TicketTable tickets={tickets} /> : <TicketKanban tickets={tickets} />}
    </div>
  );
}
