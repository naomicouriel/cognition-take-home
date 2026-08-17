import Link from "next/link";
import { navFor } from "@/platform/manifest/registry";
import type { Actor } from "@/platform/rbac";

export function NavShell({
  actor,
  children,
}: {
  actor: Actor;
  children: React.ReactNode;
}) {
  const nav = navFor(actor);
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6">
          <p className="text-sm font-semibold">Platform</p>
          <p className="text-xs text-slate-500">{actor.email}</p>
          <p className="text-xs text-slate-500">role: {actor.role}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((entry) => (
            <Link
              key={entry.key}
              href={entry.path}
              className="rounded px-2 py-1.5 text-sm hover:bg-slate-100"
            >
              {entry.label}
            </Link>
          ))}
        </nav>
        <form action="/api/auth/signout" method="get" className="mt-6">
          <button className="text-xs text-slate-500 underline" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
