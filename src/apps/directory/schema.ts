import { z } from "zod";

export const accessRequestSchema = z.object({
  requestedRole: z.enum(["admin", "reviewer", "staff"]),
  reason: z.string().min(3),
});
