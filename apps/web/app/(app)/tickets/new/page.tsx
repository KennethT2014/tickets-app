"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "../../../../lib/api";
import { flattenAreas } from "../../../../lib/org-layout";
import type { AreaNode, Ticket, TicketPriority } from "../../../../lib/types";
import { useI18n } from "../../../providers";

const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function NewTicketPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: forest = [] } = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });
  const areas = useMemo(
    () => flattenAreas(forest).filter((area) => area.parentId !== null),
    [forest],
  );
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Ticket>("/tickets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (ticket) => router.push(`/tickets/${ticket.id}`),
  });

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold text-navy">{t("tickets.createTitle")}</h1>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate({
            title: form.get("title"),
            body: form.get("body"),
            areaId: form.get("areaId"),
            priority: form.get("priority"),
            category: form.get("category") || undefined,
          });
        }}
      >
        <input
          name="title"
          required
          placeholder={t("tickets.subject")}
          className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3"
        />
        <textarea
          name="body"
          required
          rows={6}
          placeholder={t("tickets.description")}
          className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3"
        />
        <select
          name="areaId"
          required
          className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3"
        >
          <option value="">{t("tickets.area")}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        <select name="priority" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3">
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {t(`priority.${priority}`)}
            </option>
          ))}
        </select>
        <input
          name="category"
          placeholder={t("tickets.category")}
          className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3"
        />
        {create.isError && (
          <p className="text-sm text-red-600">{(create.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-orange px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {t("tickets.submit")}
        </button>
      </form>
    </div>
  );
}
