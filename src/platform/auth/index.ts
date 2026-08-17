import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, mutate, runAsSystem } from "@/platform/data";
import {
  DEFAULT_ROLE,
  isRoleName,
  SYSTEM_ACTOR,
  type Actor,
  type RoleName,
} from "@/platform/rbac";
import { verifyPassword } from "./password";

const providers: NextAuthConfig["providers"] = [];

/** Pluggable, standards-only OIDC provider: point it at any IdP via env. */
if (process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID) {
  providers.push({
    id: "oidc",
    name: process.env.OIDC_NAME ?? "Single sign-on",
    type: "oidc",
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
  });
}

/** Local dev provider so the demo runs without a real IdP. */
if (process.env.ENABLE_DEV_CREDENTIALS === "true") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Local development",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await runAsSystem(() =>
          db.user.findUnique({ where: { email } }),
        );
        if (!user?.passwordHash) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (!email) return token;
      // Provisioning only happens at sign-in: a token whose user has since been
      // deleted must lose access, not silently recreate the account.
      const record = user
        ? await ensureUser(email, user.name ?? email)
        : await runAsSystem(() => db.user.findUnique({ where: { email } }));
      if (!record) return { ...token, sub: undefined, email: undefined, role: undefined };
      token.sub = record.id;
      token.email = record.email;
      token.name = record.name;
      token.role = record.role;
      return token;
    },
    async session({ session, token }) {
      // No subject means the account no longer exists: leave the session
      // without an identity so `currentUser()` resolves to null.
      if (!token.sub || !token.email) {
        session.user.id = "";
        session.user.email = "";
        return session;
      }
      session.user.id = String(token.sub);
      session.user.role = isRoleName(String(token.role))
        ? (token.role as RoleName)
        : DEFAULT_ROLE;
      return session;
    },
  },
};

async function ensureUser(email: string, name: string) {
  const existing = await runAsSystem(() =>
    db.user.findUnique({ where: { email } }),
  );
  if (existing) return existing;
  return mutate({
    actor: SYSTEM_ACTOR,
    action: "user.provision",
    resource: "User",
    fn: (tx) =>
      tx.user.create({
        data: { email, name, role: DEFAULT_ROLE },
      }),
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

/** Resolve the current actor for the single RBAC enforcement point. */
export async function currentUser(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}
