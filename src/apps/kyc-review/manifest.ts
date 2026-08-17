import { defineApp } from "@/platform/manifest/schema";

export const manifest = defineApp({
  key: "kyc-review",
  name: "KYC Review",
  description:
    "Queue of pending customer verification cases with document review and an audited approve/reject decision.",
  // Declared, not decided: the platform enforces these.
  permissions: ["kyc_review.read", "kyc_review.decide"],
  nav: {
    label: "KYC Review",
    path: "/apps/kyc-review",
    order: 20,
    permission: "kyc_review.read",
  },
  resources: [
    {
      model: "KycCase",
      readPermission: "kyc_review.read",
      piiFields: {
        customerName: "pii.customer_name",
        // Deliberately not the directory's `pii.government_id`: permission
        // names are global, so sharing it would also hand out `User.nationalId`.
        documentNumber: "pii.kyc_document_number",
        dateOfBirth: "pii.date_of_birth",
      },
    },
    {
      model: "KycDocument",
      readPermission: "kyc_review.read",
      piiFields: {},
    },
  ],
});

export const DECIDE_PERMISSION = "kyc_review.decide";
