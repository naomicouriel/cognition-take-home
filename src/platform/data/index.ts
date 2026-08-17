import type { Actor } from "@/platform/rbac";
import { prisma, type TransactionClient } from "./client";
import {
  currentActor,
  currentContext,
  runAsSystem,
  runInMutation,
  runWithActor,
} from "./context";
import { EmptyMutationError } from "./errors";
import { auditingClient, type WriteSnapshot } from "./snapshot";

export { runAsSystem, runWithActor, currentActor };
export * from "./errors";
export type { TransactionClient };

/**
 * The read side. Writes on this client throw unless they happen inside
 * `mutate()`, which is the only code path that can create an audit record.
 */
export const db = prisma;

export type MutateOptions<T> = {
  actor: Actor;
  /** Verb recorded in the audit log, e.g. "user.update". */
  action: string;
  /** Resource type, e.g. "User". */
  resource: string;
  resourceId?: string;
  fn: (tx: TransactionClient) => Promise<T>;
};

/**
 * The only write path in the platform. The mutation and its audit record are
 * committed in the same transaction, so an unaudited write cannot exist, and
 * every write is snapshotted before and after inside that transaction.
 */
export async function mutate<T>(options: MutateOptions<T>): Promise<T> {
  const { actor, action, resource, resourceId, fn } = options;

  return runWithActor(actor, () =>
    prisma.$transaction(async (tx) => {
      const ctx = currentContext()!;
      const mutation = {
        action,
        resource,
        resourceId,
        writingAudit: false,
        snapshotting: 0,
      };

      const snapshots: WriteSnapshot[] = [];
      const result = await runInMutation(ctx, mutation, () =>
        fn(auditingClient(tx, mutation, snapshots)),
      );
      if (snapshots.length === 0) throw new EmptyMutationError(action);

      const before = collapse(snapshots, "before");
      const after = collapse(snapshots, "after");

      mutation.writingAudit = true;
      await runInMutation(ctx, mutation, () =>
        tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorEmail: actor.email,
            action,
            resource,
            resourceId:
              resourceId ?? inferId(result) ?? inferId(after) ?? inferId(before),
            before: toJson(before),
            after: toJson(after),
          },
        }),
      );
      mutation.writingAudit = false;

      return result;
    }),
  );
}

function inferId(value: unknown): string | undefined {
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

/** One write per mutation is the common case; keep the audit record readable. */
function collapse(snapshots: WriteSnapshot[], side: "before" | "after") {
  if (snapshots.length === 1) return snapshots[0][side];
  return snapshots.map((snapshot) => ({
    model: snapshot.model,
    operation: snapshot.operation,
    [side]: snapshot[side],
  }));
}

function toJson(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
