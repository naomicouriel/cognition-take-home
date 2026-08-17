import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ADMIN } from "./setup";
import { db, mutate, runAsSystem } from "@/platform/data";

/** Run SQL as a privileged client, i.e. completely outside the application. */
function psql(sql: string) {
  return execFileSync(
    "docker",
    ["compose", "exec", "-T", "db", "psql", "-U", "platform", "-d", "platform", "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

describe("audit log is append only at the database level", () => {
  it("rejects UPDATE and DELETE even from a direct SQL connection", async () => {
    await mutate({
      actor: ADMIN,
      action: "append-only.probe",
      resource: "User",
      fn: (tx) =>
        tx.user.create({
          data: {
            email: `probe-${Date.now()}@example.com`,
            name: "Probe",
            role: "staff",
          },
        }),
    });

    const count = await runAsSystem(() => db.auditLog.count());
    expect(count).toBeGreaterThan(0);

    expect(() => psql(`UPDATE audit_log SET action = 'tampered'`)).toThrowError(
      /append only/,
    );
    expect(() => psql(`DELETE FROM audit_log`)).toThrowError(/append only/);
    expect(() => psql(`TRUNCATE audit_log`)).toThrowError(/append only/);

    expect(await runAsSystem(() => db.auditLog.count())).toBe(count);
  });
});
