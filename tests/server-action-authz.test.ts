/**
 * The RBAC guarantee has to hold when a server action is invoked directly, not
 * only when the UI declines to render a button. These tests call the action
 * functions themselves with a forged session and assert both that the call is
 * rejected and that nothing reached the audit log.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toggleFlag } from "@/apps/feature-flags/actions";
import { db, mutate, runAsSystem } from "@/platform/data";
import { ForbiddenError, type Actor } from "@/platform/rbac";
import { STAFF } from "./setup";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/platform/auth", () => ({ currentUser: async () => sessionActor }));

let sessionActor: Actor | null = null;

const PLATFORM_ADMIN: Actor = {
  id: "test-platform-admin",
  email: "platform-admin@test.local",
  role: "platform_admin",
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
