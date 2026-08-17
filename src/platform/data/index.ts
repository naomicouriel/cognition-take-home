import type { Actor } from "@/platform/rbac";
import { prisma, type TransactionClient } from "./client";
import {
  currentActor,
  currentContext,
  runAsSystem,
  runInMutation,
  runRaw,
  runWithActor,
} from "./context";

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
  /**
   * Optional snapshot reader. Runs before and after the mutation with full
   * (unredacted) visibility so the audit record has real before/after values.
   */
  snapshot?: (tx: TransactionClient) => Promise<unknown>;
  fn: (tx: TransactionClient) => Promise<T>;
};

/**
 * The only write path in the platform. The mutation and its audit record are
 * committed in the same transaction, so an unaudited write cannot exist.
 */
export async function mutate<T>(options: MutateOptions<T>): Promise<T> {
  const { actor, action, resource, resourceId, snapshot, fn } = options;

  return runWithActor(actor, () =>
    prisma.$transaction(async (tx) => {
      const ctx = currentContext()!;
      const mutation = {
        action,
        resource,
        resourceId,
        writingAudit: false,
      };

      const before = snapshot ? await runRaw(() => snapshot(tx)) : null;
      const result = await runInMutation(ctx, mutation, () => fn(tx));
      const after = snapshot
        ? await runRaw(() => snapshot(tx))
        : plainOrNull(result);

      mutation.writingAudit = true;
      await runInMutation(ctx, mutation, () =>
        tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorEmail: actor.email,
            action,
            resource,
            resourceId: resourceId ?? inferId(result) ?? inferId(after),
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

function plainOrNull(value: unknown) {
  return value && typeof value === "object" ? value : null;
}

function toJson(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
