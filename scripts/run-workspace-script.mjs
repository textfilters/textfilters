#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const script = process.argv[2];

if (!script) {
  console.error("Usage: node scripts/run-workspace-script.mjs <script>");
  process.exit(2);
}

const packageJson = JSON.parse(
  await readFile(path.join(repoRoot, "package.json"), "utf8"),
);

if (!Array.isArray(packageJson.workspaces)) {
  console.error("Root package.json must declare a workspaces array.");
  process.exit(2);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

for (const workspace of packageJson.workspaces) {
  const result = spawnSync(
    npmCommand,
    ["run", script, "--workspace", workspace],
    {
      cwd: repoRoot,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
