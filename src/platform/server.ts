import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "@/platform/auth";
import { runWithActor } from "@/platform/data";
import { authorize, type Actor } from "@/platform/rbac";

export async function requireActor(): Promise<Actor> {
  const actor = await currentUser();
  if (!actor) redirect("/login");
  return actor;
}

/**
 * Page and server action guard. Apps declare the permission they need; the
 * decision is made here and nowhere else.
 */
export async function requirePermission(permission: string): Promise<Actor> {
  const actor = await requireActor();
  authorize(actor, permission);
  return actor;
}

/** Run data access in the caller's actor scope (drives audit + PII gating). */
export async function asActor<T>(actor: Actor, fn: () => Promise<T>) {
  return runWithActor(actor, fn);
}
