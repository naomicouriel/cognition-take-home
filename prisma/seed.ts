import { SAMPLE_FLAGS } from "@/apps/feature-flags/sample-data";
import { mutate, runAsSystem, db } from "@/platform/data";
import { hashPassword } from "@/platform/auth/password";
import { SYSTEM_ACTOR, type RoleName } from "@/platform/rbac";
import { seedKycReview } from "./seeds/kyc-review";

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
    email: "platform-admin@example.com",
    name: "Pat Platform",
    role: "platform_admin",
    phone: "+1 555 0103",
    nationalId: "PP-1003",
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

  for (const flag of SAMPLE_FLAGS) {
    const existing = await runAsSystem(() =>
      db.featureFlag.findUnique({
        where: {
          key_environment: { key: flag.key, environment: flag.environment },
        },
      }),
    );
    if (existing) continue;
    await mutate({
      actor: SYSTEM_ACTOR,
      action: "feature_flag.seed",
      resource: "FeatureFlag",
      fn: (tx) =>
        tx.featureFlag.create({
          data: { ...flag, lastModifiedBy: SYSTEM_ACTOR.email },
        }),
    });
  }

  await seedKycReview();

  console.log(
    "Seeded demo users (password: password), one access request, sample feature flags and KYC cases.",
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
