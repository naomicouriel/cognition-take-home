import { defineApp } from "@/platform/manifest/schema";

export const manifest = defineApp({
  key: "kyc-review",
  name: "KYC Review",
  description: "",
  // Declared, not decided: the platform enforces these.
  permissions: ["kyc_review.read"],
  nav: {
    label: "KYC Review",
    path: "/apps/kyc-review",
    order: 100,
    permission: "kyc_review.read",
  },
  // Declare data resources and their PII fields here; the data access layer
  // gates reads and strips PII fields server side.
  resources: [],
});
