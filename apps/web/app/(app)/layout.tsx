"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { api } from "../../lib/api";
import type { AuthProfile } from "../../lib/types";
import { useI18n } from "../providers";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
    retry: false,
  });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const apply = () => setOpen(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      router.replace("/login");
    }
  }, [isError, isLoading, router, user]);

  useEffect(() => {
    if (
      user &&
      user.globalRole !== "ADMIN" &&
      pathname.startsWith("/admin")
    ) {
      router.replace("/");
    }
  }, [pathname, router, user]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange border-t-transparent" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar user={user} open={open} onToggle={() => setOpen((value) => !value)} />
      <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenu={() => setOpen((value) => !value)} />
        <main className="flex h-0 min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
