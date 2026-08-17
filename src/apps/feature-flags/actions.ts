"use server";

import { revalidatePath } from "next/cache";
import { mutate } from "@/platform/data";
import { requirePermission } from "@/platform/server";
import { manifest, TOGGLE_PERMISSION } from "./manifest";
import { toggleFlagSchema } from "./schema";

/**
 * The only write in this app. RBAC is decided by the platform and the write
 * goes through `mutate()`, so the before/after states and the actor land in
 * the audit log in the same transaction.
 */
export async function toggleFlag(formData: FormData) {
  const actor = await requirePermission(TOGGLE_PERMISSION);
  const { id, enabled } = toggleFlagSchema.parse({
    id: formData.get("id"),
    enabled: formData.get("enabled"),
  });

  await mutate({
    actor,
    action: enabled ? "feature_flag.enable" : "feature_flag.disable",
    resource: "FeatureFlag",
    resourceId: id,
    fn: (tx) =>
      tx.featureFlag.update({
        where: { id },
        data: {
          enabled,
          lastModifiedBy: actor.email,
          lastModifiedAt: new Date(),
        },
      }),
  });

  revalidatePath(manifest.nav.path);
  revalidatePath(`${manifest.nav.path}/${id}`);
}
