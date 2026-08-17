import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/platform/auth/password";

describe("local dev password hashing", () => {
  it("records its cost parameters in the stored hash", () => {
    const stored = hashPassword("correct horse");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("still verifies legacy salt:hash values", () => {
    const salt = "a".repeat(32);
    const legacy = `${salt}:${scryptSync("hunter2", salt, 64).toString("hex")}`;
    expect(verifyPassword("hunter2", legacy)).toBe(true);
    expect(verifyPassword("hunter3", legacy)).toBe(false);
  });

  it("rejects a stored value rather than throwing when it is unusable", () => {
    const salt = "b".repeat(32);
    const hash = scryptSync("hunter2", salt, 64).toString("hex");

    for (const stored of [
      "",
      "not-a-hash",
      `scrypt$16384$8$1$${salt}$zzz`, // not hex
      `scrypt$x$8$1$${salt}$${hash}`, // N not a number
      `scrypt$16385$8$1$${salt}$${hash}`, // N not a power of two
      `scrypt$${1 << 24}$8$1$${salt}$${hash}`, // N beyond the memory bound
      // A downgrade to a trivially cheap KDF must not be honoured.
      `scrypt$2$1$1$${salt}$${hash}`,
    ]) {
      expect(verifyPassword("hunter2", stored)).toBe(false);
    }
  });
});
