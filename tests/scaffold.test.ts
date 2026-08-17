import { execFileSync } from "node:child_process";
import { existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const key = "scaffold-probe";
const appDir = join(root, "src", "apps", key);
const routeDir = join(root, "src", "app", "apps", key);
const registryPath = join(root, "src", "apps", "registry.ts");
const registryBefore = readFileSync(registryPath, "utf8");

afterAll(() => {
  rmSync(appDir, { recursive: true, force: true });
  rmSync(routeDir, { recursive: true, force: true });
  writeFileSync(registryPath, registryBefore);
});

describe("scaffolding CLI", () => {
  it("creates an app wired into nav, RBAC and routing", () => {
    execFileSync("npx", ["tsx", "scripts/new-app.ts", key, "--label", "Scaffold Probe"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(existsSync(join(appDir, "manifest.ts"))).toBe(true);
    expect(existsSync(join(appDir, "View.tsx"))).toBe(true);
    expect(existsSync(join(routeDir, "page.tsx"))).toBe(true);

    const registry = readFileSync(registryPath, "utf8");
    expect(registry).toContain(`./${key}/manifest`);

    const view = readFileSync(join(appDir, "View.tsx"), "utf8");
    expect(view).toContain("requirePermission");

    const generated = readFileSync(join(appDir, "manifest.ts"), "utf8");
    expect(generated).toContain("scaffold_probe.read");
  });
});
