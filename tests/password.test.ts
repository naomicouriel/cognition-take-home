import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/platform/auth/password";

describe("local dev password hashing", () => {
  it("records its cost parameters in the stored hash", () => {
    const stored = hashPassword("correct horse");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("wrong horse", stored)).toBe(false);
  });
});
