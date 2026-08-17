import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The guarded client is module private, so the only remaining way to bypass the
 * audit hook would be to construct a second PrismaClient. This test makes that
 * a build failure rather than a code review comment.
 */
const ALLOWED = new Set(["src/platform/data/client.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("no unguarded Prisma access", () => {
  it("only the data access layer may import @prisma/client", () => {
    const root = process.cwd();
    const offenders = [join(root, "src"), join(root, "scripts"), join(root, "prisma")]
      .flatMap((dir) => walk(dir))
      .filter((file) => {
        const rel = relative(root, file);
        if (ALLOWED.has(rel)) return false;
        return /from\s+["']@prisma\/client["']|require\(["']@prisma\/client["']\)/.test(
          readFileSync(file, "utf8"),
        );
      });

    expect(offenders).toEqual([]);
  });

  it("app modules may not use runAsSystem, which skips RBAC and PII gating", () => {
    const root = process.cwd();
    const offenders = walk(join(root, "src", "apps")).filter((file) =>
      /\brunAsSystem\b/.test(readFileSync(file, "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});
