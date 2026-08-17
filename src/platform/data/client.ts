import { PrismaClient } from "@prisma/client";
import { piiPolicy, readPermissionFor } from "@/platform/manifest/registry";
import { authorize, can, type Actor } from "@/platform/rbac";
import { currentContext } from "./context";
import {
  AuditBypassError,
  AuditForgeryError,
  MissingActorError,
  RawQueryBlockedError,
} from "./errors";

const WRITE_OPERATIONS = new Set([
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

/**
 * Module private. Nothing outside this file may hold the unguarded client, and
 * `tests/no-prisma-import.test.ts` fails the build if any other module imports
 * `@prisma/client` for data access.
 */
const base = new PrismaClient();

function forbiddenFields(model: string, actor: Actor): string[] {
  const fields = piiPolicy()[model] ?? {};
  return Object.entries(fields)
    .filter(([, permission]) => !can(actor, permission))
    .map(([field]) => field);
}

/** Every PII field name the actor may not receive, across all models. */
function allForbiddenFieldNames(actor: Actor): Set<string> {
  const names = new Set<string>();
  for (const model of Object.keys(piiPolicy())) {
    for (const field of forbiddenFields(model, actor)) names.add(field);
  }
  return names;
}

type AnyArgs = Record<string, unknown> & {
  select?: Record<string, unknown>;
  omit?: Record<string, boolean>;
};

/** Keep the bytes in the database: drop PII columns from the query itself. */
function gateArgs(model: string, args: AnyArgs, actor: Actor): AnyArgs {
  const forbidden = forbiddenFields(model, actor);
  if (forbidden.length === 0) return args;
  if (args.select) {
    const select = { ...args.select };
    for (const field of forbidden) delete select[field];
    return { ...args, select };
  }
  const omit = { ...(args.omit ?? {}) };
  for (const field of forbidden) omit[field] = true;
  return { ...args, omit };
}

/** Defence in depth for relation payloads: strip forbidden names anywhere. */
function stripResult(value: unknown, forbidden: Set<string>, depth = 0): unknown {
  if (forbidden.size === 0 || depth > 6 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripResult(item, forbidden, depth + 1));
  }
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.has(key)) continue;
    out[key] = stripResult(item, forbidden, depth + 1);
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const blockedRaw = {
  $executeRaw(...args: unknown[]): never {
    throw new RawQueryBlockedError("$executeRaw");
  },
  $executeRawUnsafe(...args: unknown[]): never {
    throw new RawQueryBlockedError("$executeRawUnsafe");
  },
  $queryRaw(...args: unknown[]): never {
    throw new RawQueryBlockedError("$queryRaw");
  },
  $queryRawUnsafe(...args: unknown[]): never {
    throw new RawQueryBlockedError("$queryRawUnsafe");
  },
};
/* eslint-enable @typescript-eslint/no-unused-vars */

export const prisma = base.$extends({
  client: blockedRaw,
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = currentContext();
        if (!ctx) throw new MissingActorError(model, operation);
        const { actor } = ctx;
        const isWrite = WRITE_OPERATIONS.has(operation);

        if (isWrite) {
          if (!ctx.mutation) throw new AuditBypassError(model, operation);
          if (model === "AuditLog" && !ctx.mutation.writingAudit) {
            throw new AuditForgeryError();
          }
        } else if (model !== "AuditLog") {
          const readPermission = readPermissionFor(model);
          if (readPermission) authorize(actor, readPermission);
        }

        const gated = ctx.raw
          ? (args as AnyArgs)
          : gateArgs(model, args as AnyArgs, actor);
        const result = await query(gated);
        if (ctx.raw) return result;
        return stripResult(result, allForbiddenFieldNames(actor));
      },
    },
  },
});

export type GuardedClient = typeof prisma;
export type TransactionClient = Omit<
  GuardedClient,
  "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;
