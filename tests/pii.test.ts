import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, REVIEWER, STAFF } from "./setup";
import {
  PiiFieldForbiddenError,
  db,
  mutate,
  runAsSystem,
  runWithActor,
} from "@/platform/data";
import { ForbiddenError } from "@/platform/rbac";

const email = `pii-${Date.now()}@example.com`;

describe("field level PII gating", () => {
  beforeAll(async () => {
    await mutate({
      actor: ADMIN,
      action: "user.create",
      resource: "User",
      fn: (tx) =>
        tx.user.create({
          data: {
            email,
            name: "Pia Pii",
            role: "staff",
            phone: "+1 555 0199",
            nationalId: "NID-9999",
          },
        }),
    });
  });

  it("never sends restricted fields to a role without the permission", async () => {
    const asStaff = await runWithActor(STAFF, () =>
      db.user.findUnique({ where: { email } }),
    );
    expect(asStaff).toBeTruthy();
    expect(asStaff).not.toHaveProperty("phone");
    expect(asStaff).not.toHaveProperty("nationalId");
    expect(JSON.stringify(asStaff)).not.toContain("555 0199");
  });

  it("gates each field independently", async () => {
    // reviewer has pii.contact but not pii.government_id
    const asReviewer = await runWithActor(REVIEWER, () =>
      db.user.findUnique({ where: { email } }),
    );
    expect(asReviewer).toHaveProperty("phone", "+1 555 0199");
    expect(asReviewer).not.toHaveProperty("nationalId");
  });

  it("cannot be defeated by an explicit select", async () => {
    const selected = await runWithActor(STAFF, () =>
      db.user.findUnique({
        where: { email },
        select: { id: true, phone: true, nationalId: true },
      }),
    );
    expect(selected).not.toHaveProperty("phone");
    expect(selected).not.toHaveProperty("nationalId");
  });

  it("refuses a query that selects only restricted fields", async () => {
    await expect(
      runWithActor(STAFF, () =>
        db.user.findUnique({ where: { email }, select: { nationalId: true } }),
      ),
    ).rejects.toBeInstanceOf(PiiFieldForbiddenError);
  });

  it("still serves aggregates to restricted roles", async () => {
    // Redaction must not turn `count` into a Prisma argument error.
    await expect(runWithActor(STAFF, () => db.user.count())).resolves.toBeTypeOf(
      "number",
    );
  });

  it("cannot be defeated by a relation include", async () => {
    const request = await mutate({
      actor: ADMIN,
      action: "access_request.create",
      resource: "AccessRequest",
      fn: async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { email } });
        return tx.accessRequest.create({
          data: { userId: user.id, requestedRole: "reviewer", reason: "test" },
        });
      },
    });

    const withUser = await runWithActor(STAFF, () =>
      db.accessRequest.findUnique({
        where: { id: request.id },
        include: { user: true },
      }),
    );
    expect(JSON.stringify(withUser)).not.toContain("555 0199");
    expect(JSON.stringify(withUser)).not.toContain("NID-9999");
  });

  it("gives privileged roles the real values", async () => {
    const asAdmin = await runAsSystem(() => db.user.findUnique({ where: { email } }));
    expect(asAdmin?.phone).toBe("+1 555 0199");
    expect(asAdmin?.nationalId).toBe("NID-9999");
  });

  it("rejects reads of a resource the role cannot see at all", async () => {
    await expect(
      runWithActor({ ...STAFF, role: "staff" }, () =>
        db.user.findMany({ where: { role: "admin" } }),
      ),
    ).resolves.toBeTruthy();

    await expect(
      runWithActor(
        { id: "x", email: "x@x", role: "nobody" as never },
        () => db.user.findMany(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
