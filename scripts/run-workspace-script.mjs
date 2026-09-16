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
const alreadyBuilt = process.argv[3] === "--already-built";

if (!script || process.argv.length > 4 || (process.argv[3] && !alreadyBuilt)) {
  console.error(
    "Usage: node scripts/run-workspace-script.mjs <script> [--already-built]",
  );
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
  const workspacePackage = JSON.parse(
    await readFile(path.join(repoRoot, workspace, "package.json"), "utf8"),
  );
  const selectedScript =
    alreadyBuilt && workspacePackage.scripts?.[`${script}:built`]
      ? `${script}:built`
      : script;
  const result = spawnSync(
    process.env.npm_execpath ? process.execPath : npmCommand,
    process.env.npm_execpath
      ? [
          process.env.npm_execpath,
          "run",
          selectedScript,
          "--workspace",
          workspace,
        ]
      : ["run", selectedScript, "--workspace", workspace],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: !process.env.npm_execpath && process.platform === "win32",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
