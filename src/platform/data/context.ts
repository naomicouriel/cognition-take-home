import { AsyncLocalStorage } from "node:async_hooks";
import { SYSTEM_ACTOR, type Actor } from "@/platform/rbac";

export type MutationContext = {
  action: string;
  resource: string;
  resourceId?: string;
  /** Set only while the data layer itself writes the audit record. */
  writingAudit: boolean;
  /** Number of writes the snapshotting client currently has in flight. */
  snapshotting: number;
};

export type DataContext = {
  actor: Actor;
  mutation?: MutationContext;
  /** Reads inside this scope are not PII redacted (audit snapshots only). */
  raw?: boolean;
};

const storage = new AsyncLocalStorage<DataContext>();

export function currentContext(): DataContext | undefined {
  return storage.getStore();
}

export function currentActor(): Actor | undefined {
  return storage.getStore()?.actor;
}

/**
 * Prisma promises are lazy: the query runs when it is awaited. Every scope
 * therefore awaits inside `storage.run`, so the context is still active when
 * the query actually executes.
 */
function scope<T>(ctx: DataContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, async () => await fn());
}

/** Every read and write happens inside an actor scope. */
export function runWithActor<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  return scope({ actor }, fn);
}

/** For seeding, migrations and IdP provisioning, where there is no end user. */
export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return scope({ actor: SYSTEM_ACTOR, raw: true }, fn);
}

export function runInMutation<T>(
  ctx: DataContext,
  mutation: MutationContext,
  fn: () => Promise<T>,
): Promise<T> {
  return scope({ ...ctx, mutation }, fn);
}

export function runRaw<T>(fn: () => Promise<T>): Promise<T> {
  const ctx = storage.getStore() ?? { actor: SYSTEM_ACTOR };
  return scope({ ...ctx, raw: true }, fn);
}
