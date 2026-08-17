import type { Environment } from "./schema";

export type SampleFlag = {
  key: string;
  name: string;
  description: string;
  environment: Environment;
  enabled: boolean;
  owner: string;
};

/** Realistic starting set for local development; seeded by `prisma/seed.ts`. */
export const SAMPLE_FLAGS: SampleFlag[] = [
  {
    key: "checkout-express-pay",
    name: "Express pay at checkout",
    description: "One-tap wallet payment on the checkout page.",
    environment: "production",
    enabled: true,
    owner: "payments@example.com",
  },
  {
    key: "checkout-express-pay",
    name: "Express pay at checkout",
    description: "One-tap wallet payment on the checkout page.",
    environment: "staging",
    enabled: true,
    owner: "payments@example.com",
  },
  {
    key: "search-vector-ranking",
    name: "Vector search ranking",
    description: "Rank search results with the embedding model instead of BM25.",
    environment: "staging",
    enabled: true,
    owner: "search@example.com",
  },
  {
    key: "search-vector-ranking",
    name: "Vector search ranking",
    description: "Rank search results with the embedding model instead of BM25.",
    environment: "production",
    enabled: false,
    owner: "search@example.com",
  },
  {
    key: "billing-usage-invoices",
    name: "Usage based invoices",
    description: "Generate invoices from metered usage rather than seat count.",
    environment: "development",
    enabled: true,
    owner: "billing@example.com",
  },
  {
    key: "billing-usage-invoices",
    name: "Usage based invoices",
    description: "Generate invoices from metered usage rather than seat count.",
    environment: "production",
    enabled: false,
    owner: "billing@example.com",
  },
  {
    key: "onboarding-guided-tour",
    name: "Guided onboarding tour",
    description: "Show the five step product tour to first time users.",
    environment: "production",
    enabled: true,
    owner: "growth@example.com",
  },
  {
    key: "audit-export-csv",
    name: "Audit log CSV export",
    description: "Allow admins to export the audit log as CSV.",
    environment: "development",
    enabled: false,
    owner: "platform@example.com",
  },
  {
    key: "notifications-digest",
    name: "Daily notification digest",
    description: "Batch notifications into one daily email instead of sending each event.",
    environment: "staging",
    enabled: false,
    owner: "platform@example.com",
  },
];
