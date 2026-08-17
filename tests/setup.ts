import { config } from "dotenv";

config({ path: ".env" });

export const ADMIN = {
  id: "test-admin",
  email: "admin@test.local",
  role: "admin" as const,
};

export const REVIEWER = {
  id: "test-reviewer",
  email: "reviewer@test.local",
  role: "reviewer" as const,
};

export const STAFF = {
  id: "test-staff",
  email: "staff@test.local",
  role: "staff" as const,
};
