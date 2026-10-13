"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Modal } from "../../../../components/Modal";
import { api } from "../../../../lib/api";
import { flattenAreas } from "../../../../lib/org-layout";
import type { AreaNode, PublicUser } from "../../../../lib/types";
import { useI18n } from "../../../providers";

export default function AreasAdminPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: forest = [] } = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });
  const areas = useMemo(() => flattenAreas(forest), [forest]);
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/org/areas", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org"] });
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/org/areas/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{t("nav.areas")}</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
        >
          {t("org.create")}
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-6 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{t("org.name")}</th>
              <th className="px-4 py-3">{t("org.lead")}</th>
              <th className="px-4 py-3">{t("org.members")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-navy">{area.name}</td>
                <td className="px-4 py-3">{area.lead?.name ?? t("org.none")}</td>
                <td className="px-4 py-3">{area.members.length}</td>
                <td className="px-4 py-3 text-right">
                  {area.parentId && (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => remove.mutate(area.id)}
                    >
                      {t("org.delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={t("org.create")} onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              create.mutate({
                name: form.get("name"),
                parentId: String(form.get("parentId") || "") || null,
                leadUserId: String(form.get("leadUserId") || "") || null,
              });
            }}
          >
            <input name="name" required placeholder={t("org.name")} className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2" />
            <select name="parentId" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2">
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <select name="leadUserId" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2">
              <option value="">{t("org.lead")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
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
