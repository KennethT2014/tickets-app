"use client";

import { useI18n } from "../app/providers";
import { NotificationBell } from "./NotificationBell";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { language, setLanguage } = useI18n();
  return (
    <header className="flex h-[60px] shrink-0 items-center bg-header px-4 shadow-sm">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-white hover:bg-white/20"
        aria-label="Toggle menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <select
          aria-label="Language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as "en" | "es")}
          className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-sm text-white"
        >
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
        <NotificationBell />
      </div>
    </header>
  );
}
