"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [view, setView] = useState<"list" | "board">("board");
  const [status, setStatus] = useState("");
  const [areaId, setAreaId] = useState("");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cw_tickets_view");
    if (stored === "list" || stored === "board") setView(stored);
  }, []);

  const params = new URLSearchParams();
  if (view === "list" && status) params.set("status", status);
  if (areaId) params.set("areaId", areaId);
  if (q) params.set("q", q);
  if (mine) params.set("mine", "true");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", view, status, areaId, q, mine],
    queryFn: () => api<Ticket[]>(`/tickets?${params.toString()}`),
  });
  const { data: forest = [] } = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });
  const areas = useMemo(() => flattenAreas(forest), [forest]);

  const changeView = (next: "list" | "board") => {
    setView(next);
    localStorage.setItem("cw_tickets_view", next);
    if (next === "board") setStatus("");
  };

  return (
    <div
      className={
        view === "board"
          ? "flex h-full min-h-0 flex-col gap-3"
          : "space-y-4"
      }
    >
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-bold text-navy">{t("tickets.title")}</h1>
          <div className="flex h-10 rounded-lg bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => changeView("list")}
              className={`rounded-md px-3 text-sm ${view === "list" ? "bg-navy text-white" : "text-navy"}`}
            >
              {t("tickets.list")}
            </button>
            <button
              type="button"
              onClick={() => changeView("board")}
              className={`rounded-md px-3 text-sm ${view === "board" ? "bg-navy text-white" : "text-navy"}`}
            >
              {t("tickets.board")}
            </button>
          </div>
          <Link
            href="/tickets/new"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-orange px-4 text-sm font-semibold text-white hover:bg-orange-hover"
          >
            {t("tickets.new")}
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("tickets.search")}
            className="h-10 w-full min-w-[200px] rounded-lg border border-gray-5 bg-white px-3 text-sm sm:max-w-xs"
          />
          {view === "list" ? (
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-lg border border-gray-5 bg-white px-3 text-sm"
            >
              <option value="">{t("tickets.all")}</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {t(`status.${item}`)}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            className="h-10 rounded-lg border border-gray-5 bg-white px-3 text-sm"
          >
            <option value="">{t("tickets.area")}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => setMine(event.target.checked)}
            />
            {t("tickets.mine")}
          </label>
        </div>
      </div>
      {view === "board" ? (
        <p className="text-xs text-gray-3 md:hidden">{t("tickets.holdToMove")}</p>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-gray-3">{t("common.loading")}</p>
      ) : view === "list" ? (
        <TicketTable tickets={tickets} />
      ) : (
        <TicketKanban tickets={tickets} />
      )}
    </div>
  );
}
