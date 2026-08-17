import { describe, expect, it } from "vitest";
import { manifest, TOGGLE_PERMISSION } from "@/apps/feature-flags/manifest";
import { AuditBypassError, db, mutate, runAsSystem, runWithActor } from "@/platform/data";
import { can, ForbiddenError, authorize } from "@/platform/rbac";
import { STAFF } from "./setup";

const PLATFORM_ADMIN = {
  id: "test-platform-admin",
  email: "platform-admin@test.local",
  role: "platform_admin" as const,
};

const unique = () => `flag-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function createFlag(enabled: boolean) {
  return mutate({
    actor: PLATFORM_ADMIN,
    action: "feature_flag.seed",
    resource: "FeatureFlag",
    fn: (tx) =>
      tx.featureFlag.create({
        data: {
          key: unique(),
          name: "Test flag",
          description: "Created by the feature flag tests.",
          environment: "staging",
          enabled,
          owner: "platform@test.local",
          lastModifiedBy: PLATFORM_ADMIN.email,
        },
      }),
  });
}

describe("feature flag admin", () => {
  it("restricts toggling to platform_admin while everyone with read can list", () => {
    expect(can(PLATFORM_ADMIN, TOGGLE_PERMISSION)).toBe(true);
    expect(can(STAFF, TOGGLE_PERMISSION)).toBe(false);
    expect(can(STAFF, manifest.nav.permission)).toBe(true);
    expect(() => authorize(STAFF, TOGGLE_PERMISSION)).toThrow(ForbiddenError);
  });

  it("audits a toggle with the previous and new state and the acting user", async () => {
    const flag = await createFlag(false);

    await mutate({
      actor: PLATFORM_ADMIN,
      action: "feature_flag.enable",
      resource: "FeatureFlag",
      resourceId: flag.id,
      fn: (tx) =>
        tx.featureFlag.update({
          where: { id: flag.id },
          data: { enabled: true, lastModifiedBy: PLATFORM_ADMIN.email },
        }),
    });

    const entries = await runAsSystem(() =>
      db.auditLog.findMany({
        where: { resource: "FeatureFlag", resourceId: flag.id },
        orderBy: { at: "desc" },
      }),
    );

    expect(entries[0]).toMatchObject({
      action: "feature_flag.enable",
      actorEmail: PLATFORM_ADMIN.email,
    });
    expect((entries[0].before as { enabled: boolean }).enabled).toBe(false);
    expect((entries[0].after as { enabled: boolean }).enabled).toBe(true);
  });

  it("cannot be toggled outside the audited write path", async () => {
    const flag = await createFlag(false);

    await expect(
      runWithActor(PLATFORM_ADMIN, () =>
        db.featureFlag.update({ where: { id: flag.id }, data: { enabled: true } }),
      ),
    ).rejects.toBeInstanceOf(AuditBypassError);
  });

  it("filters by environment and state the way the list view does", async () => {
    const flag = await createFlag(true);

    const rows = await runWithActor(PLATFORM_ADMIN, () =>
      db.featureFlag.findMany({ where: { environment: "staging", enabled: true } }),
    );

    expect(rows.map((row) => row.id)).toContain(flag.id);
    expect(rows.every((row) => row.enabled && row.environment === "staging")).toBe(true);
  });
});
