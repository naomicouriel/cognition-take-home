"use server";

import { mutate } from "@/platform/data";
import { requirePermission } from "@/platform/server";
import { manifest } from "./manifest";

/** Example audited write. Delete or replace. */
export async function example(formData: FormData) {
  const actor = await requirePermission(manifest.nav.permission);
  void formData;
  void mutate;
  void actor;
}
