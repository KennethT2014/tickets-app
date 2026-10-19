"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../app/providers";
import { api } from "../lib/api";
import type { AuthProfile, Ticket, TicketPriority, TicketStatus } from "../lib/types";

const columns: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

const columnAccent: Record<TicketStatus, string> = {
  OPEN: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  WAITING: "bg-violet-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-gray-400",
  CANCELLED: "bg-red-500",
};

const priorityLabel: Record<TicketPriority, string> = {
  LOW: "bg-gray-3",
  MEDIUM: "bg-navy",
  HIGH: "bg-orange",
  URGENT: "bg-red-500",
};

type DragState = {
  ticket: Ticket;
  over: TicketStatus;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

function canMoveTicket(user: AuthProfile, ticket: Ticket, next: TicketStatus) {
  if (user.globalRole === "ADMIN") return true;
  const isLead = user.leadAreaIds.includes(ticket.areaId);
  const membership = user.memberships.find((item) => item.areaId === ticket.areaId);
  if (next === "CLOSED" || next === "CANCELLED") {
    return isLead || membership?.canClose === true;
  }
  return ticket.assigneeId === user.id || isLead || membership?.canAssign === true;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string) {
  const palette = ["#0c1044", "#c96908", "#1d4ed8", "#0f766e", "#7c3aed", "#be123c"];
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

function isOverdue(ticket: Ticket) {
  if (!ticket.dueAt) return false;
  if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") return false;
  return new Date(ticket.dueAt).getTime() < Date.now();
}

function formatDue(value: string, language: string) {
  return new Date(value).toLocaleDateString(language === "es" ? "es" : "en", {
    month: "short",
    day: "numeric",
  });
}

export function TicketKanban({ tickets }: { tickets: Ticket[] }) {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntil = useRef(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });

  const moveTicket = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      api(`/tickets/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tickets"] });
      const previous = queryClient.getQueriesData<Ticket[]>({ queryKey: ["tickets"] });
      queryClient.setQueriesData<Ticket[]>({ queryKey: ["tickets"] }, (current) =>
        current?.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      setError(t("tickets.moveFailed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });

  const columnOf = useCallback(
    (x: number, y: number) => {
      const node = document
        .elementsFromPoint(x, y)
        .find((el) => el instanceof HTMLElement && el.dataset.boardColumn);
      return (node as HTMLElement | undefined)?.dataset.boardColumn as TicketStatus | undefined;
    },
    [],
  );

  const autoScroll = useCallback((x: number, y: number) => {
    const board = boardRef.current;
    if (!board) return;
    const edge = 48;
    const boardBox = board.getBoundingClientRect();
    if (x < boardBox.left + edge) board.scrollLeft -= 18;
    if (x > boardBox.right - edge) board.scrollLeft += 18;

    const column = document
      .elementsFromPoint(x, y)
      .find((el) => el instanceof HTMLElement && el.dataset.boardScroll);
    if (!(column instanceof HTMLElement)) return;
    const box = column.getBoundingClientRect();
    if (y < box.top + edge) column.scrollTop -= 18;
    if (y > box.bottom - edge) column.scrollTop += 18;
  }, []);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3500);
    return () => window.clearTimeout(timer);
  }, [error]);

  const startDrag = (
    ticket: Ticket,
    card: HTMLElement,
    pointerId: number,
    pointerType: string,
    clientX: number,
    clientY: number,
  ) => {
    if (!user || !canMoveTicket(user, ticket, ticket.status)) return;
    const rect = card.getBoundingClientRect();
    suppressClickUntil.current = Date.now() + 400;
    const next: DragState = {
      ticket,
      over: ticket.status,
      x: clientX,
      y: clientY,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    dragRef.current = next;
    setDrag(next);
    card.setPointerCapture(pointerId);
    if (pointerType === "touch") navigator.vibrate?.(12);
  };

  const onCardPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    ticket: Ticket,
  ) => {
    if (event.button !== 0 || !user) return;
    const card = event.currentTarget;
    const pointerId = event.pointerId;
    const pointerType = event.pointerType;
    const isTouch = pointerType === "touch";
    const startX = event.clientX;
    const startY = event.clientY;
    let timer = 0;
    let active = true;

    const clear = () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!active) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const current = dragRef.current;
      if (!current) {
        if (isTouch && Math.hypot(dx, dy) > 8) {
          clear();
          return;
        }
        if (!isTouch && Math.hypot(dx, dy) > 6) {
          startDrag(ticket, card, pointerId, pointerType, moveEvent.clientX, moveEvent.clientY);
        }
        return;
      }
      moveEvent.preventDefault();
      const over = columnOf(moveEvent.clientX, moveEvent.clientY) ?? current.over;
      const next = {
        ...current,
        over,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };
      dragRef.current = next;
      setDrag(next);
      autoScroll(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent: PointerEvent) => {
      const current = dragRef.current;
      clear();
      if (!current) return;
      const over = columnOf(upEvent.clientX, upEvent.clientY) ?? current.over;
      dragRef.current = null;
      setDrag(null);
      if (over === current.ticket.status) return;
      if (!canMoveTicket(user, current.ticket, over)) {
        setError(t("tickets.moveFailed"));
        return;
      }
      moveTicket.mutate({ id: current.ticket.id, status: over });
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    if (isTouch) {
      timer = window.setTimeout(() => {
        if (active) startDrag(ticket, card, pointerId, pointerType, startX, startY);
      }, 160);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {error ? (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <div
        ref={boardRef}
        className="ticket-board flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2 pt-1 [scrollbar-gutter:stable]"
      >
        {columns.map((status) => {
          const items = tickets.filter((ticket) => ticket.status === status);
          const isOver = drag?.over === status;
          const dropAllowed = Boolean(
            drag && user && canMoveTicket(user, drag.ticket, status),
          );
          return (
            <section
              key={status}
              data-board-column={status}
              className={`flex h-full min-h-0 w-[min(86vw,292px)] shrink-0 snap-start flex-col rounded-xl border border-black/5 bg-[#d3d6de] md:w-[272px] ${
                isOver ? (dropAllowed ? "ring-2 ring-orange" : "ring-2 ring-red-400") : ""
              }`}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span className={`h-2 w-2 rounded-full ${columnAccent[status]}`} />
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-navy">
                  {t(`status.${status}`)}
                </h3>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-gray-2">
                  {items.length}
                </span>
              </header>
              <div
                data-board-scroll={status}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3"
              >
                {items.length === 0 ? (
                  <div
                    className={`flex min-h-16 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs text-gray-2 ${
                      isOver ? "border border-dashed border-orange bg-white/70" : ""
                    }`}
                  >
                    {isOver ? t("tickets.dropHere") : null}
                  </div>
                ) : (
                  items.map((ticket) => {
                    const dragging = drag?.ticket.id === ticket.id;
                    const overdue = isOverdue(ticket);
                    return (
                      <article
                        key={ticket.id}
                        onPointerDown={(event) => onCardPointerDown(event, ticket)}
                        className={`rounded-lg bg-white p-3 shadow-[0_1px_1px_#091e4240] transition select-none ${
                          dragging
                            ? "opacity-40"
                            : "hover:-translate-y-0.5 hover:shadow-md"
                        } ${user && canMoveTicket(user, ticket, ticket.status) ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <Link
                          href={`/tickets/${ticket.id}`}
                          draggable={false}
                          onClick={(event) => {
                            if (Date.now() < suppressClickUntil.current) {
                              event.preventDefault();
                            }
                          }}
                          className="block"
                        >
                          <span
                            className={`mb-2 block h-1.5 w-10 rounded-full ${priorityLabel[ticket.priority]}`}
                          />
                          <p className="text-[11px] font-semibold tracking-wide text-orange">
                            {ticket.number}
                          </p>
                          <p className="mt-1 line-clamp-3 text-sm font-semibold leading-snug text-navy">
                            {ticket.title}
                          </p>
                          <p className="mt-2 truncate text-xs text-gray-2">{ticket.area.name}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            {ticket.dueAt ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-2"
                                }`}
                              >
                                {formatDue(ticket.dueAt, language)}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span
                              title={ticket.assignee?.name ?? t("tickets.unassigned")}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                              style={
                                ticket.assignee
                                  ? { background: avatarColor(ticket.assignee.name), color: "#fff" }
                                  : undefined
                              }
                            >
                              {ticket.assignee ? (
                                initials(ticket.assignee.name)
                              ) : (
                                <span className="h-6 w-6 rounded-full border border-dashed border-gray-400" />
                              )}
                            </span>
                          </div>
                        </Link>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
        <div className="w-1 shrink-0" aria-hidden />
      </div>
      {drag
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 rotate-[2deg] rounded-lg bg-white p-3 shadow-2xl ring-1 ring-black/10"
              style={{
                width: drag.width,
                left: drag.x - drag.offsetX,
                top: drag.y - drag.offsetY,
              }}
            >
              <span
                className={`mb-2 block h-1.5 w-10 rounded-full ${priorityLabel[drag.ticket.priority]}`}
              />
              <p className="text-[11px] font-semibold text-orange">{drag.ticket.number}</p>
              <p className="mt-1 text-sm font-semibold text-navy">{drag.ticket.title}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
