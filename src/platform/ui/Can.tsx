import { can, type Actor } from "@/platform/rbac";

/**
 * Permission aware wrapper. This is a convenience for the UI only: hiding is
 * never the enforcement mechanism — the server strips data and rejects actions.
 */
export function Can({
  actor,
  permission,
  fallback = null,
  children,
}: {
  actor: Actor | null;
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return <>{can(actor, permission) ? children : fallback}</>;
}
