import { requirePermission } from "@/platform/server";
import { manifest } from "./manifest";

export async function View() {
  // Session auth + RBAC enforcement happen here, in platform code.
  const actor = await requirePermission(manifest.nav.permission);

  return (
    <div>
      <h1 className="text-xl font-semibold">{manifest.name}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Empty app module for {actor.email}. Read data with `db` inside
        `asActor(actor, ...)` and write it with `mutate(...)`.
      </p>
    </div>
  );
}
