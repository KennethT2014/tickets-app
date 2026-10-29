"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "../app/providers";
import { api } from "../lib/api";
import { canOverseeAllTickets } from "../lib/roles";
import type { AuthProfile, Ticket, TicketStatus } from "../lib/types";
import { PriorityLabel, StatusBadge, statusClass } from "./StatusBadge";

const STATUSES: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

function canMoveTicket(
  user: AuthProfile,
  ticket: Ticket,
  next: TicketStatus,
): boolean {
  if (canOverseeAllTickets(user.globalRole)) return true;
  const isLead = user.leadAreaIds.includes(ticket.areaId);
  const membership = user.memberships.find(
    (item) => item.areaId === ticket.areaId,
  );
  if (next === "CLOSED" || next === "CANCELLED") {
    return isLead || membership?.canClose === true;
  }
  return (
    ticket.assigneeId === user.id || isLead || membership?.canAssign === true
  );
}

function canChangeAnyStatus(user: AuthProfile | undefined, ticket: Ticket) {
  if (!user) return false;
  return STATUSES.some(
    (status) => status !== ticket.status && canMoveTicket(user, ticket, status),
  );
}

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3500);
    return () => window.clearTimeout(timer);
  }, [error]);

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      api(`/tickets/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tickets"] });
      const previous = queryClient.getQueriesData<Ticket[]>({
        queryKey: ["tickets"],
      });
      queryClient.setQueriesData<Ticket[]>(
        { queryKey: ["tickets"] },
        (current) =>
          current?.map((ticket) =>
            ticket.id === id ? { ...ticket, status } : ticket,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      setError(t("tickets.moveFailed"));
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-3">
        {t("tickets.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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
            {tickets.map((ticket) => {
              const editable = canChangeAnyStatus(user, ticket);
              const isUpdatingThis =
                changeStatus.isPending &&
                changeStatus.variables?.id === ticket.id;

              return (
                <tr
                  key={ticket.id}
                  className="border-t border-gray-100 hover:bg-gray-6"
                >
                  <td className="px-4 py-3 font-semibold text-orange">
                    <Link href={`/tickets/${ticket.id}`}>{ticket.number}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-medium text-navy"
                    >
                      {ticket.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-2">{ticket.area.name}</td>
                  <td className="px-4 py-3">
                    {editable && user ? (
                      <select
                        aria-label={`${t("tickets.status")} ${ticket.number}`}
                        value={ticket.status}
                        disabled={isUpdatingThis}
                        onChange={(event) => {
                          const next = event.target.value as TicketStatus;
                          if (next === ticket.status) return;
                          if (!canMoveTicket(user, ticket, next)) {
                            setError(t("tickets.moveFailed"));
                            return;
                          }
                          changeStatus.mutate({ id: ticket.id, status: next });
                        }}
                        className={`cursor-pointer rounded-full border border-black/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition focus:ring-2 focus:ring-orange focus:outline-none disabled:opacity-50 ${statusClass[ticket.status]}`}
                      >
                        {STATUSES.map((status) => (
                          <option
                            key={status}
                            value={status}
                            disabled={
                              status !== ticket.status &&
                              !canMoveTicket(user, ticket, status)
                            }
                            className="bg-white font-semibold text-navy"
                          >
                            {t(`status.${status}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={ticket.status} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityLabel priority={ticket.priority} />
                  </td>
                  <td className="px-4 py-3 text-gray-2">
                    {ticket.assignee?.name ?? t("tickets.unassigned")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
