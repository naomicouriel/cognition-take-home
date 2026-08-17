"use server";

import { revalidatePath } from "next/cache";
import { db, mutate } from "@/platform/data";
import { asActor, requirePermission } from "@/platform/server";
import { DECIDE_PERMISSION, manifest } from "./manifest";
import { decisionSchema, STATUS_FOR_DECISION } from "./schema";

/**
 * The only write in this app. RBAC is decided by `requirePermission`, the write
 * goes through `mutate()`, so the decision is audited with before/after.
 */
export async function decideCase(caseId: string, formData: FormData) {
  const actor = await requirePermission(DECIDE_PERMISSION);
  const { decision, notes } = decisionSchema.parse({
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });

  const current = await asActor(actor, () =>
    db.kycCase.findUnique({ where: { id: caseId }, select: { status: true } }),
  );
  if (!current) throw new Error(`KYC case ${caseId} not found`);
  if (current.status !== "pending") {
    throw new Error(`KYC case ${caseId} is already ${current.status}`);
  }

  await mutate({
    actor,
    action: `kyc_case.${decision}`,
    resource: "KycCase",
    resourceId: caseId,
    fn: (tx) =>
      tx.kycCase.update({
        // Non-unique filter alongside the id: the pending check is atomic, so
        // two reviewers racing cannot both record a decision.
        where: { id: caseId, status: "pending" },
        data: {
          status: STATUS_FOR_DECISION[decision],
          decidedAt: new Date(),
          decidedByEmail: actor.email,
          decisionNote: notes,
        },
      }),
  });

  revalidatePath(manifest.nav.path);
}
