/**
 * Roles live in config. Apps never define roles and never decide access; they
 * declare the permissions they require in their manifest.
 */
export const PERMISSION_WILDCARD = "*" as const;

export const ROLES = {
  admin: [PERMISSION_WILDCARD],
  platform_admin: [
    "directory.read",
    "feature_flags.read",
    "feature_flags.toggle",
  ],
  reviewer: [
    "directory.read",
    "pii.contact",
    "access_request.read",
    "access_request.approve",
    "feature_flags.read",
  ],
  staff: ["directory.read", "access_request.read", "feature_flags.read"],
} as const satisfies Record<string, readonly string[]>;

export type RoleName = keyof typeof ROLES;

export const ROLE_NAMES = Object.keys(ROLES) as RoleName[];

export function isRoleName(value: string): value is RoleName {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

export const DEFAULT_ROLE: RoleName = "staff";
