import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN } from "./setup";
import {
  AuditBypassError,
  AuditForgeryError,
  RawQueryBlockedError,
  db,
  mutate,
  runAsSystem,
  runWithActor,
} from "@/platform/data";

const unique = () => `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`;

describe("audited data access layer", () => {
  beforeAll(async () => {
    // Ensure the schema exists before assertions touch it.
    await runAsSystem(() => db.user.count());
  });

  it("records actor, action, resource, before and after for every mutation", async () => {
    const email = `${unique()}@example.com`;

    const created = await mutate({
      actor: ADMIN,
      action: "user.create",
      resource: "User",
      fn: (tx) =>
        tx.user.create({
          data: { email, name: "Created", role: "staff", phone: "+1 555 0000" },
        }),
    });

    await mutate({
      actor: ADMIN,
      action: "user.update",
      resource: "User",
      resourceId: created.id,
      snapshot: (tx) => tx.user.findUnique({ where: { id: created.id } }),
      fn: (tx) =>
        tx.user.update({ where: { id: created.id }, data: { name: "Renamed" } }),
    });

    const entries = await runAsSystem(() =>
      db.auditLog.findMany({
        where: { resource: "User", resourceId: created.id },
        orderBy: { at: "asc" },
      }),
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      actorId: ADMIN.id,
      actorEmail: ADMIN.email,
      action: "user.create",
      resource: "User",
    });
    expect(entries[0].at).toBeInstanceOf(Date);

    const update = entries[1];
    expect(update.action).toBe("user.update");
    expect((update.before as { name: string }).name).toBe("Created");
    expect((update.after as { name: string }).name).toBe("Renamed");
  });

  it("blocks writes attempted outside mutate()", async () => {
    await expect(
      runWithActor(ADMIN, () =>
        db.user.create({
          data: { email: `${unique()}@example.com`, name: "Bypass", role: "staff" },
        }),
      ),
    ).rejects.toBeInstanceOf(AuditBypassError);

    await expect(
      runWithActor(ADMIN, () =>
        db.user.updateMany({ where: {}, data: { name: "Bypass" } }),
      ),
    ).rejects.toBeInstanceOf(AuditBypassError);

    await expect(
      runWithActor(ADMIN, () => db.user.deleteMany({ where: { role: "staff" } })),
    ).rejects.toBeInstanceOf(AuditBypassError);
  });

  it("blocks raw SQL, which would bypass audit and PII gating", () => {
    expect(() => db.$executeRawUnsafe("UPDATE \"User\" SET name = 'x'")).toThrow(
      RawQueryBlockedError,
    );
    expect(() => db.$queryRawUnsafe("SELECT 1")).toThrow(RawQueryBlockedError);
  });

  it("refuses hand written audit records", async () => {
    await expect(
      mutate({
        actor: ADMIN,
        action: "audit.forge",
        resource: "AuditLog",
        fn: (tx) =>
          tx.auditLog.create({
            data: {
              actorId: "someone-else",
              actorEmail: "someone@else",
              action: "forged",
              resource: "User",
            },
          }),
      }),
    ).rejects.toBeInstanceOf(AuditForgeryError);
  });

  it("rolls the write back if the audit record cannot be written", async () => {
    const email = `${unique()}@example.com`;

    await expect(
      mutate({
        actor: ADMIN,
        // A NUL byte makes the audit insert fail inside the same transaction.
        action: "user.create\u0000",
        resource: "User",
        fn: (tx) =>
          tx.user.create({ data: { email, name: "Ghost", role: "staff" } }),
      }),
    ).rejects.toBeTruthy();

    const ghost = await runAsSystem(() => db.user.findUnique({ where: { email } }));
    expect(ghost).toBeNull();
  });

  it("requires an actor scope for any data access", async () => {
    await expect(db.user.count()).rejects.toThrowError(/No actor in scope/);
  });
});
