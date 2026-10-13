"use client";

import { useQuery } from "@tanstack/react-query";
import { OrgCanvas } from "../../../components/OrgCanvas";
import { api } from "../../../lib/api";
import type { AuthProfile } from "../../../lib/types";
import { useI18n } from "../../providers";

export default function OrgPage() {
  const { t } = useI18n();
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });
  if (!user) return null;
  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-4">
      <h1 className="text-2xl font-bold text-navy">{t("org.title")}</h1>
      <OrgCanvas user={user} />
    </div>
  );
}
