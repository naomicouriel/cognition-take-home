import { z } from "zod";

/** A Prisma model name plus the field level PII policy for that model. */
export const dataResourceSchema = z.object({
  /** Prisma model name, e.g. "User". */
  model: z.string().min(1),
  /** Permission required to read rows of this resource at all. */
  readPermission: z.string().min(1),
  /**
   * Field -> permission required to receive that field. Enforced server side
   * in the data access layer, before the bytes leave the database.
   */
  piiFields: z.record(z.string(), z.string()).default({}),
});

export const navEntrySchema = z.object({
  label: z.string().min(1),
  path: z.string().startsWith("/"),
  order: z.number().int().default(100),
  /** Permission required to see the nav entry (defaults to the app's first permission). */
  permission: z.string().min(1),
});

export const appManifestSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "app key must be kebab-case"),
  name: z.string().min(1),
  description: z.string().default(""),
  /** Permissions this app requires. The app declares; the platform decides. */
  permissions: z.array(z.string().min(1)).default([]),
  nav: navEntrySchema,
  resources: z.array(dataResourceSchema).default([]),
});

export type AppManifest = z.infer<typeof appManifestSchema>;
export type DataResource = z.infer<typeof dataResourceSchema>;

export function defineApp(manifest: z.input<typeof appManifestSchema>): AppManifest {
  return appManifestSchema.parse(manifest);
}
