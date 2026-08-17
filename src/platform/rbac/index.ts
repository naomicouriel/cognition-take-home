import { PERMISSION_WILDCARD, ROLES, type RoleName } from "./roles";

export * from "./roles";

export type Actor = {
  id: string;
  email: string;
  role: RoleName;
  /** System actors exist for migrations, seeding and IdP provisioning. */
  system?: boolean;
};

export class ForbiddenError extends Error {
  constructor(
    readonly permission: string,
    readonly actor: Actor,
  ) {
    super(
      `Forbidden: role "${actor.role}" is missing permission "${permission}"`,
    );
    this.name = "ForbiddenError";
  }
}

/**
 * The single enforcement point. Every access decision in the platform — page
 * guards, server actions, data access and PII gating — resolves here.
 */
export function can(actor: Actor | null | undefined, permission: string) {
  if (!actor) return false;
  if (actor.system) return true;
  const granted: readonly string[] = ROLES[actor.role] ?? [];
  return (
    granted.includes(PERMISSION_WILDCARD) || granted.includes(permission)
  );
}

export function authorize(actor: Actor | null | undefined, permission: string) {
  if (!actor) throw new ForbiddenError(permission, guestActor());
  if (!can(actor, permission)) throw new ForbiddenError(permission, actor);
}

export function permissionsFor(actor: Actor): readonly string[] {
  if (actor.system) return [PERMISSION_WILDCARD];
  return ROLES[actor.role] ?? [];
}

function guestActor(): Actor {
  return { id: "anonymous", email: "anonymous", role: "staff" as RoleName };
}

export const SYSTEM_ACTOR: Actor = {
  id: "system",
  email: "system@platform.local",
  role: "admin",
  system: true,
};
