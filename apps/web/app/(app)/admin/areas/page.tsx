"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal } from "../../../../components/Modal";
import { api } from "../../../../lib/api";
import { flattenAreas } from "../../../../lib/org-layout";
import { canEditUser, validAreaParents } from "../../../../lib/roles";
import type {
  AreaNode,
  AuthProfile,
  PublicUser,
  QuickReplyItem,
} from "../../../../lib/types";
import { useI18n } from "../../../providers";

export default function AreasAdminPage() {
  const { t, language } = useI18n();
  const tr = (en: string, es: string) => (language === "es" ? es : en);
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState<AreaNode | "new" | null>(null);
  const forest = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<AuthProfile>("/auth/me"),
  });
  const areas = flattenAreas(forest.data ?? []);
  const selected = areas.find((area) => area.id === selectedId);
  const replies = useQuery({
    queryKey: ["quickReplies", selectedId],
    queryFn: () =>
      api<QuickReplyItem[]>(`/org/areas/${selectedId}/quick-replies`),
    enabled: !!selected,
  });
  const operation = useMutation({
    mutationFn: ({
      path,
      method,
      body,
    }: {
      path: string;
      method: string;
      body?: Record<string, unknown>;
    }) =>
      api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["org"] });
      client.invalidateQueries({ queryKey: ["quickReplies"] });
    },
  });
  const saveArea = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id?: string;
      body: Record<string, unknown>;
    }) =>
      api(id ? `/org/areas/${id}` : "/org/areas", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["org"] });
      setEditor(null);
    },
  });
  const field = "w-full rounded-lg border border-gray-300 px-3 py-2";
  const button =
    "rounded-lg bg-orange px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";
  const editing = editor && editor !== "new" ? editor : null;
  const open = (area: AreaNode | "new") => {
    saveArea.reset();
    setEditor(area);
  };
  const manageable = (id: string) => {
    const target = users.data?.find((user) => user.id === id);
    return !!me.data && !!target && canEditUser(me.data, target);
  };
  const availableMembers = (users.data ?? []).filter(
    (user) =>
      user.isActive &&
      manageable(user.id) &&
      !selected?.members.some((member) => member.userId === user.id),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">{t("nav.areas")}</h1>
        <button className={button} onClick={() => open("new")}>
          {t("org.create")}
        </button>
      </div>
      {(forest.isPending || users.isPending || me.isPending) && (
        <p role="status">{t("common.loading")}</p>
      )}
      {(forest.error || users.error || me.error) && (
        <div role="alert">
          {(forest.error || users.error || me.error)?.message}
          <button
            className="ml-3 underline"
            onClick={() => {
              forest.refetch();
              users.refetch();
              me.refetch();
            }}
          >
            {t("audit.retry")}
          </button>
        </div>
      )}
      {operation.error && (
        <p role="alert" className="text-red-700">
          {operation.error.message}
        </p>
      )}
      {operation.isPending && <p role="status">{t("common.loading")}</p>}
      {operation.isSuccess && (
        <p role="status">{tr("Changes saved.", "Cambios guardados.")}</p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                t("org.name"),
                t("org.lead"),
                t("org.members"),
                tr("Actions", "Acciones"),
              ].map((label) => (
                <th className="p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-t">
                <td className="p-3">{area.name}</td>
                <td className="p-3">{area.lead?.name ?? t("org.none")}</td>
                <td className="p-3">{area.members.length}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="text-orange"
                      onClick={() => {
                        operation.reset();
                        setSelectedId(area.id);
                      }}
                    >
                      {tr("Manage", "Administrar")}
                    </button>
                    <button className="text-orange" onClick={() => open(area)}>
                      {tr("Edit", "Editar")}
                    </button>
                    <button
                      className="text-red-700 disabled:opacity-50"
                      disabled={operation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            tr(
                              `Delete area ${area.name}?`,
                              `¿Eliminar el área ${area.name}?`,
                            ),
                          )
                        )
                          operation.mutate({
                            path: `/org/areas/${area.id}`,
                            method: "DELETE",
                          });
                      }}
                    >
                      {t("org.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {areas.length === 0 && !forest.isPending && (
        <p>{tr("No areas found.", "No se encontraron áreas.")}</p>
      )}
      {selected && (
        <section
          className="space-y-5 rounded-xl border bg-white p-4"
          aria-label={tr("Area management", "Administración de área")}
        >
          <h2 className="text-xl font-semibold">{selected.name}</h2>
          <h3 className="font-semibold">{t("org.members")}</h3>
          <ul className="space-y-3">
            {selected.members.map((member) => (
              <li className="rounded-lg border p-3" key={member.userId}>
                <p className="font-medium">{member.name}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(["canAssign", "canClose"] as const).map((permission) => (
                    <label key={permission} className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={member[permission]}
                        disabled={
                          operation.isPending || !manageable(member.userId)
                        }
                        onChange={(event) =>
                          operation.mutate({
                            path: `/org/areas/${selected.id}/members/${member.userId}`,
                            method: "PATCH",
                            body: { [permission]: event.target.checked },
                          })
                        }
                      />
                      {t(`org.${permission}`)}
                    </label>
                  ))}
                  <button
                    disabled={operation.isPending || !manageable(member.userId)}
                    className="text-red-700 disabled:opacity-50"
                    onClick={() => {
                      if (
                        window.confirm(
                          tr(
                            "Remove this membership?",
                            "¿Eliminar esta membresía?",
                          ),
                        )
                      )
                        operation.mutate({
                          path: `/org/areas/${selected.id}/members/${member.userId}`,
                          method: "DELETE",
                        });
                    }}
                  >
                    {tr("Remove member", "Quitar miembro")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!selected.members.length && (
            <p>{tr("No members.", "Sin miembros.")}</p>
          )}
          <form
            className="space-y-3"
            aria-label={tr("Add member", "Agregar miembro")}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              operation.mutate({
                path: `/org/areas/${selected.id}/members`,
                method: "POST",
                body: {
                  userId: form.get("userId"),
                  canAssign: form.get("canAssign") === "on",
                  canClose: form.get("canClose") === "on",
                },
              });
            }}
          >
            <label className="block">
              {t("org.addMember")}
              <select className={field} name="userId" required>
                <option value="">{t("org.addMember")}</option>
                {availableMembers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <label>
                <input type="checkbox" name="canAssign" /> {t("org.canAssign")}
              </label>
              <label>
                <input type="checkbox" name="canClose" /> {t("org.canClose")}
              </label>
            </div>
            <button
              className={button}
              disabled={operation.isPending || !availableMembers.length}
            >
              {t("org.addMember")}
            </button>
          </form>
          <h3 className="font-semibold">
            {tr("Quick replies", "Respuestas rápidas")}
          </h3>
          {replies.isPending && <p role="status">{t("common.loading")}</p>}
          {replies.error && (
            <p role="alert">
              {replies.error.message}
              <button
                onClick={() => replies.refetch()}
                className="ml-3 underline"
              >
                {t("audit.retry")}
              </button>
            </p>
          )}
          {replies.data?.length === 0 && (
            <p>{tr("No quick replies.", "Sin respuestas rápidas.")}</p>
          )}
          <ul className="space-y-2">
            {replies.data?.map((reply) => (
              <li key={reply.id} className="rounded-lg border p-3">
                <strong>{reply.title}</strong>
                <p className="whitespace-pre-wrap break-words">{reply.body}</p>
                <button
                  className="text-red-700 disabled:opacity-50"
                  disabled={operation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        tr(
                          "Delete this quick reply?",
                          "¿Eliminar esta respuesta rápida?",
                        ),
                      )
                    )
                      operation.mutate({
                        path: `/org/quick-replies/${reply.id}`,
                        method: "DELETE",
                      });
                  }}
                >
                  {tr("Delete reply", "Eliminar respuesta")}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="space-y-3"
            aria-label={tr("Create quick reply", "Crear respuesta rápida")}
            onSubmit={(event) => {
              event.preventDefault();
              const element = event.currentTarget;
              const form = new FormData(element);
              operation.mutate(
                {
                  path: `/org/areas/${selected.id}/quick-replies`,
                  method: "POST",
                  body: { title: form.get("title"), body: form.get("body") },
                },
                { onSuccess: () => element.reset() },
              );
            }}
          >
            <label className="block">
              {tr("Reply title", "Título de respuesta")}
              <input
                className={field}
                name="title"
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label className="block">
              {tr("Reply text", "Texto de respuesta")}
              <textarea
                className={field}
                name="body"
                required
                maxLength={5000}
              />
            </label>
            <button className={button} disabled={operation.isPending}>
              {tr("Create quick reply", "Crear respuesta rápida")}
            </button>
          </form>
        </section>
      )}
      {editor && (
        <Modal
          title={editing ? tr("Edit area", "Editar área") : t("org.create")}
          onClose={() => {
            if (!saveArea.isPending) setEditor(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              saveArea.mutate({
                id: editing?.id,
                body: {
                  name: form.get("name"),
                  parentId: form.get("parentId") || null,
                  leadUserId: form.get("leadUserId") || null,
                },
              });
            }}
          >
            <label className="block">
              {t("org.name")}
              <input
                className={field}
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={editing?.name}
              />
            </label>
            <label className="block">
              {tr("Parent area", "Área superior")}
              <select
                className={field}
                name="parentId"
                defaultValue={editing?.parentId ?? ""}
              >
                <option value="">{tr("No parent", "Sin área superior")}</option>
                {(editing ? validAreaParents(editing.id, areas) : areas).map(
                  (area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block">
              {t("org.lead")}
              <select
                className={field}
                name="leadUserId"
                defaultValue={editing?.lead?.id ?? ""}
              >
                <option value="">{t("org.none")}</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            {saveArea.error && (
              <p role="alert" className="text-red-700">
                {saveArea.error.message}
              </p>
            )}
            <button className={button} disabled={saveArea.isPending}>
              {saveArea.isPending ? t("common.loading") : t("org.save")}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
