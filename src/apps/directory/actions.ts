"use server";

import { revalidatePath } from "next/cache";
import { mutate } from "@/platform/data";
import { requirePermission } from "@/platform/server";
import { manifest } from "./manifest";
import { accessRequestSchema } from "./schema";

export async function createAccessRequest(formData: FormData) {
  const actor = await requirePermission("access_request.read");
  const input = accessRequestSchema.parse({
    requestedRole: formData.get("requestedRole"),
    reason: formData.get("reason"),
  });

  await mutate({
    actor,
    action: "access_request.create",
    resource: "AccessRequest",
    fn: (tx) =>
      tx.accessRequest.create({
        data: { userId: actor.id, ...input },
      }),
  });

  revalidatePath(manifest.nav.path);
}

export async function approveAccessRequest(formData: FormData) {
  const actor = await requirePermission("access_request.approve");
  const id = String(formData.get("id"));

  await mutate({
    actor,
    action: "access_request.approve",
    resource: "AccessRequest",
    resourceId: id,
    snapshot: (tx) => tx.accessRequest.findUnique({ where: { id } }),
    fn: (tx) =>
      tx.accessRequest.update({
        where: { id },
        data: { status: "approved" },
      }),
  });

  revalidatePath(manifest.nav.path);
}
