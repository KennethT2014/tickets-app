"use client";

import Link from "next/link";
import { useI18n } from "../app/providers";
import type { Ticket, TicketStatus } from "../lib/types";
import { PriorityLabel } from "./StatusBadge";

const columns: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
];

export function TicketKanban({ tickets }: { tickets: Ticket[] }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 overflow-x-auto pb-4 md:grid-cols-5">
      {columns.map((status) => {
        const items = tickets.filter((ticket) => ticket.status === status);
        return (
          <section key={status} className="min-w-[220px] rounded-xl bg-white p-3 shadow-sm">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {t(`status.${status}`)} · {items.length}
            </h3>
            <div className="flex flex-col gap-2">
              {items.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="rounded-lg border border-gray-200 p-3 hover:border-orange"
                >
                  <p className="text-xs font-semibold text-orange">{ticket.number}</p>
                  <p className="mt-1 text-sm font-medium text-navy">{ticket.title}</p>
                  <p className="mt-1 text-xs text-gray-3">{ticket.area.name}</p>
                  <PriorityLabel priority={ticket.priority} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
