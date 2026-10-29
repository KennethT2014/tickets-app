import { useI18n } from "../app/providers";
import type { TicketPriority, TicketStatus } from "../lib/types";

export const statusClass: Record<TicketStatus, string> = {
  OPEN: "bg-sky-50 text-sky-800",
  IN_PROGRESS: "bg-amber-50 text-amber-800",
  WAITING: "bg-violet-50 text-violet-800",
  RESOLVED: "bg-emerald-50 text-emerald-800",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
};

const priorityClass: Record<TicketPriority, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-navy",
  HIGH: "text-orange",
  URGENT: "text-red-600",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: TicketPriority }) {
  const { t } = useI18n();
  return (
    <span className={`text-xs font-semibold ${priorityClass[priority]}`}>
      {t(`priority.${priority}`)}
    </span>
  );
}
