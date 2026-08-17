import { defineApp } from "@/platform/manifest/schema";

/**
 * Reference app. It declares what it needs; the platform decides everything.
 */
export const manifest = defineApp({
  key: "directory",
  name: "Directory",
  description: "People directory and access requests — reference app module.",
  permissions: [
    "directory.read",
    "access_request.read",
    "access_request.approve",
  ],
  nav: { label: "Directory", path: "/apps/directory", order: 10, permission: "directory.read" },
  resources: [
    {
      model: "User",
      readPermission: "directory.read",
      piiFields: {
        phone: "pii.contact",
        nationalId: "pii.government_id",
      },
    },
    {
      model: "AccessRequest",
      readPermission: "access_request.read",
      piiFields: {},
    },
  ],
});
