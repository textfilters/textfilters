#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, "..");
const GITHUB_RAW_ROOT =
  process.env.TEXTFILTERS_RAW_ROOT ??
  "https://raw.githubusercontent.com/textfilters";
const GITHUB_REF_OVERRIDE = process.env.TEXTFILTERS_REF;

const EXPECTED_NODE = ">=24";
const EXPECTED_NPM = "npm@11.16.0";
const EXPECTED_REGISTRY = "https://npm.pkg.github.com";
const EXPECTED_CORE_RANGE = "^0.3.1";

const PACKAGES = [
  {
    repo: "core",
    packageName: "@textfilters/core",
    fallbackRef: "9e8a8bff18f4ca9e53c407d3dd4921beca996d1b",
    dependencyRange: null,
    files: ["dist", "README.md", "LICENSE"],
  },
  {
    repo: "url",
    packageName: "@textfilters/url",
    fallbackRef: "4432cc73c22c46817e4053a7958ffc5aab9924c1",
    dependencyRange: EXPECTED_CORE_RANGE,
    files: ["dist", "docs", "README.md", "LICENSE"],
  },
  {
    repo: "email",
    packageName: "@textfilters/email",
    fallbackRef: "a87c592fb5a97ef8241fcabda583a06dcf63c74a",
    dependencyRange: EXPECTED_CORE_RANGE,
    files: ["dist", "docs", "README.md", "LICENSE"],
  },
  {
    repo: "phone",
    packageName: "@textfilters/phone",
    fallbackRef: "99c95d6c3fb1c429bfdc5e5036e7a4fb3f391792",
    dependencyRange: EXPECTED_CORE_RANGE,
    files: ["dist", "docs", "README.md", "LICENSE"],
  },
  {
    repo: "profanity",
    packageName: "@textfilters/profanity",
    fallbackRef: "1abf767c695775233de6b4cb6fc59e50cabf879a",
    dependencyRange: EXPECTED_CORE_RANGE,
    files: ["dist", "docs", "README.md", "LICENSE"],
  },
  {
    repo: "spam",
    packageName: "@textfilters/spam",
    fallbackRef: "0e3f54e842272322b10b6e055fd38fd2be1ae2a6",
    dependencyRange: "^0.3.0",
    files: ["dist", "docs", "README.md", "LICENSE"],
  },
];

const EXPECTED_WORKFLOWS = [".github/workflows/check.yml"];
const RELEASE_WORKFLOW = ".github/workflows/release-please.yml";
const EXPECTED_CHECK_TARGETS = ["lint", "test", "build", "smoke:dist", "pack:dry-run"];

const args = new Set(process.argv.slice(2));

if (args.has("--self-test")) {
  runSelfTest();
} else {
  const failures = await checkEcosystem();
  finish(failures);
}

async function checkEcosystem() {
  const failures = [];
  const rootPackage = await readJson(path.join(REPO_ROOT, "package.json"));

  checkEqual(failures, "textfilters", "package.json private", rootPackage.private, true);
  checkEqual(failures, "textfilters", "package.json type", rootPackage.type, "module");
  checkEqual(
    failures,
    "textfilters",
    "package.json engines.node",
    rootPackage.engines?.node,
    EXPECTED_NODE,
  );
  checkEqual(
    failures,
    "textfilters",
    "package.json packageManager",
    rootPackage.packageManager,
    EXPECTED_NPM,
  );
  checkContains(
    failures,
    "textfilters",
    "package.json scripts.check",
    rootPackage.scripts?.check,
    "scripts/check-ecosystem-drift.mjs",
  );
  checkEqual(
    failures,
    "textfilters",
    "package.json overrides.@textfilters/spam.@textfilters/core",
    rootPackage.overrides?.["@textfilters/spam"]?.["@textfilters/core"],
    EXPECTED_CORE_RANGE,
  );

  const expectedRootDependencies = Object.fromEntries(
    PACKAGES.map((pkg) => [
      pkg.packageName,
      pkg.packageName === "@textfilters/core"
        ? EXPECTED_CORE_RANGE
        : rootPackage.dependencies?.[pkg.packageName],
    ]),
  );

  for (const pkg of PACKAGES) {
    if (!rootPackage.dependencies?.[pkg.packageName]) {
      failures.push(
        failure(
          "textfilters",
          `package.json dependencies.${pkg.packageName}`,
          "missing",
          expectedRootDependencies[pkg.packageName],
        ),
      );
    }
  }

  for (const pkg of PACKAGES) {
    const packageJson = await readPackageJson(pkg);
    checkPackageJson(failures, pkg, packageJson);

    const rootRange = rootPackage.dependencies?.[pkg.packageName];
    if (rootRange) {
      checkEqual(
        failures,
        "textfilters",
        `package.json dependencies.${pkg.packageName}`,
        rootRange,
        `^${packageJson.version}`,
      );
    }

    for (const workflow of EXPECTED_WORKFLOWS) {
      await checkWorkflowPresence(failures, pkg, workflow);
    }
    await checkWorkflowPresence(failures, pkg, RELEASE_WORKFLOW);
  }

  return failures;
}

