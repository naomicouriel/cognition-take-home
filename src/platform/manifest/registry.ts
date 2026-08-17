import { apps } from "@/apps/registry";
import { can, type Actor } from "@/platform/rbac";
import type { AppManifest } from "./schema";

export function allApps(): AppManifest[] {
  return [...apps].sort((a, b) => a.nav.order - b.nav.order);
}

export function appByKey(key: string): AppManifest | undefined {
  return apps.find((a) => a.key === key);
}

/** Nav is derived from manifests and filtered by the single RBAC enforcement point. */
export function navFor(actor: Actor | null) {
  return allApps()
    .filter((app) => can(actor, app.nav.permission))
    .map((app) => ({ key: app.key, ...app.nav }));
}

/** model -> field -> required permission, merged across every app manifest. */
export function piiPolicy(): Record<string, Record<string, string>> {
  const policy: Record<string, Record<string, string>> = {};
  for (const app of apps) {
    for (const resource of app.resources) {
      policy[resource.model] = {
        ...(policy[resource.model] ?? {}),
        ...resource.piiFields,
      };
    }
  }
  return policy;
}

export function readPermissionFor(model: string): string | undefined {
  for (const app of apps) {
    for (const resource of app.resources) {
      if (resource.model === model) return resource.readPermission;
    }
  }
  return undefined;
}
