"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal } from "../../../../components/Modal";
import { api } from "../../../../lib/api";
import { GLOBAL_ROLES } from "../../../../lib/roles";
import type { PublicUser } from "../../../../lib/types";
import { useI18n } from "../../../providers";

export default function UsersAdminPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{t("users.title")}</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
        >
          {t("users.create")}
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-6 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">{t("login.email")}</th>
              <th className="px-4 py-3">{t("users.role")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-navy">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{t(`role.${user.globalRole}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={t("users.create")} onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              create.mutate({
                name: form.get("name"),
                email: form.get("email"),
                password: form.get("password"),
                globalRole: form.get("globalRole"),
              });
            }}
          >
            <input name="name" required placeholder="Name" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2" />
            <input name="email" type="email" required className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2" />
            <input name="password" type="password" required minLength={8} className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2" />
            <select name="globalRole" defaultValue="EMPLOYEE" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2">
              {GLOBAL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`role.${role}`)}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-orange px-4 py-2 font-semibold text-white">
              {t("org.save")}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
