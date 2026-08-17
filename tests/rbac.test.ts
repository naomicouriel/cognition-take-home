import { describe, expect, it } from "vitest";
import { ADMIN, REVIEWER, STAFF } from "./setup";
import { ForbiddenError, authorize, can } from "@/platform/rbac";
import { navFor, piiPolicy } from "@/platform/manifest/registry";
import { appManifestSchema } from "@/platform/manifest/schema";
import { apps } from "@/apps/registry";

describe("RBAC", () => {
  it("resolves permissions from role config", () => {
    expect(can(ADMIN, "anything.at.all")).toBe(true);
    expect(can(REVIEWER, "pii.contact")).toBe(true);
    expect(can(REVIEWER, "pii.government_id")).toBe(false);
    expect(can(STAFF, "access_request.approve")).toBe(false);
    expect(can(null, "directory.read")).toBe(false);
  });

  it("throws at the single enforcement point", () => {
    expect(() => authorize(STAFF, "access_request.approve")).toThrow(ForbiddenError);
    expect(() => authorize(ADMIN, "access_request.approve")).not.toThrow();
  });

  it("filters nav from manifests by permission", () => {
    expect(navFor(ADMIN).map((n) => n.key)).toContain("directory");
    expect(navFor({ ...STAFF, role: "nobody" as never })).toHaveLength(0);
  });
});

describe("app manifests", () => {
  it("every registered app has a valid manifest", () => {
    for (const app of apps) {
      expect(() => appManifestSchema.parse(app)).not.toThrow();
    }
  });

  it("rejects malformed manifests", () => {
    expect(() =>
      appManifestSchema.parse({
        key: "Not Kebab",
        name: "x",
        nav: { label: "x", path: "apps/x", permission: "x.read" },
      }),
    ).toThrow();
  });

  it("derives the PII policy from manifests", () => {
    expect(piiPolicy().User).toMatchObject({
      phone: "pii.contact",
      nationalId: "pii.government_id",
    });
  });
});
