"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PriorityLabel, StatusBadge } from "../../../../components/StatusBadge";
import { api } from "../../../../lib/api";
import type { PublicUser, TicketDetail, TicketStatus } from "../../../../lib/types";
import { useI18n } from "../../../providers";

const statuses: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export default function TicketDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", params.id],
    queryFn: () => api<TicketDetail>(`/tickets/${params.id}`),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ticket", params.id] });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    queryClient.invalidateQueries({ queryKey: ["kpis"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const assign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api(`/tickets/${params.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeId }),
      }),
    onSuccess: invalidate,
  });
  const changeStatus = useMutation({
    mutationFn: (status: TicketStatus) =>
      api(`/tickets/${params.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  });
  const comment = useMutation({
    mutationFn: (body: string) =>
      api(`/tickets/${params.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: invalidate,
  });

  if (isLoading || !ticket) {
    return <p className="text-gray-3">{t("common.loading")}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange">{ticket.number}</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">{ticket.title}</h1>
          <div className="mt-3 flex flex-wrap gap-3">
            <StatusBadge status={ticket.status} />
            <PriorityLabel priority={ticket.priority} />
            <span className="text-sm text-gray-2">{ticket.area.name}</span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm text-gray-2">{ticket.body}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-navy">{t("tickets.comment")}</h2>
          <ul className="space-y-3">
            {ticket.comments.map((item) => (
              <li key={item.id} className="rounded-lg bg-gray-6 p-3 text-sm">
                <p className="font-semibold text-navy">{item.author.name}</p>
                <p className="mt-1 text-gray-2">{item.body}</p>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const body = String(new FormData(form).get("body") ?? "");
              if (body.trim()) comment.mutate(body);
              form.reset();
            }}
          >
            <input
              name="body"
              className="flex-1 rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-sm"
              placeholder={t("tickets.comment")}
            />
            <button type="submit" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">
              {t("tickets.send")}
            </button>
          </form>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-navy">{t("tickets.activity")}</h2>
          <ol className="space-y-2 text-sm text-gray-2">
            {ticket.events.map((event) => (
              <li key={event.id}>
                <span className="font-medium text-navy">{event.actor.name}</span> · {event.message}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {t("tickets.assign")}
          </p>
          {ticket.permissions.canAssign ? (
            <select
              className="mt-2 w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-sm"
              value={ticket.assigneeId ?? ""}
              onChange={(event) => assign.mutate(event.target.value || null)}
            >
              <option value="">{t("tickets.unassigned")}</option>
              {users.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2 text-sm">{ticket.assignee?.name ?? t("tickets.unassigned")}</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {t("tickets.status")}
          </p>
          <select
            className="mt-2 w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-sm"
            value={ticket.status}
            onChange={(event) => changeStatus.mutate(event.target.value as TicketStatus)}
          >
            {statuses.map((status) => (
              <option
                key={status}
                value={status}
                disabled={
                  (status === "CLOSED" || status === "CANCELLED") &&
                  !ticket.permissions.canClose
                }
              >
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
          {ticket.permissions.canClose && ticket.status !== "CLOSED" && (
            <button
              type="button"
              onClick={() => changeStatus.mutate("CLOSED")}
              className="mt-3 w-full rounded-lg bg-orange py-2 text-sm font-semibold text-white"
            >
              {t("tickets.close")}
            </button>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p>
            <span className="text-gray-3">Requester:</span> {ticket.requester.name}
          </p>
        </div>
      </aside>
    </div>
  );
}