function checkPackageJson(failures, pkg, packageJson) {
  const scope = pkg.repo;
  checkEqual(failures, scope, "package.json name", packageJson.name, pkg.packageName);
  checkEqual(failures, scope, "package.json type", packageJson.type, "module");
  checkEqual(failures, scope, "package.json sideEffects", packageJson.sideEffects, false);
  checkEqual(failures, scope, "package.json main", packageJson.main, "./dist/index.js");
  checkEqual(
    failures,
    scope,
    "package.json types",
    packageJson.types,
    "./dist/index.d.ts",
  );
  checkEqual(
    failures,
    scope,
    "package.json exports[.].types",
    packageJson.exports?.["."]?.types,
    "./dist/index.d.ts",
  );
  checkEqual(
    failures,
    scope,
    "package.json exports[.].import",
    packageJson.exports?.["."]?.import,
    "./dist/index.js",
  );
  checkArrayEqual(failures, scope, "package.json files", packageJson.files, pkg.files);
  checkEqual(
    failures,
    scope,
    "package.json scripts.prepack",
    packageJson.scripts?.prepack,
    "npm run build",
  );
  checkContains(
    failures,
    scope,
    "package.json scripts.build",
    packageJson.scripts?.build,
    "tsc",
  );
  for (const script of EXPECTED_CHECK_TARGETS) {
    checkScriptReaches(failures, scope, packageJson.scripts, "check", script);
  }
  checkEqual(
    failures,
    scope,
    "package.json publishConfig.registry",
    packageJson.publishConfig?.registry,
    EXPECTED_REGISTRY,
  );
  checkEqual(
    failures,
    scope,
    "package.json engines.node",
    packageJson.engines?.node,
    EXPECTED_NODE,
  );
  checkEqual(
    failures,
    scope,
    "package.json packageManager",
    packageJson.packageManager,
    EXPECTED_NPM,
  );

  if (pkg.dependencyRange === null) {
    if (packageJson.dependencies?.["@textfilters/core"]) {
      failures.push(
        failure(
          scope,
          "package.json dependencies.@textfilters/core",
          packageJson.dependencies["@textfilters/core"],
          "absent",
        ),
      );
    }
  } else {
    checkEqual(
      failures,
      scope,
      "package.json dependencies.@textfilters/core",
      packageJson.dependencies?.["@textfilters/core"],
      pkg.dependencyRange,
    );
  }
}

async function checkWorkflowPresence(failures, pkg, workflow) {
  const localRepo = path.join(WORKSPACE_ROOT, pkg.repo);
  const local = path.join(localRepo, workflow);
  if (await exists(local)) return;

  if (await exists(localRepo)) {
    failures.push(failure(pkg.repo, workflow, "missing", "present"));
    return;
  }

  const remoteUrl = `${GITHUB_RAW_ROOT}/${pkg.repo}/${packageRef(pkg)}/${workflow}`;
  try {
    const response = await fetch(remoteUrl);
    if (response.ok) return;
    failures.push(failure(pkg.repo, workflow, `HTTP ${response.status}`, "present"));
  } catch (error) {
    failures.push(failure(pkg.repo, workflow, error.message, "present"));
  }
}

async function readPackageJson(pkg) {
  const localRepo = path.join(WORKSPACE_ROOT, pkg.repo);
  const local = path.join(localRepo, "package.json");
  if (await exists(local)) return readJson(local);

  if (await exists(localRepo)) {
    throw new Error(`${pkg.repo}: local package.json is missing`);
  }

  const remoteUrl = `${GITHUB_RAW_ROOT}/${pkg.repo}/${packageRef(pkg)}/package.json`;
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(
      `${pkg.repo}: package.json could not be loaded from ${remoteUrl}: HTTP ${response.status}`,
    );
  }
  return response.json();
}

function packageRef(pkg) {
  return GITHUB_REF_OVERRIDE ?? pkg.fallbackRef;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function checkEqual(failures, scope, field, actual, expected) {
  if (actual !== expected) failures.push(failure(scope, field, actual, expected));
}

function checkArrayEqual(failures, scope, field, actual, expected) {
  if (!Array.isArray(actual)) {
    failures.push(failure(scope, field, actual, expected));
    return;
  }
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    failures.push(failure(scope, field, actual, expected));
  }
}

function checkContains(failures, scope, field, actual, expectedPart) {
  if (typeof actual !== "string" || !actual.includes(expectedPart)) {
    failures.push(failure(scope, field, actual, `contains ${expectedPart}`));
  }
}

function checkScriptReaches(failures, scope, scripts, startScript, targetScript) {
  if (!scriptReaches(scripts, startScript, targetScript)) {
    failures.push(
      failure(
        scope,
        `package.json scripts.${startScript}`,
        scripts?.[startScript],
        `runs ${targetScript}`,
      ),
    );
  }
}

