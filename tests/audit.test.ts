import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN } from "./setup";
import {
  AuditBypassError,
  AuditForgeryError,
  EmptyMutationError,
  RawQueryBlockedError,
  SnapshotUnavailableError,
  UnsnapshottedWriteError,
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

  it("snapshots before and after automatically, without the caller asking", async () => {
    const email = `${unique()}@example.com`;

    const created = await mutate({
      actor: ADMIN,
      action: "user.create",
      resource: "User",
      fn: (tx) =>
        tx.user.create({
          data: { email, name: "Before", role: "staff", phone: "+1 555 1234" },
        }),
    });

    // No `snapshot` option anywhere: the data layer captures both states.
    await mutate({
      actor: ADMIN,
      action: "user.promote",
      resource: "User",
      fn: (tx) =>
        tx.user.update({
          where: { id: created.id },
          data: { name: "After", role: "reviewer" },
        }),
    });

    await mutate({
      actor: ADMIN,
      action: "user.delete",
      resource: "User",
      fn: (tx) => tx.user.delete({ where: { id: created.id } }),
    });

    const [create, update, remove] = await runAsSystem(() =>
      db.auditLog.findMany({
        where: { resourceId: created.id },
        orderBy: { at: "asc" },
      }),
    );

    expect(create.before).toBeNull();
    expect(create.after).toMatchObject({ name: "Before", role: "staff" });

    expect(update.before).toMatchObject({ name: "Before", role: "staff" });
    expect(update.after).toMatchObject({ name: "After", role: "reviewer" });
    // Snapshots are taken with full visibility, so PII is preserved in audit.
    expect(update.before).toMatchObject({ phone: "+1 555 1234" });

    expect(remove.before).toMatchObject({ name: "After" });
    expect(remove.after).toBeNull();
  });

  it("fails a write that cannot be snapshotted instead of auditing without one", async () => {
    await expect(
      mutate({
        actor: ADMIN,
        action: "user.rename_everyone",
        resource: "User",
        fn: (tx) => tx.user.updateMany({ data: { name: "Nope" } }),
      }),
    ).rejects.toBeInstanceOf(SnapshotUnavailableError);

    const renamed = await runAsSystem(() =>
      db.user.count({ where: { name: "Nope" } }),
    );
    expect(renamed).toBe(0);
  });

  it("refuses a mutation that writes nothing", async () => {
    await expect(
      mutate({
        actor: ADMIN,
        action: "user.noop",
        resource: "User",
        fn: (tx) => tx.user.count(),
      }),
    ).rejects.toBeInstanceOf(EmptyMutationError);
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

  it("blocks a write that dodges the snapshotting client inside a mutation", async () => {
    await expect(
      mutate({
        actor: ADMIN,
        action: "user.sneak",
        resource: "User",
        // `db` is not the transaction client mutate() handed to us.
        fn: () =>
          db.user.create({
            data: { email: `${unique()}@example.com`, name: "Sneak", role: "staff" },
          }),
      }),
    ).rejects.toBeInstanceOf(UnsnapshottedWriteError);
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
