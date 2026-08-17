import { redirect } from "next/navigation";
import { currentUser } from "@/platform/auth";
import { navFor } from "@/platform/manifest/registry";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await currentUser();
  if (!actor) redirect("/login");
  const nav = navFor(actor);
  redirect(nav[0]?.path ?? "/login");
}
