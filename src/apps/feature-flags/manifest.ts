import { defineApp } from "@/platform/manifest/schema";

export const manifest = defineApp({
  key: "feature-flags",
  name: "Feature Flags",
  description:
    "Feature flag admin panel: inspect flags per environment and toggle them through the audited write path.",
  // Declared, not decided: the platform enforces these.
  permissions: ["feature_flags.read", "feature_flags.toggle"],
  nav: {
    label: "Feature Flags",
    path: "/apps/feature-flags",
    order: 20,
    permission: "feature_flags.read",
  },
  resources: [
    {
      model: "FeatureFlag",
      readPermission: "feature_flags.read",
      piiFields: {},
    },
  ],
});

export const TOGGLE_PERMISSION = "feature_flags.toggle";
