/**
 * The RBAC guarantee has to hold when a server action is invoked directly, not
 * only when the UI declines to render a button. These tests call the action
 * functions themselves with a forged session and assert both that the call is
 * rejected and that nothing reached the audit log.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toggleFlag } from "@/apps/feature-flags/actions";
import { decideCase } from "@/apps/kyc-review/actions";
import { db, mutate, runAsSystem } from "@/platform/data";
import { ForbiddenError, type Actor } from "@/platform/rbac";
import { REVIEWER, STAFF } from "./setup";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/platform/auth", () => ({ currentUser: async () => sessionActor }));

let sessionActor: Actor | null = null;

const PLATFORM_ADMIN: Actor = {
  id: "test-platform-admin",
  email: "platform-admin@test.local",
  role: "platform_admin",
};

const COMPLIANCE: Actor = {
  id: "test-compliance",
  email: "compliance@test.local",
  role: "compliance_reviewer",
};

async function createFlag() {
  return mutate({
    actor: PLATFORM_ADMIN,
    action: "feature_flag.seed",
    resource: "FeatureFlag",
    fn: (tx) =>
      tx.featureFlag.create({
        data: {
          key: `authz-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: "Server action authz flag",
          description: "Created by the server-side authorization tests.",
          environment: "staging",
          enabled: false,
          owner: "platform@test.local",
          lastModifiedBy: PLATFORM_ADMIN.email,
        },
      }),
  });
}

async function auditActions(resource: string, resourceId: string) {
  const entries = await runAsSystem(() =>
    db.auditLog.findMany({ where: { resource, resourceId }, orderBy: { at: "asc" } }),
  );
  return entries;
}

async function createCase() {
  return mutate({
    actor: COMPLIANCE,
    action: "kyc_case.create",
    resource: "KycCase",
    fn: (tx) =>
      tx.kycCase.create({
        data: {
          reference: `KYC-AUTHZ-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          customerName: "Mariana Ortiz",
          documentNumber: "AR-32.884.117",
          dateOfBirth: new Date("1991-04-12"),
          country: "AR",
          riskLevel: "high",
          riskNotes: "Created by the server-side authorization tests.",
        },
      }),
  });
}

function decisionForm(decision: "approve" | "reject") {
  const form = new FormData();
  form.set("decision", decision);
  form.set("notes", "Recorded by the server-side authorization tests.");
  return form;
}

function toggleForm(id: string, enabled: boolean) {
  const form = new FormData();
  form.set("id", id);
  form.set("enabled", String(enabled));
  return form;
}

beforeEach(() => {
  sessionActor = null;
});

describe("feature flag toggle action", () => {
  it("rejects a staff actor and writes no audit row", async () => {
    const flag = await createFlag();
    sessionActor = STAFF;

    await expect(toggleFlag(toggleForm(flag.id, true))).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Only the row from creating the fixture; the rejected toggle added nothing.
    expect((await auditActions("FeatureFlag", flag.id)).map((e) => e.action)).toEqual([
      "feature_flag.seed",
    ]);
    const after = await runAsSystem(() =>
      db.featureFlag.findUnique({ where: { id: flag.id } }),
    );
    expect(after?.enabled).toBe(false);
  });

  it("accepts a platform_admin actor, so the rejection above is not vacuous", async () => {
    const flag = await createFlag();
    sessionActor = PLATFORM_ADMIN;

    await toggleFlag(toggleForm(flag.id, true));

    const entries = await auditActions("FeatureFlag", flag.id);
    expect(entries.map((e) => e.action)).toEqual([
      "feature_flag.seed",
      "feature_flag.enable",
    ]);
    expect(entries[1].actorEmail).toBe(PLATFORM_ADMIN.email);
  });
});

describe("KYC decision action", () => {
  // `reviewer` can read the queue but holds no `kyc_review.decide`, so it is the
  // role most likely to reach the action without the UI offering it.
  it.each([
    ["reviewer", REVIEWER],
    ["staff", STAFF],
  ])("rejects a %s actor and writes no audit row", async (_role, actor) => {
    const kycCase = await createCase();
    sessionActor = actor;

    await expect(
      decideCase(kycCase.id, decisionForm("approve")),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect((await auditActions("KycCase", kycCase.id)).map((e) => e.action)).toEqual([
      "kyc_case.create",
    ]);
    const after = await runAsSystem(() =>
      db.kycCase.findUnique({ where: { id: kycCase.id } }),
    );
    expect(after?.status).toBe("pending");
    expect(after?.decidedByEmail).toBeNull();
  });

  it("accepts a compliance_reviewer actor, so the rejections above are not vacuous", async () => {
    const kycCase = await createCase();
    sessionActor = COMPLIANCE;

    await decideCase(kycCase.id, decisionForm("reject"));

    const entries = await auditActions("KycCase", kycCase.id);
    expect(entries.map((e) => e.action)).toEqual([
      "kyc_case.create",
      "kyc_case.reject",
    ]);
    expect(entries[1].actorEmail).toBe(COMPLIANCE.email);
    expect((entries[1].before as { status: string }).status).toBe("pending");
    expect((entries[1].after as { status: string }).status).toBe("rejected");
  });
});
