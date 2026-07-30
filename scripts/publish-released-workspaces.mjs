#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const REGISTRY = "https://npm.pkg.github.com";
const WORKSPACES = [
  { path: "packages/core", name: "@textfilters/core" },
  { path: "packages/url", name: "@textfilters/url" },
  { path: "packages/email", name: "@textfilters/email" },
  { path: "packages/phone", name: "@textfilters/phone" },
  { path: "packages/profanity", name: "@textfilters/profanity" },
  { path: "packages/spam", name: "@textfilters/spam" },
];
const WORKSPACE_BY_PATH = new Map(
  WORKSPACES.map((workspace) => [workspace.path, workspace]),
);

function selectReleasedWorkspaces(rawPaths) {
  let paths;
  try {
    paths = JSON.parse(rawPaths);
  } catch {
    throw new Error("Released paths must be a JSON array.");
  }

  if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string")) {
    throw new Error("Released paths must be a JSON array of strings.");
  }

  if (new Set(paths).size !== paths.length) {
    throw new Error("Released paths must not contain duplicates.");
  }

  for (const path of paths) {
    if (!WORKSPACE_BY_PATH.has(path)) {
      throw new Error(`Released path is not publishable: ${path}`);
    }
  }

  const released = new Set(paths);
  return WORKSPACES.filter((workspace) => released.has(workspace.path));
}

function runSelfTest() {
  const selected = selectReleasedWorkspaces(
    JSON.stringify(["packages/spam", "packages/core", "packages/email"]),
  );
  const actual = selected.map((workspace) => workspace.path);
  const expected = ["packages/core", "packages/email", "packages/spam"];

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected publish order: ${JSON.stringify(actual)}`);
  }

  for (const invalid of [
    "{}",
    JSON.stringify(["packages/core", "packages/core"]),
    JSON.stringify(["packages/unknown"]),
  ]) {
    let rejected = false;
    try {
      selectReleasedWorkspaces(invalid);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`Invalid released paths were accepted: ${invalid}`);
    }
  }

  console.log("Release path allowlist self-test passed.");
}

function publish(workspaces) {
  for (const workspace of workspaces) {
    console.log(`Publishing ${workspace.name} from ${workspace.path}.`);
    const result = spawnSync(
      "npm",
      [
        "publish",
        "--workspace",
        workspace.name,
        `--registry=${REGISTRY}`,
      ],
      { stdio: "inherit" },
    );

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

const args = new Set(process.argv.slice(2));

if (args.has("--self-test")) {
  runSelfTest();
} else {
  const selected = selectReleasedWorkspaces(
    process.env.RELEASED_PATHS ?? "[]",
  );

  if (selected.length === 0) {
    throw new Error("No released package paths were provided.");
  }

  console.log(
    `Validated released workspaces: ${selected
      .map((workspace) => workspace.path)
      .join(", ")}`,
  );

  if (!args.has("--validate-only")) {
    publish(selected);
  }
}
