import { z } from "zod";
import type { FormField } from "./SchemaForm";

/** Derive form fields from a zod object schema (schema driven forms). */
export function fieldsFromSchema(schema: z.ZodObject<z.ZodRawShape>): FormField[] {
  return Object.entries(schema.shape).map(([name, definition]) => {
    const inner = unwrap(definition);
    const required = !definition.isOptional();
    if (inner instanceof z.ZodEnum) {
      return {
        name,
        label: humanize(name),
        type: "select" as const,
        required,
        options: inner.options as string[],
      };
    }
    if (inner instanceof z.ZodNumber) {
      return { name, label: humanize(name), type: "number" as const, required };
    }
    const isLongText = /reason|description|notes/i.test(name);
    return {
      name,
      label: humanize(name),
      type: isLongText ? ("textarea" as const) : ("text" as const),
      required,
    };
  });
}

function unwrap(definition: z.ZodTypeAny): z.ZodTypeAny {
  let current = definition;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current._def.innerType;
  }
  return current;
}

function humanize(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
