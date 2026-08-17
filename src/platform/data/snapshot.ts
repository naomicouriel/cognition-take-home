import { currentContext, runInMutation, runRaw } from "./context";
import { SnapshotUnavailableError } from "./errors";
import type { MutationContext } from "./context";
import type { TransactionClient } from "./client";

export const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/** Operations whose previous state must be captured before they run. */
const REQUIRES_BEFORE = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

const DELETES = new Set(["delete", "deleteMany"]);

/** Operations returning a set of rows rather than a single row. */
const MANY = new Set([
  "createMany",
  "createManyAndReturn",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);

export type WriteSnapshot = {
  model: string;
  operation: string;
  before: unknown;
  after: unknown;
};

type Delegate = Record<string, (args?: unknown) => Promise<unknown>>;
type Row = Record<string, unknown> & { id?: unknown };

/**
 * Wraps the transaction client so every write captures its own before and
 * after state inside the same transaction. Snapshots are not opt-in: a write
 * that cannot be snapshotted throws instead of producing a partial audit
 * record.
 */
export function auditingClient(
  tx: TransactionClient,
  mutation: MutationContext,
  snapshots: WriteSnapshot[],
): TransactionClient {
  return new Proxy(tx as unknown as Record<string, unknown>, {
    get(target, property) {
      const value = target[property as string];
      if (
        typeof property !== "string" ||
        property.startsWith("$") ||
        property.startsWith("_") ||
        !isDelegate(value)
      ) {
        return value;
      }
      return wrapDelegate(property, value as unknown as Delegate, mutation, snapshots);
    },
  }) as unknown as TransactionClient;
}

function isDelegate(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Delegate).findMany === "function"
  );
}

function wrapDelegate(
  model: string,
  delegate: Delegate,
  mutation: MutationContext,
  snapshots: WriteSnapshot[],
) {
  return new Proxy(delegate, {
    get(target, property) {
      const value = target[property as string];
      if (typeof property !== "string" || !WRITE_OPERATIONS.has(property)) {
        return value;
      }
      const operation = property;
      return async (args: Record<string, unknown> = {}) => {
        const before = await captureBefore(model, operation, delegate, args);

        // The marker lives in a context scope around this one query, so it is
        // invisible to any other write — including one issued concurrently on
        // another client inside the same mutate().
        const ctx = currentContext()!;
        const result = await runInMutation(
          ctx,
          { ...mutation, snapshotted: true },
          () => (value as (a?: unknown) => Promise<unknown>).call(target, args),
        );

        const after = await captureAfter(operation, delegate, before, result);
        if (before === undefined || after === undefined) {
          throw new SnapshotUnavailableError(model, operation);
        }
        snapshots.push({ model, operation, before, after });
        return result;
      };
    },
  });
}

async function captureBefore(
  model: string,
  operation: string,
  delegate: Delegate,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!REQUIRES_BEFORE.has(operation)) return null;
  const where = args.where;
  if (!where || typeof where !== "object" || Object.keys(where).length === 0) {
    // Without a `where` we cannot know which rows changed, so refuse the write.
    throw new SnapshotUnavailableError(model, operation);
  }
  const rows = (await runRaw(() =>
    delegate.findMany({ where }),
  )) as Row[];
  return one(operation, rows);
}

async function captureAfter(
  operation: string,
  delegate: Delegate,
  before: unknown,
  result: unknown,
): Promise<unknown> {
  // The row is gone: `null` is the state, not a missing snapshot.
  if (DELETES.has(operation)) return null;

  const beforeIds = idsOf(before);
  const targetIds = beforeIds.length > 0 ? beforeIds : idsOf(result);
  if (targetIds.length === 0) {
    // A bulk update that matched nothing genuinely changed no rows.
    if (Array.isArray(before) && before.length === 0) return [];
    // Otherwise the written rows are unidentifiable (e.g. `createMany`, whose
    // result is only a count): refuse rather than audit an empty after state.
    return undefined;
  }
  const rows = (await runRaw(() =>
    delegate.findMany({ where: { id: { in: targetIds } } }),
  )) as Row[];
  return one(operation, rows);
}

function one(operation: string, rows: Row[]): unknown {
  return MANY.has(operation) ? rows : (rows[0] ?? null);
}

function idsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap((item) => idsOf(item));
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as Row).id;
    return id === undefined || id === null ? [] : [id];
  }
  return [];
}
