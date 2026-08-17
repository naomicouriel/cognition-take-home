import { mutate, runAsSystem, db } from "@/platform/data";
import { hashPassword } from "@/platform/auth/password";
import { SYSTEM_ACTOR, type RoleName } from "@/platform/rbac";

const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: RoleName;
  phone: string;
  nationalId: string;
}> = [
  {
    email: "admin@example.com",
    name: "Ada Admin",
    role: "admin",
    phone: "+1 555 0100",
    nationalId: "AA-1000",
  },
  {
    email: "reviewer@example.com",
    name: "Rex Reviewer",
    role: "reviewer",
    phone: "+1 555 0101",
    nationalId: "RR-1001",
  },
  {
    email: "staff@example.com",
    name: "Sam Staff",
    role: "staff",
    phone: "+1 555 0102",
    nationalId: "SS-1002",
  },
];

async function main() {
  const passwordHash = hashPassword("password");

  for (const user of DEMO_USERS) {
    const existing = await runAsSystem(() =>
      db.user.findUnique({ where: { email: user.email } }),
    );
    if (existing) continue;
    // Even seeding goes through the audited write path.
    await mutate({
      actor: SYSTEM_ACTOR,
      action: "user.seed",
      resource: "User",
      fn: (tx) => tx.user.create({ data: { ...user, passwordHash } }),
    });
  }

  const staff = await runAsSystem(() =>
    db.user.findUnique({ where: { email: "staff@example.com" } }),
  );
  const requests = await runAsSystem(() => db.accessRequest.count());
  if (staff && requests === 0) {
    await mutate({
      actor: SYSTEM_ACTOR,
      action: "access_request.seed",
      resource: "AccessRequest",
      fn: (tx) =>
        tx.accessRequest.create({
          data: {
            userId: staff.id,
            requestedRole: "reviewer",
            reason: "Needs to review contact details for onboarding.",
          },
        }),
    });
  }

  console.log("Seeded demo users (password: password) and one access request.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
