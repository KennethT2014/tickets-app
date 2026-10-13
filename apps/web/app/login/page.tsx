"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "../providers";
import { api } from "../../lib/api";

export default function LoginPage() {
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-6 md:grid md:grid-cols-2">
      <div className="flex w-full flex-col items-center rounded-b-[40px] bg-navy p-12 text-center text-white md:h-screen md:justify-center md:rounded-none md:p-16">
        <div className="flex flex-grow flex-col items-center justify-center">
          <Image
            src="/LogoBlanco.svg"
            alt="CastleWalk Group Logo"
            width={1269}
            height={290}
            priority
            className="mb-10 h-auto w-48 md:mb-12 md:w-72"
          />
          <p className="mb-3 max-w-sm text-lg font-medium md:text-xl">{t("login.tagline")}</p>
          <div className="h-1 w-16 rounded-full bg-orange" />
        </div>
        <p className="hidden pb-6 text-xs text-[#9999B2] md:mt-auto md:block">
          © 2026 CastleWalk. All rights reserved.
        </p>
      </div>
      <div className="flex h-auto w-full flex-col items-center justify-center bg-white p-10 md:h-screen md:p-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 text-center md:text-left">
            <h1 className="mb-2 text-3xl font-bold text-navy md:text-4xl">{t("login.welcome")}</h1>
            <p className="text-base text-gray-2">{t("login.credentials")}</p>
          </div>
          <form
            className="space-y-6"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setLoading(true);
              const form = new FormData(event.currentTarget);
              try {
                await api("/auth/login", {
                  method: "POST",
                  body: JSON.stringify({
                    email: form.get("email"),
                    password: form.get("password"),
                  }),
                });
                router.push("/");
                router.refresh();
              } catch {
                setError(t("login.invalid"));
              } finally {
                setLoading(false);
              }
            }}
          >
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-3">
                {t("login.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@castlewalk.us"
                className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3 text-sm text-navy placeholder-gray-1 focus:border-orange focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-3">
                {t("login.password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full rounded-lg border border-gray-5 bg-gray-6 px-4 py-3 text-sm text-navy focus:border-orange focus:ring-2 focus:ring-orange"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-gray-3"
                >
                  {showPassword ? t("login.hide") : t("login.show")}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange py-3.5 text-base font-semibold text-white hover:bg-orange-hover disabled:opacity-50"
            >
              {loading ? t("login.signingIn") : t("login.signIn")}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-gray-3">{t("login.demo")}</p>
          <label className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-600">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "en" | "es")}
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
