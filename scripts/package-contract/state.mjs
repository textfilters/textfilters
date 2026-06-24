import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const scriptDir = dirname(fileURLToPath(import.meta.url));
export const repoDir = resolve(scriptDir, "../..");
export const contractPath = join(repoDir, "package-contract.json");
export const contract = JSON.parse(readFileSync(contractPath, "utf8"));
export const packagesRoot = resolve(repoDir, contract.packagesRoot);
export const failures = [];
export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export const BUILD_SCRIPT_COMMAND = "npm run build";
export const TRUSTED_GITHUB_RUNNER = "ubuntu-latest";
export const AUDITED_RUNNER_OS = "linux";
export const AUDITED_RUNNER_CPU = "x64";
export const AUDITED_RUNNER_LIBC = "glibc";
export const UNKNOWN_GITHUB_ACTIONS_EXPRESSION = "__UNKNOWN_GITHUB_ACTIONS_EXPRESSION__";
export const NPM_PUBLISH_SUBCOMMANDS = new Set(["publish", "pu", "pub", "publ", "publi", "publis"]);
export const CHILD_PROCESS_EXECUTION_METHODS = new Set([
  "exec",
  "execSync",
  "execFile",
  "execFileSync",
  "fork",
  "spawn",
  "spawnSync",
]);
export const CHILD_PROCESS_EXECUTION_METHOD_PATTERN = new RegExp(
  `\\b(?:${[...CHILD_PROCESS_EXECUTION_METHODS].join("|")})\\b`,
  "u",
);
export const EXECUTED_CONFIG_LOCAL_PATH_KEYS = new Set([
  "environment",
  "execArgv",
  "globalSetup",
  "include",
  "includeSource",
  "plugins",
  "projects",
  "reporters",
  "runner",
  "setupFiles",
]);
export const NOOP_SCRIPT_COMMANDS = new Set(["true", ":"]);
export const DEPENDENCY_INSTALL_LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "prepublishOnly",
  "preprepare",
  "prepare",
  "postprepare",
];
export const BLOCKED_NPM_CONFIG_KEYS = [
  "access",
  "dry-run",
  "globalconfig",
  "ignore-scripts",
  "node-options",
  "prefix",
  "provenance",
  "provenance-file",
  "script-shell",
  "tag",
  "userconfig",
  "workspace",
  "workspaces",
];
export const BLOCKED_NPM_CONFIG_ENV_KEYS = new Set(
  [
    ...BLOCKED_NPM_CONFIG_KEYS.map((key) => `npm_config_${key}:`),
    `npm_config_${contract.checkWorkflow.scope}:registry:`,
  ].map((key) => key.replace(/:$/u, "").trim().toLowerCase().replace(/-/gu, "_")),
);
export const BLOCKED_AUDITED_NPM_ENV_KEYS = ["BASH_ENV:", "HOME:", "NODE_OPTIONS:"];
export const BLOCKED_WORKFLOW_STARTUP_ENV_KEYS = ["BASH_ENV", "NODE_OPTIONS"];
export const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
export const NPM_CONFIG_SET_OPTIONS_WITH_VALUE = new Set([
  "auth-type",
  "cache",
  "cafile",
  "cert",
  "globalconfig",
  "https-proxy",
  "include",
  "key",
  "location",
  "loglevel",
  "node-options",
  "omit",
  "otp",
  "prefix",
  "proxy",
  "registry",
  "script-shell",
  "scope",
  "tag",
  "tag-version-prefix",
  "userconfig",
  "workspace",
]);
export const NPM_MANIFEST_MUTATION_SUBCOMMANDS = new Set(["pkg", "version"]);
export const ALLOWED_PACKAGE_SCRIPT_NAMES = new Set([
  ...contract.manifest.requiredScriptNames,
  "format",
  "prepack",
]);
export const ALLOWED_PRETTIER_PATHS = new Set(["README.md", "docs", "examples", "package.json", "src", "tests"]);
export const CHECK_SCRIPT_WITH_BUILD = "npm run lint && npm test && npm run build && npm run smoke:dist && npm run pack:dry-run";
export const CHECK_SCRIPT_WITH_SMOKE_BUILD = "npm run lint && npm test && npm run smoke:dist && npm run pack:dry-run";
export const PROFANITY_DIST_SMOKE_SCRIPT =
  "npm run build && tsc --ignoreConfig --noEmit --target ES2024 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck tests/dist-public-api-smoke.ts && node tests/dist-public-api-smoke.mjs";
export const EXECUTED_TOOLING_SCRIPT_EXTENSIONS = new Set([
  ".cjs",
  ".cjsx",
  ".cts",
  ".ctsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mjsx",
  ".mts",
  ".mtsx",
  ".sh",
  ".ts",
  ".tsx",
]);
export const EXECUTED_TOOLING_CONFIG_FILES = [
  ".prettierrc",
  ".prettierrc.cjs",
  ".prettierrc.cts",
  ".prettierrc.js",
  ".prettierrc.json",
  ".prettierrc.json5",
  ".prettierrc.mjs",
  ".prettierrc.mts",
  ".prettierrc.toml",
  ".prettierrc.ts",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  "package.json",
  "prettier.config.cjs",
  "prettier.config.cts",
  "prettier.config.js",
  "prettier.config.mjs",
  "prettier.config.mts",
  "prettier.config.ts",
  "vite.config.cjs",
  "vite.config.cts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.mts",
  "vite.config.ts",
  "vitest.config.cjs",
  "vitest.config.cts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.mts",
  "vitest.config.ts",
  "vitest.workspace.cjs",
  "vitest.workspace.cts",
  "vitest.workspace.js",
  "vitest.workspace.mjs",
  "vitest.workspace.mts",
  "vitest.workspace.ts",
];
