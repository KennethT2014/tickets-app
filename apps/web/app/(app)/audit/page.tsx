"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { StatusBadge } from "../../../components/StatusBadge";
import { api } from "../../../lib/api";
import { formatDuration } from "../../../lib/i18n";
import type { AuditMilestone, AuditReport } from "../../../lib/types";
import { useI18n } from "../../providers";

function Milestone({ value }: { value: AuditMilestone | null }) {
  const { t, language } = useI18n();
  if (!value)
    return <span className="text-gray-500">{t("audit.missing")}</span>;
  return (
    <div className="space-y-1">
      <p className="font-semibold text-navy">
        {formatDuration(value.elapsedMs, language)}
      </p>
      <p title={value.actor.email}>{value.actor.name}</p>
      <time dateTime={value.at} className="block text-xs text-gray-500">
        {new Date(value.at).toLocaleString(language)}
      </time>
    </div>
  );
}

export default function AuditPage() {
  const { t, language } = useI18n();
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<AuditReport>("/tickets/audit"),
  });
  const columns = ["read", "started", "resolved"] as const;
  const th =
    "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500";
  const td = "px-4 py-4 align-top text-sm text-gray-600";

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-navy">{t("audit.title")}</h1>
          <p className="mt-2 text-sm text-gray-600">{t("audit.description")}</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isFetching ? t("common.loading") : t("audit.refresh")}
        </button>
      </header>
      {isPending && <p role="status">{t("common.loading")}</p>}
      {isError && (
        <p
          role="alert"
          className="rounded-lg border border-orange bg-white p-4"
        >
          {t("common.error")}
        </p>
      )}
      {data && data.tickets.length === 0 && (
        <p className="rounded-xl bg-white p-6 text-gray-500">
          {t("audit.empty")}
        </p>
      )}
      {data && data.tickets.length > 0 && (
        <>
          <section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-4">
              <h2 className="font-bold text-navy">{t("audit.people")}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("audit.averageNote")}
              </p>
            </div>
            {data.people.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-gray-500">
                {t("audit.noPeople")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[640px]"
                  aria-label={t("audit.people")}
                >
                  <thead className="border-y border-gray-200 bg-gray-50">
                    <tr>
                      <th scope="col" className={th}>
                        {t("audit.person")}
                      </th>
                      {columns.map((key) => (
                        <th scope="col" className={th} key={key}>
                          {t(`audit.${key}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.people.map((person) => (
                      <tr key={person.actor.id}>
                        <th
                          scope="row"
                          className={`${td} text-left font-normal`}
                        >
                          <p className="font-semibold text-navy">
                            {person.actor.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {person.actor.email}
                          </p>
                        </th>
                        {columns.map((key) => (
                          <td key={key} className={td}>
                            <p className="font-semibold text-navy">
                              {person[key].averageMs === null
                                ? t("audit.missing")
                                : formatDuration(person[key].averageMs, language)}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {person[key].count} {t("audit.samples")}
                            </p>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm">
            <h2 className="p-4 font-bold text-navy">
              {t("audit.tickets")} ({data.tickets.length})
            </h2>
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[800px]"
                aria-label={t("audit.tickets")}
              >
                <thead className="border-y border-gray-200 bg-gray-50">
                  <tr>
                    <th scope="col" className={th}>
                      {t("audit.ticket")}
                    </th>
                    {columns.map((key) => (
                      <th scope="col" className={th} key={key}>
                        {t(`audit.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <th
                        scope="row"
                        className={`${td} max-w-72 text-left font-normal`}
                      >
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="font-semibold text-orange hover:underline"
                        >
                          {ticket.number} · {ticket.title}
                        </Link>
                        <p className="my-1 text-xs text-gray-500">
                          {ticket.area.name} ·{" "}
                          <time dateTime={ticket.createdAt}>
                            {new Date(ticket.createdAt).toLocaleString(
                              language,
                            )}
                          </time>
                        </p>
                        <StatusBadge status={ticket.status} />
                      </th>
                      <td className={td}>
                        <Milestone value={ticket.firstRead} />
                      </td>
                      <td className={td}>
                        <Milestone value={ticket.firstStarted} />
                      </td>
                      <td className={td}>
                        <Milestone value={ticket.firstResolved} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="max-w-4xl text-sm text-gray-500">
        {t("audit.historyNote")}
      </p>
    </div>
  );
}