function scriptReaches(scripts, startScript, targetScript, seen = new Set()) {
  if (!scripts?.[startScript] || seen.has(startScript)) return false;
  seen.add(startScript);

  const command = scripts[startScript];
  if (Object.hasOwn(scripts, targetScript) && commandRunsScript(command, targetScript)) {
    return true;
  }

  for (const nextScript of Object.keys(scripts)) {
    if (commandRunsScript(command, nextScript)) {
      if (scriptReaches(scripts, nextScript, targetScript, seen)) return true;
    }
  }

  return false;
}

function commandRunsScript(command, scriptName) {
  if (typeof command !== "string") return false;
  const escaped = escapeRegExp(scriptName);
  const scriptEnd = "(?=$|\\s|[;&|])";
  const npmRun = new RegExp(`\\bnpm\\s+(?:run|run-script)\\s+${escaped}${scriptEnd}`);
  if (npmRun.test(command)) return true;
  return scriptName === "test" && new RegExp(`\\bnpm\\s+test${scriptEnd}`).test(command);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function failure(scope, field, actual, expected) {
  return {
    scope,
    field,
    actual: formatValue(actual),
    expected: formatValue(expected),
  };
}

function formatValue(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function finish(failures) {
  if (failures.length === 0) {
    console.log("Ecosystem drift guard passed.");
    return;
  }

  console.error("Ecosystem drift guard failed:");
  for (const item of failures) {
    console.error(
      `- ${item.scope}: ${item.field}: expected ${item.expected}, got ${item.actual}`,
    );
  }
  process.exitCode = 1;
}

function runSelfTest() {
  const failures = [];
  const basePackageJson = {
    name: "@textfilters/not-core",
    type: "module",
    sideEffects: false,
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    files: ["dist", "README.md", "LICENSE"],
    scripts: {
      prepack: "npm run build",
      check:
        "npm run lint && npm test && npm run build && npm run smoke:dist && npm run pack:dry-run",
    },
    publishConfig: {
      registry: EXPECTED_REGISTRY,
    },
    engines: {
      node: EXPECTED_NODE,
    },
    packageManager: EXPECTED_NPM,
  };

  checkPackageJson(failures, PACKAGES[0], basePackageJson);

  const actionable = failures.some(
    (item) =>
      item.scope === "core" &&
      item.field === "package.json name" &&
      item.actual === "@textfilters/not-core" &&
      item.expected === "@textfilters/core",
  );

  if (!actionable) {
    console.error("Self-test failed: mismatch did not identify the package name field.");
    process.exitCode = 1;
    return;
  }

  const buildFailures = [];
  checkPackageJson(buildFailures, PACKAGES[0], {
    ...basePackageJson,
    name: "@textfilters/core",
    scripts: {
      ...basePackageJson.scripts,
      check: "npm run lint && npm test && npm run smoke:dist && npm run pack:dry-run",
      "smoke:dist": "node --input-type=module --eval \"await import('./dist/index.js');\"",
    },
  });

  const buildIsActionable = buildFailures.some(
    (item) =>
      item.scope === "core" &&
      item.field === "package.json scripts.check" &&
      item.expected === "runs build",
  );

  if (!buildIsActionable) {
    console.error("Self-test failed: mismatch did not identify that check skips build.");
    process.exitCode = 1;
    return;
  }

  const prefixedScriptFailures = [];
  checkPackageJson(prefixedScriptFailures, PACKAGES[0], {
    ...basePackageJson,
    name: "@textfilters/core",
    scripts: {
      ...basePackageJson.scripts,
      check:
        "npm run lint:fix && npm test && npm run build:docs && npm run smoke:dist && npm run pack:dry-run",
      "lint:fix": "prettier . --write",
      "build:docs": "node docs/build.js",
    },
  });

  const exactScriptNamesAreEnforced = prefixedScriptFailures.some(
    (item) =>
      item.scope === "core" &&
      item.field === "package.json scripts.check" &&
      item.expected === "runs lint",
  );

  if (!exactScriptNamesAreEnforced) {
    console.error("Self-test failed: prefixed npm script names matched required scripts.");
    process.exitCode = 1;
    return;
  }

  const missingTargetFailures = [];
  const { "smoke:dist": _missingSmokeDist, ...scriptsWithoutSmokeDist } =
    basePackageJson.scripts;
  checkPackageJson(missingTargetFailures, PACKAGES[0], {
    ...basePackageJson,
    name: "@textfilters/core",
    scripts: {
      ...scriptsWithoutSmokeDist,
      check:
        "npm run lint && npm test && npm run build && npm run smoke:dist && npm run pack:dry-run",
    },
  });

  const missingTargetIsActionable = missingTargetFailures.some(
    (item) =>
      item.scope === "core" &&
      item.field === "package.json scripts.check" &&
      item.expected === "runs smoke:dist",
  );

  if (!missingTargetIsActionable) {
    console.error("Self-test failed: missing referenced npm script target passed.");
    process.exitCode = 1;
    return;
  }

  console.log("Ecosystem drift guard self-test passed.");
}
