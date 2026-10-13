"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "../app/providers";
import { api } from "../lib/api";
import type { NotificationItem } from "../lib/types";

export function NotificationBell() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationItem[]>("/notifications"),
    refetchInterval: 15000,
  });
  const unread = data.filter((item) => !item.readAt).length;
  const markAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-white hover:bg-white/20"
        aria-label={t("header.notifications")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold text-navy">{t("header.notifications")}</p>
            <button
              type="button"
              className="text-xs font-medium text-orange"
              onClick={() => markAll.mutate()}
            >
              {t("header.markAll")}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {data.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-gray-3">{t("header.empty")}</p>
            )}
            {data.map((item) => (
              <Link
                key={item.id}
                href={item.ticketId ? `/tickets/${item.ticketId}` : "/tickets"}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-sm hover:bg-gray-6 ${item.readAt ? "text-gray-2" : "text-navy font-medium"}`}
              >
                <p>{item.title}</p>
                <p className="text-xs text-gray-3">{item.body}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
