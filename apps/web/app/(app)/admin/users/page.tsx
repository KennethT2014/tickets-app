"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal } from "../../../../components/Modal";
import { api } from "../../../../lib/api";
import { assignableRoles, canEditUser } from "../../../../lib/roles";
import type { AuthProfile, PublicUser } from "../../../../lib/types";
import { useI18n } from "../../../providers";

export default function UsersAdminPage() {
  const { t, language } = useI18n();
  const tr = (en: string, es: string) => (language === "es" ? es : en);
  const client = useQueryClient();
  const [editor, setEditor] = useState<PublicUser | "new" | null>(null);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });
  const save = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id?: string;
      body: Record<string, unknown>;
    }) =>
      api(id ? `/users/${id}` : "/users", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["users"] });
      setEditor(null);
    },
  });
  const open = (target: PublicUser | "new") => {
    save.reset();
    setEditor(target);
  };
  const editing = editor && editor !== "new" ? editor : null;
  const roles = me.data ? assignableRoles(me.data.globalRole) : [];
  const roleOptions =
    editing && !roles.includes(editing.globalRole)
      ? [editing.globalRole, ...roles]
      : roles;
  const button =
    "rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
  const field = "w-full rounded-lg border border-gray-300 px-3 py-2";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">{t("users.title")}</h1>
        <button
          className={button}
          disabled={!me.data}
          onClick={() => open("new")}
        >
          {t("users.create")}
        </button>
      </div>
      {(users.isPending || me.isPending) && (
        <p role="status">{t("common.loading")}</p>
      )}
      {(users.error || me.error) && (
        <div role="alert">
          {(users.error || me.error)?.message}
          <button
            className="ml-3 underline"
            onClick={() => {
              users.refetch();
              me.refetch();
            }}
          >
            {t("audit.retry")}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                tr("Name", "Nombre"),
                t("login.email"),
                t("users.role"),
                tr("Status", "Estado"),
                tr("Actions", "Acciones"),
              ].map((label) => (
                <th key={label} className="p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.data?.map((user) => (
              <tr className="border-t" key={user.id}>
                <td className="p-3">{user.name}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{t(`role.${user.globalRole}`)}</td>
                <td className="p-3">
                  {user.isActive
                    ? tr("Active", "Activo")
                    : tr("Inactive", "Inactivo")}
                </td>
                <td className="p-3">
                  <button
                    className="text-orange disabled:text-gray-400"
                    disabled={!me.data || !canEditUser(me.data, user)}
                    onClick={() => open(user)}
                  >
                    {tr("Edit", "Editar")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.data?.length === 0 && (
        <p>{tr("No users found.", "No se encontraron usuarios.")}</p>
      )}
      {editor && (
        <Modal
          title={
            editing ? tr("Edit user", "Editar usuario") : t("users.create")
          }
          onClose={() => {
            if (!save.isPending) setEditor(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const password = String(form.get("password") || "");
              save.mutate({
                id: editing?.id,
                body: {
                  name: form.get("name"),
                  globalRole: form.get("globalRole"),
                  ...(editing
                    ? { isActive: form.get("isActive") === "on" }
                    : { email: form.get("email") }),
                  ...(password ? { password } : {}),
                },
              });
            }}
          >
            <label className="block">
              {tr("Name", "Nombre")}
              <input
                className={field}
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={editing?.name}
              />
            </label>
            {!editing && (
              <label className="block">
                {t("login.email")}
                <input className={field} type="email" name="email" required />
              </label>
            )}
            <label className="block">
              {t("users.role")}
              <select
                className={field}
                name="globalRole"
                defaultValue={editing?.globalRole ?? "EMPLOYEE"}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {t(`role.${role}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {editing
                ? tr("New password optional", "Nueva contraseña opcional")
                : tr("Password", "Contraseña")}
              <input
                className={field}
                name="password"
                type="password"
                required={!editing}
                minLength={8}
                maxLength={120}
                autoComplete="new-password"
              />
            </label>
            {editing && (
              <label className="flex gap-2">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={editing.isActive}
                />
                {tr("Active account", "Cuenta activa")}
              </label>
            )}
            {editing?.id === me.data?.id && (
              <p className="text-sm text-gray-600">
                {tr(
                  "Changing your password, role or activation ends your current session.",
                  "Cambiar su contraseña, rol o activación termina su sesión actual.",
                )}
              </p>
            )}
            {save.error && (
              <p role="alert" className="text-red-700">
                {save.error.message}
              </p>
            )}
            <button type="submit" className={button} disabled={save.isPending}>
              {save.isPending ? t("common.loading") : t("org.save")}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
