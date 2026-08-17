import { requireActor } from "@/platform/server";
import { NavShell } from "@/platform/ui/NavShell";

export const dynamic = "force-dynamic";

export default async function AppsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor();
  return <NavShell actor={actor}>{children}</NavShell>;
}
