import { z } from "zod";

export const ENVIRONMENTS = ["development", "staging", "production"] as const;
export const STATES = ["enabled", "disabled"] as const;

export type Environment = (typeof ENVIRONMENTS)[number];
export type FlagState = (typeof STATES)[number];

/** Query filters for the list view, parsed from the URL. */
export const flagFiltersSchema = z.object({
  environment: z.enum(ENVIRONMENTS).optional(),
  state: z.enum(STATES).optional(),
});

export type FlagFilters = z.infer<typeof flagFiltersSchema>;

export const toggleFlagSchema = z.object({
  id: z.string().min(1),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export function stateOf(enabled: boolean): FlagState {
  return enabled ? "enabled" : "disabled";
}
