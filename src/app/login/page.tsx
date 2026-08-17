import { redirect } from "next/navigation";
import { currentUser, signIn } from "@/platform/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const actor = await currentUser();
  if (actor) redirect("/apps/directory");

  const devEnabled = process.env.ENABLE_DEV_CREDENTIALS === "true";
  const oidcEnabled = Boolean(process.env.OIDC_ISSUER);

  async function devSignIn(formData: FormData) {
    "use server";
    await signIn("dev", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirectTo: "/apps/directory",
    });
  }

  async function oidcSignIn() {
    "use server";
    await signIn("oidc", { redirectTo: "/apps/directory" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">Sign in</h1>

      {oidcEnabled && (
        <form action={oidcSignIn}>
          <button className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white">
            Continue with single sign-on
          </button>
        </form>
      )}

      {devEnabled && (
        <form action={devSignIn} className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Local development provider (seeded users: admin@example.com,
            reviewer@example.com, staff@example.com — password{" "}
            <code>password</code>).
          </p>
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            Sign in
          </button>
        </form>
      )}

      {!devEnabled && !oidcEnabled && (
        <p className="text-sm text-red-600">No auth provider is configured.</p>
      )}
    </main>
  );
}
