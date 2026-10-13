"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../app/providers";
import { api } from "../lib/api";
import type { AuthProfile } from "../lib/types";

const items = [
  { href: "/", key: "nav.home" as const, icon: HomeIcon },
  { href: "/tickets", key: "nav.tickets" as const, icon: TicketIcon },
  { href: "/org", key: "nav.org" as const, icon: OrgIcon },
  { href: "/admin/users", key: "nav.users" as const, icon: UsersIcon, admin: true },
  { href: "/admin/areas", key: "nav.areas" as const, icon: AreasIcon, admin: true },
];

export function Sidebar({
  user,
  open,
  onToggle,
}: {
  user: AuthProfile;
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const visible = items.filter((item) => !item.admin || user.globalRole === "ADMIN");

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={onToggle}
        />
      )}
      <div className={`hidden shrink-0 md:block ${open ? "w-56" : "w-0"} transition-all`} />
      <aside
        className={`fixed z-40 flex h-screen w-64 flex-col bg-navy px-3 py-3 transition-transform md:w-56 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-3 flex h-12 items-center px-2">
          <Image
            src="/LogoBlanco.svg"
            alt="CastleWalk"
            width={1269}
            height={290}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {visible.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 768) onToggle();
                }}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white/10 text-orange-accent"
                    : "text-white hover:bg-white/10 hover:text-gray-1"
                }`}
              >
                <item.icon />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-2 pt-3">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="truncate text-xs text-gray-1">{user.email}</p>
          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm text-white hover:bg-white/20"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            {t("nav.logout")}
          </button>
        </div>
      </aside>
    </>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" />
    </svg>
  );
}
function OrgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4M12 11H5v6M12 11h7v6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M21 20c0-2-2-4-4-4" />
    </svg>
  );
}
function AreasIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="15" width="7" height="7" rx="1" />
      <rect x="14" y="15" width="7" height="7" rx="1" />
    </svg>
  );
}
