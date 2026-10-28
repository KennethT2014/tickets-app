"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { useI18n } from "../app/providers";
import { api } from "../lib/api";
import { flattenAreas, layoutOrgTree } from "../lib/org-layout";
import { canOverseeAllTickets, isAdmin as hasAdminRole } from "../lib/roles";
import type { AreaNode, AuthProfile, PublicUser } from "../lib/types";
import { Modal } from "./Modal";

function AreaNodeCard({ data }: NodeProps<Node<AreaNode>>) {
  return (
    <button
      type="button"
      className="w-[220px] rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm"
    >
      <p className="text-sm font-bold text-navy">{data.name}</p>
      <p className="mt-1 text-xs text-gray-3">{data.lead?.name ?? "—"}</p>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-500">
        {data.members.length} members
      </p>
    </button>
  );
}

const nodeTypes = { area: AreaNodeCard };

export function OrgCanvas({ user }: { user: AuthProfile }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: forest = [] } = useQuery({
    queryKey: ["org"],
    queryFn: () => api<AreaNode[]>("/org/tree"),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<PublicUser[]>("/users"),
  });
  const [selected, setSelected] = useState<AreaNode | null>(null);
  const [creating, setCreating] = useState(false);
  const layout = useMemo(() => layoutOrgTree(forest), [forest]);
  const flat = useMemo(() => flattenAreas(forest), [forest]);
  const isAdmin = hasAdminRole(user.globalRole);
  const canManage = (area: AreaNode) =>
    canOverseeAllTickets(user.globalRole) || user.leadAreaIds.includes(area.id);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["org"] });

  const createArea = useMutation({
    mutationFn: (body: { name: string; parentId: string | null; leadUserId: string | null }) =>
      api("/org/areas", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
  });
  const updateArea = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      api(`/org/areas/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.body),
      }),
    onSuccess: invalidate,
  });
  const addMember = useMutation({
    mutationFn: (input: {
      areaId: string;
      userId: string;
      canAssign: boolean;
      canClose: boolean;
    }) =>
      api(`/org/areas/${input.areaId}/members`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
  const patchMember = useMutation({
    mutationFn: (input: {
      areaId: string;
      userId: string;
      canAssign?: boolean;
      canClose?: boolean;
    }) =>
      api(`/org/areas/${input.areaId}/members/${input.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          canAssign: input.canAssign,
          canClose: input.canClose,
        }),
      }),
    onSuccess: invalidate,
  });

  const selectedLive = selected
    ? (flat.find((area) => area.id === selected.id) ?? selected)
    : null;

  return (
    <div className="flex h-full min-h-[70vh] gap-4">
      <div className="relative h-[70vh] flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="absolute right-3 top-3 z-10 rounded-lg bg-orange px-3 py-2 text-sm font-semibold text-white"
          >
            {t("org.create")}
          </button>
        )}
        <ReactFlow
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_event, node) => setSelected(node.data)}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      {selectedLive && (
        <aside className="w-80 shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-navy">{selectedLive.name}</h2>
          <p className="text-sm text-gray-2">
            {t("org.lead")}: {selectedLive.lead?.name ?? t("org.none")}
          </p>
          {isAdmin && (
            <label className="mt-3 block text-sm text-gray-3">
              {t("org.lead")}
              <select
                className="mt-1 w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-navy"
                value={selectedLive.lead?.id ?? ""}
                onChange={(event) =>
                  updateArea.mutate({
                    id: selectedLive.id,
                    body: { leadUserId: event.target.value || null },
                  })
                }
              >
                <option value="">{t("org.none")}</option>
                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {t("org.members")}
          </h3>
          <ul className="mt-2 space-y-2">
            {selectedLive.members.map((member) => (
              <li key={member.userId} className="rounded-lg border border-gray-100 p-2 text-sm">
                <p className="font-medium text-navy">{member.name}</p>
                {canManage(selectedLive) && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={member.canAssign}
                        onChange={(event) =>
                          patchMember.mutate({
                            areaId: selectedLive.id,
                            userId: member.userId,
                            canAssign: event.target.checked,
                          })
                        }
                      />
                      {t("org.canAssign")}
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={member.canClose}
                        onChange={(event) =>
                          patchMember.mutate({
                            areaId: selectedLive.id,
                            userId: member.userId,
                            canClose: event.target.checked,
                          })
                        }
                      />
                      {t("org.canClose")}
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canManage(selectedLive) && (
            <form
              className="mt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                addMember.mutate({
                  areaId: selectedLive.id,
                  userId: String(form.get("userId")),
                  canAssign: form.get("canAssign") === "on",
                  canClose: form.get("canClose") === "on",
                });
                event.currentTarget.reset();
              }}
            >
              <select
                name="userId"
                required
                className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2 text-sm"
              >
                <option value="">{t("org.addMember")}</option>
                {users
                  .filter(
                    (person) =>
                      !selectedLive.members.some((member) => member.userId === person.id),
                  )
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="canAssign" /> {t("org.canAssign")}
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="canClose" /> {t("org.canClose")}
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-navy py-2 text-sm font-semibold text-white"
              >
                {t("org.addMember")}
              </button>
            </form>
          )}
        </aside>
      )}
      {creating && (
        <Modal title={t("org.create")} onClose={() => setCreating(false)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createArea.mutate({
                name: String(form.get("name")),
                parentId: String(form.get("parentId") || "") || null,
                leadUserId: String(form.get("leadUserId") || "") || null,
              });
            }}
          >
            <input
              name="name"
              required
              placeholder={t("org.name")}
              className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2"
            />
            <select name="parentId" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2">
              <option value="">{t("org.parent")}</option>
              {flat.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <select name="leadUserId" className="w-full rounded-lg border border-gray-5 bg-gray-6 px-3 py-2">
              <option value="">{t("org.lead")}</option>
              {users.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="rounded-lg bg-orange px-4 py-2 font-semibold text-white">
                {t("org.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
