/**
 * Roles live in config. Apps never define roles and never decide access; they
 * declare the permissions they require in their manifest.
 */
export const PERMISSION_WILDCARD = "*" as const;

export const ROLES = {
  admin: [PERMISSION_WILDCARD],
  platform_admin: [
    // The login page redirects everyone to /apps/directory, so every role
    // needs to be able to render it.
    "directory.read",
    "access_request.read",
    "feature_flags.read",
    "feature_flags.toggle",
  ],
  reviewer: [
    "directory.read",
    "pii.contact",
    "access_request.read",
    "access_request.approve",
    "feature_flags.read",
    // Can watch the KYC queue, but sees no PII and cannot decide.
    "kyc_review.read",
  ],
  compliance_reviewer: [
    // The login page redirects everyone to /apps/directory, so every role
    // needs to be able to render it.
    "directory.read",
    "access_request.read",
    "kyc_review.read",
    "kyc_review.decide",
    "pii.customer_name",
    "pii.kyc_document_number",
    "pii.date_of_birth",
  ],
  staff: ["directory.read", "access_request.read", "feature_flags.read"],
} as const satisfies Record<string, readonly string[]>;

export type RoleName = keyof typeof ROLES;

export const ROLE_NAMES = Object.keys(ROLES) as RoleName[];

export function isRoleName(value: string): value is RoleName {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

export const DEFAULT_ROLE: RoleName = "staff";
