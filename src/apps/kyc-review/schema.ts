import { z } from "zod";

export const CASE_STATUSES = ["pending", "approved", "rejected"] as const;
export const RISK_LEVELS = ["low", "medium", "high"] as const;

export const queueFilterSchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  caseId: z.string().min(1).optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().min(3, "Record why this case was approved or rejected."),
});

export type QueueFilter = z.infer<typeof queueFilterSchema>;
export type Decision = z.infer<typeof decisionSchema>;

export const STATUS_FOR_DECISION: Record<Decision["decision"], string> = {
  approve: "approved",
  reject: "rejected",
};
