"use client";

import Link from "next/link";
import { useI18n } from "../app/providers";
import type { Ticket } from "../lib/types";
import { PriorityLabel, StatusBadge } from "./StatusBadge";

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const { t } = useI18n();
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-3">
        {t("tickets.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-6 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t("tickets.subject")}</th>
            <th className="px-4 py-3">{t("tickets.area")}</th>
            <th className="px-4 py-3">{t("tickets.status")}</th>
            <th className="px-4 py-3">{t("tickets.priority")}</th>
            <th className="px-4 py-3">{t("tickets.assign")}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-t border-gray-100 hover:bg-gray-6">
              <td className="px-4 py-3 font-semibold text-orange">
                <Link href={`/tickets/${ticket.id}`}>{ticket.number}</Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/tickets/${ticket.id}`} className="font-medium text-navy">
                  {ticket.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-2">{ticket.area.name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3">
                <PriorityLabel priority={ticket.priority} />
              </td>
              <td className="px-4 py-3 text-gray-2">
                {ticket.assignee?.name ?? t("tickets.unassigned")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
