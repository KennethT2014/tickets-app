"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "../../../components/StatusBadge";
import { api } from "../../../lib/api";
import { formatDuration } from "../../../lib/i18n";
import { isAdmin as hasAdminRole } from "../../../lib/roles";
import type {
  AuditIntegrityResponse,
  AuditLogsResponse,
  AuditMilestone,
  AuditReport,
  AuthProfile,
} from "../../../lib/types";
import { useI18n } from "../../providers";

function Milestone({ value }: { value: AuditMilestone | null }) {
  const { t, language } = useI18n();
  const tr = (en: string, es: string) => (language === "es" ? es : en);
  const [take, setTake] = useState(25);
  const [skip, setSkip] = useState(0);
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
  const tr = (en: string, es: string) => (language === "es" ? es : en);
  const [take, setTake] = useState(25);
  const [skip, setSkip] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "performance" | "logs" | "security" | "integrity"
  >("performance");

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });

  const isAdmin = user ? hasAdminRole(user.globalRole) : false;

  // Tab 1: Performance milestones
  const {
    data: perfData,
    isPending: isPerfPending,
    isError: isPerfError,
    refetch: refetchPerf,
  } = useQuery({
    queryKey: ["audit", "performance"],
    queryFn: () => api<AuditReport>("/tickets/audit"),
    enabled: activeTab === "performance",
  });

  // Tab 2 & 3: Logs / Security
  const {
    data: logsData,
    isPending: isLogsPending,
    isFetching: isLogsFetching,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["audit", "logs", activeTab, take, skip],
    queryFn: () =>
      api<AuditLogsResponse>(
        `/audit/logs?category=${activeTab === "security" ? "security" : "all"}&take=${take}&skip=${skip}`,
      ),
    enabled: activeTab === "logs" || activeTab === "security",
  });

  // Tab 4: Integrity
  const verifyMutation = useMutation({
    mutationFn: () => api<AuditIntegrityResponse>("/audit/integrity"),
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
        <div className="flex gap-2">
          <button
            type="button"
            disabled={
              activeTab === "integrity"
                ? verifyMutation.isPending
                : activeTab === "performance"
                  ? isPerfPending
                  : isLogsFetching
            }
            onClick={() => {
              if (activeTab === "performance") refetchPerf();
              else if (activeTab === "integrity") verifyMutation.mutate();
              else refetchLogs();
            }}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            {t("audit.refresh")}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setSkip(0);
            setActiveTab("performance");
          }}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "performance"
              ? "border-orange text-navy"
              : "border-transparent text-gray-500 hover:text-navy"
          }`}
        >
          {t("audit.tabPerformance")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSkip(0);
            setActiveTab("logs");
          }}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "logs"
              ? "border-orange text-navy"
              : "border-transparent text-gray-500 hover:text-navy"
          }`}
        >
          {t("audit.tabLogs")}
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => {
                setSkip(0);
                setActiveTab("security");
              }}
              className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "security"
                  ? "border-orange text-navy"
                  : "border-transparent text-gray-500 hover:text-navy"
              }`}
            >
              {t("audit.tabSecurity")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSkip(0);
                setActiveTab("integrity");
              }}
              className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "integrity"
                  ? "border-orange text-navy"
                  : "border-transparent text-gray-500 hover:text-navy"
              }`}
            >
              {t("audit.tabIntegrity")}
            </button>
          </>
        )}
      </div>

      {/* TAB 1: Performance */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {isPerfPending && <p role="status">{t("common.loading")}</p>}
          {isPerfError && (
            <p
              role="alert"
              className="rounded-lg border border-orange bg-white p-4"
            >
              {t("common.error")}
            </p>
          )}
          {perfData && perfData.tickets.length === 0 && (
            <p className="rounded-xl bg-white p-6 text-gray-500">
              {t("audit.empty")}
            </p>
          )}
          {perfData && perfData.tickets.length > 0 && (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-navy">
                  {t("audit.people")}
                </h2>
                <p className="text-xs text-gray-500">
                  {t("audit.averageNote")}
                </p>
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full min-w-[36rem] text-left">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className={th}>{t("audit.person")}</th>
                        <th className={th}>{t("audit.read")}</th>
                        <th className={th}>{t("audit.started")}</th>
                        <th className={th}>{t("audit.resolved")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {perfData.people.map((person) => (
                        <tr key={person.actor.id}>
                          <td className={td}>
                            <p className="font-semibold text-navy">
                              {person.actor.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {person.actor.email}
                            </p>
                          </td>
                          {columns.map((col) => {
                            const val = person[col];
                            return (
                              <td key={col} className={td}>
                                {val.count === 0 || val.averageMs === null ? (
                                  <span className="text-gray-400">—</span>
                                ) : (
                                  <>
                                    <p className="font-semibold text-navy">
                                      {formatDuration(val.averageMs, language)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {val.count} {t("audit.samples")}
                                    </p>
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-navy">
                  {t("audit.tickets")}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full min-w-[48rem] text-left">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className={th}>{t("audit.ticket")}</th>
                        <th className={th}>{t("tickets.area")}</th>
                        <th className={th}>{t("tickets.status")}</th>
                        <th className={th}>{t("audit.read")}</th>
                        <th className={th}>{t("audit.started")}</th>
                        <th className={th}>{t("audit.resolved")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {perfData.tickets.map((item) => (
                        <tr key={item.id}>
                          <td className={td}>
                            <Link
                              href={`/tickets/${item.id}`}
                              className="font-semibold text-orange hover:underline"
                            >
                              {item.number}
                            </Link>
                            <p className="text-navy">{item.title}</p>
                          </td>
                          <td className={td}>{item.area.name}</td>
                          <td className={td}>
                            <StatusBadge status={item.status} />
                          </td>
                          <td className={td}>
                            <Milestone value={item.firstRead} />
                          </td>
                          <td className={td}>
                            <Milestone value={item.firstStarted} />
                          </td>
                          <td className={td}>
                            <Milestone value={item.firstResolved} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* TAB 2 & 3: Audit Logs & Security */}
      {(activeTab === "logs" || activeTab === "security") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">
              {activeTab === "security"
                ? t("audit.tabSecurity")
                : t("audit.tabLogs")}
            </h2>
            {logsData && (
              <span className="text-xs text-gray-500">
                {logsData.total} {t("audit.totalLogs")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label>
              {tr("Page size", "Tamaño de página")}{" "}
              <select
                aria-label={tr("Page size", "Tamaño de página")}
                value={take}
                onChange={(event) => {
                  setTake(Number(event.target.value));
                  setSkip(0);
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={skip === 0 || isLogsFetching}
              onClick={() => setSkip(Math.max(0, skip - take))}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              {tr("Previous", "Anterior")}
            </button>
            <span>
              {tr("Offset", "Desplazamiento")}: {skip}
            </span>
            <button
              disabled={
                !logsData || skip + take >= logsData.total || isLogsFetching
              }
              onClick={() => setSkip(skip + take)}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              {tr("Next", "Siguiente")}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {tr(
              "Viewing logs creates an audit event; new events can shift pages.",
              "Consultar registros genera un evento de auditoría; los eventos nuevos pueden desplazar las páginas.",
            )}
          </p>
          {logsError && (
            <p role="alert" className="text-red-700">
              {logsError.message}
              <button onClick={() => refetchLogs()} className="ml-3 underline">
                {t("audit.retry")}
              </button>
            </p>
          )}
          {logsData?.logs.length === 0 && (
            <p>{tr("No matching events.", "No hay eventos coincidentes.")}</p>
          )}
          {isLogsPending && <p role="status">{t("common.loading")}</p>}
          {logsData && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[56rem] text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className={th}>{t("audit.seq")}</th>
                    <th className={th}>{t("audit.timestamp")}</th>
                    <th className={th}>{t("audit.action")}</th>
                    <th className={th}>{t("audit.actor")}</th>
                    <th className={th}>{t("audit.entity")}</th>
                    <th className={th}>{t("audit.result")}</th>
                    <th className={th}>{t("audit.details")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logsData.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">
                        #{log.seq}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.occurredAt).toLocaleString(language)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-navy">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.actorId ? (
                          <span>
                            {log.actorId}{" "}
                            <span className="text-[10px] text-gray-400">
                              ({log.actorRole})
                            </span>
                          </span>
                        ) : (
                          <span className="italic text-gray-400">SYSTEM</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.entityType}{" "}
                        {log.entityId ? `[${log.entityId}]` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 font-bold ${
                            log.result === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700"
                              : log.result === "DENIED"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {log.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-sm">
                        <details>
                          <summary className="cursor-pointer text-orange">
                            {t("audit.details")}
                          </summary>
                          <dl className="space-y-2 pt-2">
                            {Object.entries({
                              before: log.before,
                              after: log.after,
                              reason: log.reason,
                              actorRank: log.actorRank,
                              areaId: log.areaId,
                              areaPath: log.areaPath,
                              ip: log.ip,
                              userAgent: log.userAgent,
                              requestId: log.requestId,
                              prevHash: log.prevHash,
                              hash: log.hash,
                            }).map(([key, value]) => (
                              <div key={key}>
                                <dt className="font-semibold">{key}</dt>
                                <dd className="whitespace-pre-wrap break-all font-mono">
                                  {value ?? "—"}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: Cryptographic Integrity Verification */}
      {activeTab === "integrity" && isAdmin && (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {t("audit.tabIntegrity")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {tr(
                "Checks the stored SHA-256 chain for detectable inconsistencies. This does not replace independent backups or protect against database administrators rewriting the entire chain.",
                "Comprueba la cadena SHA-256 almacenada para detectar inconsistencias. No sustituye respaldos independientes ni impide que un administrador de base de datos reescriba la cadena completa.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {verifyMutation.isPending
              ? t("audit.verifying")
              : t("audit.verifyButton")}
          </button>

          {verifyMutation.error && (
            <p role="alert" className="text-red-700">
              {verifyMutation.error.message}
            </p>
          )}
          {verifyMutation.data && (
            <div
              className={`rounded-lg p-4 text-sm font-medium ${
                verifyMutation.data.valid
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border border-red-300 bg-red-50 text-red-800"
              }`}
            >
              {verifyMutation.data.valid ? (
                <p>
                  ✅ {t("audit.integrityValid")} (
                  {verifyMutation.data.totalChecked}{" "}
                  {tr("records verified", "registros verificados")})
                </p>
              ) : (
                <p>
                  ❌ {verifyMutation.data.error ?? t("audit.integrityBroken")}{" "}
                  {verifyMutation.data.brokenSeq}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
