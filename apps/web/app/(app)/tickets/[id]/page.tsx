"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PriorityLabel, StatusBadge } from "../../../../components/StatusBadge";
import { api } from "../../../../lib/api";
import type {
  AreaNode,
  AuthProfile,
  PublicUser,
  QuickReplyItem,
  TicketDetail,
  TicketStatus,
} from "../../../../lib/types";
import { useI18n } from "../../../providers";

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING", "RESOLVED", "CANCELLED"],
  WAITING: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["IN_PROGRESS"],
  CANCELLED: [],
};

export default function TicketDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [commentVisibility, setCommentVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [commentText, setCommentText] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkType, setLinkType] = useState<"RELATED" | "PARENT_OF" | "DUPLICATE_OF">("RELATED");
  const [transferAreaId, setTransferAreaId] = useState("");

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", params.id],
    queryFn: () => api<TicketDetail>(`/tickets/${params.id}`),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });

  const { data: orgTree = [] } = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });

  const { data: quickReplies = [] } = useQuery({
    queryKey: ["quickReplies", ticket?.areaId],
    queryFn: () => api<QuickReplyItem[]>(`/org/areas/${ticket?.areaId}/quick-replies`),
    enabled: !!ticket?.areaId,
  });

  const { mutate: recordRead, isError: readFailed } = useMutation({
    mutationFn: (id: string) => api(`/tickets/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit"] }),
  });

  const displayedId = ticket?.id;
  useEffect(() => {
    if (!displayedId) return;
    const recordWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      recordRead(displayedId);
      document.removeEventListener("visibilitychange", recordWhenVisible);
    };
    recordWhenVisible();
    if (document.visibilityState !== "visible") {
      document.addEventListener("visibilitychange", recordWhenVisible);
    }
    return () =>
      document.removeEventListener("visibilitychange", recordWhenVisible);
  }, [displayedId, recordRead]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ticket", params.id] });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    queryClient.invalidateQueries({ queryKey: ["kpis"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  };

  const assign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api(`/tickets/${params.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeId }),
      }),
    onSuccess: invalidate,
  });

  const claim = useMutation({
    mutationFn: () => api(`/tickets/${params.id}/claim`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const transfer = useMutation({
    mutationFn: (areaId: string) =>
      api(`/tickets/${params.id}/transfer`, {
        method: "POST",
        body: JSON.stringify({ areaId }),
      }),
    onSuccess: () => {
      setTransferAreaId("");
      invalidate();
    },
  });

  const addLink = useMutation({
    mutationFn: () =>
      api(`/tickets/${params.id}/links`, {
        method: "POST",
        body: JSON.stringify({ toTicketNumberOrId: linkTarget, type: linkType }),
      }),
    onSuccess: () => {
      setLinkTarget("");
      invalidate();
    },
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
        body: JSON.stringify({ body, visibility: commentVisibility }),
      }),
    onSuccess: () => {
      setCommentText("");
      invalidate();
    },
  });

  const toggleWatch = useMutation({
    mutationFn: () => api(`/tickets/${params.id}/watch`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api(`/tickets/${params.id}/attachments`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: invalidate,
  });

  if (isLoading || !ticket) {
    return <p className="text-gray-3">{t("common.loading")}</p>;
  }

  const allLinks = [
    ...(ticket.linksFrom?.map((l) => ({ ...l, target: l.toTicket, direction: "from" })) ?? []),
    ...(ticket.linksTo?.map((l) => ({ ...l, target: l.fromTicket, direction: "to" })) ?? []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {readFailed && (
          <p
            role="alert"
            className="rounded-lg border border-orange bg-white p-3 text-sm text-navy"
          >
            {t("audit.readFailed")}{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => recordRead(ticket.id)}
            >
              {t("audit.retry")}
            </button>
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-orange">{ticket.number}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleWatch.mutate()}
                disabled={toggleWatch.isPending}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition flex items-center gap-1 ${
                  ticket.isWatching
                    ? "bg-navy text-white border-navy hover:bg-navy/90"
                    : "border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
                }`}
                title={ticket.isWatching ? t("tickets.unwatch") : t("tickets.watch")}
              >
                <span>{ticket.isWatching ? "★ " + t("tickets.unwatch") : "☆ " + t("tickets.watch")}</span>
              </button>
              {ticket.permissions.canAssign && ticket.assigneeId !== user?.id && (
                <button
                  type="button"
                  onClick={() => claim.mutate()}
                  className="rounded-lg border border-orange bg-orange/10 px-3 py-1 text-xs font-semibold text-orange hover:bg-orange hover:text-white transition"
                >
                  {t("tickets.claim")}
                </button>
              )}
            </div>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-navy">{ticket.title}</h1>
          <div className="mt-3 flex flex-wrap gap-3">
            <StatusBadge status={ticket.status} />
            <PriorityLabel priority={ticket.priority} />
            <span className="text-sm text-gray-2">{ticket.area.name}</span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm text-gray-2">
            {ticket.body}
          </p>
        </div>

        {/* Linked tickets */}
        {allLinks.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              {t("tickets.linkedTickets")}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {allLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1">
                  <span>
                    <strong className="text-orange">{l.type}</strong>:{" "}
                    <Link href={`/tickets/${l.target?.id}`} className="font-semibold text-navy hover:underline">
                      {l.target?.number} — {l.target?.title}
                    </Link>
                  </span>
                  {l.target?.status && <StatusBadge status={l.target.status} />}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comments Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-navy">
            {t("tickets.comment")}
          </h2>
          <ul className="space-y-3">
            {ticket.comments.map((item) => (
              <li
                key={item.id}
                className={`rounded-lg p-3 text-sm ${
                  item.visibility === "INTERNAL"
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-gray-6"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-navy">{item.author.name}</p>
                  {item.visibility === "INTERNAL" && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      {t("tickets.internalBadge")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-gray-2">{item.body}</p>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (commentText.trim()) comment.mutate(commentText);
            }}
          >
            {quickReplies.length > 0 && (
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-medium text-gray-500">
                  {t("tickets.quickReplies")}:
                </span>
                <select
                  onChange={(e) => {
                    const selected = quickReplies.find((qr) => qr.id === e.target.value);
                    if (selected) {
                      setCommentText((prev) =>
                        prev ? `${prev}\n\n${selected.body}` : selected.body
                      );
                    }
                    e.target.value = "";
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-navy"
                >
                  <option value="">{t("tickets.selectQuickReply")}</option>
                  {quickReplies.map((qr) => (
                    <option key={qr.id} value={qr.id}>
                      {qr.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              name="body"
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-sm"
              placeholder={t("tickets.comment")}
            />
            <div className="flex items-center justify-between">
              {ticket.permissions.canAddInternalComment ? (
                <label className="flex items-center gap-2 text-xs text-navy font-medium">
                  <input
                    type="checkbox"
                    checked={commentVisibility === "INTERNAL"}
                    onChange={(e) => setCommentVisibility(e.target.checked ? "INTERNAL" : "PUBLIC")}
                  />
                  {t("tickets.commentInternal")}
                </label>
              ) : <div />}
              <button
                type="submit"
                disabled={!commentText.trim() || comment.isPending}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("tickets.send")}
              </button>
            </div>
          </form>
        </div>

        {/* Attachments Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-navy">
              {t("tickets.attachments")} {ticket.attachments?.length ? `(${ticket.attachments.length})` : ""}
            </h2>
            <label className="cursor-pointer rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1 text-xs font-semibold text-navy transition">
              + {t("tickets.uploadAttachment")}
              <input
                type="file"
                className="hidden"
                disabled={uploadAttachment.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadAttachment.mutate(file);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
          {ticket.attachments && ticket.attachments.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {ticket.attachments.map((att) => (
                <li key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📎</span>
                    <div>
                      <p className="font-semibold text-navy">{att.filename}</p>
                      <p className="text-[11px] text-gray-400">
                        {Math.round(att.sizeBytes / 1024)} KB · {att.uploader?.name ?? "Staff"} ·{" "}
                        {new Date(att.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/tickets/${ticket.id}/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-navy hover:bg-gray-50 transition"
                  >
                    {t("tickets.download")}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">{t("tickets.noAttachments")}</p>
          )}
        </div>

        {/* Activity Events */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-navy">
            {t("tickets.activity")}
          </h2>
          <ol className="space-y-2 text-sm text-gray-2">
            {ticket.events.map((event) => (
              <li key={event.id}>
                <span className="font-medium text-navy">
                  {event.actor.name}
                </span>{" "}
                · {event.message}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <aside className="space-y-4">
        {/* Assign */}
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
            <p className="mt-2 text-sm">
              {ticket.assignee?.name ?? t("tickets.unassigned")}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {t("tickets.status")}
          </p>
          <select
            className="mt-2 w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-sm"
            value={ticket.status}
            onChange={(event) =>
              changeStatus.mutate(event.target.value as TicketStatus)
            }
          >
            <option value={ticket.status}>{t(`status.${ticket.status}`)}</option>
            {(VALID_TRANSITIONS[ticket.status] ?? []).map((status) => (
              <option
                key={status}
                value={status}
                disabled={
                  (status === "CLOSED" || status === "CANCELLED") &&
                  !ticket.permissions.canClose
                }
              >
                → {t(`status.${status}`)}
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

        {/* Department Transfer */}
        {ticket.permissions.canAssign && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
              {t("tickets.transfer")}
            </p>
            <div className="flex gap-2">
              <select
                value={transferAreaId}
                onChange={(e) => setTransferAreaId(e.target.value)}
                className="flex-1 rounded-lg border border-gray-5 bg-gray-6 px-2 py-1.5 text-xs"
              >
                <option value="">Select area...</option>
                {orgTree.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!transferAreaId || transfer.isPending}
                onClick={() => transfer.mutate(transferAreaId)}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t("tickets.transferConfirm")}
              </button>
            </div>
          </div>
        )}

        {/* Link ticket */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
            {t("tickets.link")}
          </p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder={t("tickets.linkPlaceholder")}
              value={linkTarget}
              onChange={(e) => setLinkTarget(e.target.value)}
              className="w-full rounded-lg border border-gray-5 bg-gray-6 px-2 py-1.5 text-xs"
            />
            <div className="flex gap-2">
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as any)}
                className="flex-1 rounded-lg border border-gray-5 bg-gray-6 px-2 py-1.5 text-xs"
              >
                <option value="RELATED">Related</option>
                <option value="PARENT_OF">Parent of</option>
                <option value="DUPLICATE_OF">Duplicate of</option>
              </select>
              <button
                type="button"
                disabled={!linkTarget || addLink.isPending}
                onClick={() => addLink.mutate()}
                className="rounded-lg bg-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t("tickets.link")}
              </button>
            </div>
          </div>
        </div>

        {/* Requester Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p>
            <span className="text-gray-3">Requester:</span>{" "}
            {ticket.requester.name}
          </p>
        </div>
      </aside>
    </div>
  );
}
