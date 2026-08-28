import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards against env-var drift: every process.env.* referenced under
// app/, lib/, and prisma.config.ts must be documented in .env.example,
// per the README requirement that setup docs never fall out of sync.
describe(".env.example", () => {
  it("documents every environment variable referenced in source", () => {
    const root = path.resolve(__dirname, "../..");
    const grepOutput = execSync(
      String.raw`grep -rhoE 'process\.env(\.\w+|\["\w+"\])' app lib prisma.config.ts`,
      { cwd: root, encoding: "utf-8" },
    );

    const referencedVars = new Set(
      grepOutput
        .split("\n")
        .filter(Boolean)
        .map((line) => line.replace(/^process\.env\.?/, "").replace(/["[\]]/g, ""))
        .filter((name) => name !== "NODE_ENV"),
    );

    const envExample = readFileSync(path.join(root, ".env.example"), "utf-8");

    for (const name of referencedVars) {
      expect(envExample).toContain(name);
    }
  });
});
