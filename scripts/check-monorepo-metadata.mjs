#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_URL = "https://github.com/textfilters/textfilters.git";
const ISSUES_URL = "https://github.com/textfilters/textfilters/issues";
const WORKSPACES = ["core", "url", "email", "phone", "profanity", "spam"];
const ROOT_TOOLING = ["@types/node", "prettier", "typescript", "vitest"];

const rootPackage = await readJson("package.json");
const releaseConfig = await readJson("release-please-config.json");
const releaseManifest = await readJson(".release-please-manifest.json");
const failures = [];

expectEqual(
  "root workspaces",
  rootPackage.workspaces,
  WORKSPACES.map((name) => `packages/${name}`),
);
expectEqual("root private", rootPackage.private, true);
for (const dependency of ROOT_TOOLING) {
  if (!rootPackage.devDependencies?.[dependency]) {
    failures.push(`Root devDependencies are missing ${dependency}.`);
  }
}

const packageJsonByName = new Map();
for (const name of WORKSPACES) {
  const workspacePath = `packages/${name}`;
  const packageJson = await readJson(`${workspacePath}/package.json`);
  packageJsonByName.set(name, packageJson);

  expectEqual(`${name} package name`, packageJson.name, `@textfilters/${name}`);
  expectEqual(
    `${name} repository URL`,
    packageJson.repository?.url,
    REPOSITORY_URL,
  );
  expectEqual(
    `${name} repository directory`,
    packageJson.repository?.directory,
    workspacePath,
  );
  expectEqual(`${name} issues URL`, packageJson.bugs?.url, ISSUES_URL);
  expectEqual(
    `${name} homepage`,
    packageJson.homepage,
    `https://github.com/textfilters/textfilters/tree/main/${workspacePath}#readme`,
  );
  expectEqual(
    `${name} release manifest version`,
    releaseManifest[workspacePath],
    packageJson.version,
  );
  expectEqual(
    `${name} release component`,
    releaseConfig.packages?.[workspacePath]?.component,
    name,
  );
  expectEqual(
    `${name} release package name`,
    releaseConfig.packages?.[workspacePath]?.["package-name"],
    packageJson.name,
  );
  expectEqual(
    `${name} registry`,
    packageJson.publishConfig?.registry,
    "https://npm.pkg.github.com",
  );
  expectEqual(`${name} package manager`, packageJson.packageManager, undefined);

  for (const dependency of ROOT_TOOLING) {
    if (packageJson.devDependencies?.[dependency]) {
      failures.push(
        `${name} duplicates root tooling dependency ${dependency}.`,
      );
    }
  }

  for (const script of [
    "lint",
    "test",
    "build",
    "smoke:dist",
    "pack:dry-run",
    "check",
  ]) {
    if (!packageJson.scripts?.[script]) {
      failures.push(`${name} is missing the ${script} script.`);
    }
  }
}

const coreVersion = packageJsonByName.get("core").version;
for (const name of WORKSPACES.slice(1)) {
  expectEqual(
    `${name} core range`,
    packageJsonByName.get(name).dependencies?.["@textfilters/core"],
    `^${coreVersion}`,
  );
}

expectEqual("Release Please plugin", releaseConfig.plugins, ["node-workspace"]);
expectEqual(
  "Release Please aggregate PR mode",
  releaseConfig["separate-pull-requests"],
  false,
);
expectEqual(
  "Release Please component tags",
  releaseConfig["include-component-in-tag"],
  true,
);
expectEqual(
  "Release Please changelog policy",
  releaseConfig["skip-changelog"],
  true,
);

for (const workflow of [
  ".github/workflows/check.yml",
  ".github/workflows/release-please.yml",
]) {
  try {
    await access(path.join(REPO_ROOT, workflow));
  } catch {
    failures.push(`Missing root workflow: ${workflow}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Monorepo metadata check passed.");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), "utf8"));
}

function expectEqual(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}
