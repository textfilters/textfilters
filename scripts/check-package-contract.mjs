import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");
const contractPath = join(repoDir, "package-contract.json");
const contract = readJson(contractPath);
const packagesRoot = resolve(repoDir, contract.packagesRoot);
const failures = [];
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const BUILD_SCRIPT_COMMAND = "npm run build";
const TRUSTED_GITHUB_RUNNER = "ubuntu-latest";
const AUDITED_RUNNER_OS = "linux";
const AUDITED_RUNNER_CPU = "x64";
const AUDITED_RUNNER_LIBC = "glibc";
const NPM_PUBLISH_SUBCOMMANDS = new Set(["publish", "pu", "pub", "publ", "publi", "publis"]);
const NOOP_SCRIPT_COMMANDS = new Set(["true", ":"]);
const DEPENDENCY_INSTALL_LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "prepublishOnly",
  "preprepare",
  "prepare",
  "postprepare",
];
const BLOCKED_NPM_CONFIG_KEYS = [
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
const BLOCKED_NPM_CONFIG_ENV_KEYS = new Set(
  [
    ...BLOCKED_NPM_CONFIG_KEYS.map((key) => `npm_config_${key}:`),
    `npm_config_${contract.checkWorkflow.scope}:registry:`,
  ].map((key) => normalizeEnvKeyName(key)),
);
const BLOCKED_AUDITED_NPM_ENV_KEYS = ["BASH_ENV:", "HOME:", "NODE_OPTIONS:"];
const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const NPM_CONFIG_SET_OPTIONS_WITH_VALUE = new Set([
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
const NPM_MANIFEST_MUTATION_SUBCOMMANDS = new Set(["pkg", "version"]);
const ALLOWED_PACKAGE_SCRIPT_NAMES = new Set([
  ...contract.manifest.requiredScriptNames,
  "format",
  "prepack",
]);
const ALLOWED_PRETTIER_PATHS = new Set(["README.md", "docs", "examples", "package.json", "src", "tests"]);
const CHECK_SCRIPT_WITH_BUILD = "npm run lint && npm test && npm run build && npm run smoke:dist && npm run pack:dry-run";
const CHECK_SCRIPT_WITH_SMOKE_BUILD = "npm run lint && npm test && npm run smoke:dist && npm run pack:dry-run";
const PROFANITY_DIST_SMOKE_SCRIPT =
  "npm run build && tsc --ignoreConfig --noEmit --target ES2024 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck tests/dist-public-api-smoke.ts && node tests/dist-public-api-smoke.mjs";
const EXECUTED_TOOLING_SCRIPT_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".mjs", ".mts", ".sh", ".ts", ".tsx"]);
const EXECUTED_TOOLING_CONFIG_FILES = [
  ".prettierrc.cjs",
  ".prettierrc.js",
  ".prettierrc.mjs",
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
];

for (const pkgSpec of contract.packages) {
  const packageDir = join(packagesRoot, pkgSpec.directory);
  checkPackage(pkgSpec, packageDir);
}

if (failures.length > 0) {
  console.error("Package contract drift detected:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Package contract OK for ${contract.packages.length} packages.`);

function checkPackage(pkgSpec, packageDir) {
  const label = pkgSpec.directory;
  const packageJsonPath = join(packageDir, "package.json");
  const releaseConfigPath = join(packageDir, "release-please-config.json");
  const releaseManifestPath = join(packageDir, contract.releaseWorkflow.manifestFile);
  const checkWorkflowPath = join(packageDir, contract.checkWorkflow.path);
  const releaseWorkflowPath = join(packageDir, contract.releaseWorkflow.path);
  const npmrcPath = join(packageDir, ".npmrc");
  const lockfilePaths = contract.manifest.requiredLockfiles.map((lockfile) => join(packageDir, lockfile));
  const npmCiLockfile = npmCiLockfilePath(packageDir);

  if (!existsSync(packageJsonPath)) {
    fail(label, "missing package.json");
    return;
  }

  const pkg = readJson(packageJsonPath);
  expectEqual(label, "package name", pkg.name, pkgSpec.name);
  expectAbsentPrivate(label, pkg.private);
  expectSemver(label, "package version", pkg.version);
  expectEqual(label, "type", pkg.type, contract.manifest.type);
  expectEqual(label, "license", pkg.license, contract.manifest.license);
  expectEqual(label, "sideEffects", pkg.sideEffects, contract.manifest.sideEffects);
  expectEqual(label, "engines.node", pkg.engines?.node, contract.manifest.engines.node);
  expectEqual(label, "packageManager", pkg.packageManager, contract.manifest.packageManager);
  expectEqual(
    label,
    "publishConfig.registry",
    pkg.publishConfig?.registry,
    contract.manifest.publishConfig.registry,
  );
  expectOnlyJsonObjectKeys(label, "publishConfig", pkg.publishConfig, ["registry"]);

  for (const file of contract.manifest.requiredFiles) {
    if (!Array.isArray(pkg.files) || !pkg.files.includes(file)) {
      fail(label, `package files must include ${file}`);
    }
    if (file !== "dist" && !existsSync(join(packageDir, file))) {
      fail(label, `package file entry ${file} must exist`);
    }
  }
  expectNoPackageFileExclusions(label, packageDir, pkg.files);

  if (!lockfilePaths.some((lockfilePath) => existsSync(lockfilePath))) {
    fail(label, `missing one of ${contract.manifest.requiredLockfiles.join(", ")}`);
  }

  for (const scriptName of contract.manifest.requiredScriptNames) {
    if (typeof pkg.scripts?.[scriptName] !== "string") {
      fail(label, `missing script ${scriptName}`);
    } else if (pkg.scripts[scriptName].trim() === "") {
      fail(label, `script ${scriptName} must not be empty`);
    }
  }
  expectDelegatedScriptWork(label, "lint", pkg.scripts?.lint);
  expectDelegatedScriptWork(label, "test", pkg.scripts?.test);

  for (const [scriptName, expected] of Object.entries(contract.manifest.requiredScripts)) {
    expectEqual(label, `script ${scriptName}`, pkg.scripts?.[scriptName], expected);
  }

  for (const command of contract.manifest.checkScriptMustInclude) {
    expectScriptCommand(label, "check", pkg.scripts?.check, command);
  }
  expectScriptCommandOrder(label, "check", pkg.scripts?.check, contract.manifest.checkScriptMustInclude);
  expectCheckScriptOnlyAuditedCommands(label, pkg.scripts?.check);
  expectNoExitBeforeScriptCommands(label, "check", pkg.scripts?.check, contract.manifest.checkScriptMustInclude);
  expectAuditedPackageScriptTemplates(label, pkg.scripts);
  expectNoUnsupportedPackageScriptSyntax(label, pkg.scripts);
  expectNoPublishInScripts(label, packageDir, pkg.scripts);
  expectNoPublishEnvMutationInScripts(label, pkg.scripts);
  expectNoExecutedPackageToolingMutations(label, packageDir);
  expectNoPublishLifecycleScripts(label, pkg.scripts);
  expectNoWorkspaces(label, pkg);
  expectAuditableNpmCiLockfile(label, npmCiLockfile);
  expectNoNpmBinaryShadowing(label, pkg, npmCiLockfile);
  expectNoLocalDependencySpecs(label, pkg, npmCiLockfile);
  expectNoDependencyInstallLifecycleScripts(label, npmCiLockfile);
  expectSafeNpmConfig(label, npmrcPath);

  if (contract.manifest.buildMustRunBeforeDistSmoke) {
    expectBuildBeforeDistSmoke(label, pkg.scripts);
  }

  for (const [dependency, expected] of Object.entries(contract.manifest.commonDevDependencies)) {
    expectEqual(label, `devDependency ${dependency}`, pkg.devDependencies?.[dependency], expected);
  }

  const allowedExtraDevDependencies = new Set(pkgSpec.allowedExtraDevDependencies ?? []);
  for (const dependency of Object.keys(pkg.devDependencies ?? {})) {
    if (
      !(dependency in contract.manifest.commonDevDependencies) &&
      !allowedExtraDevDependencies.has(dependency)
    ) {
      fail(label, `unexpected devDependency ${dependency}`);
    }
  }

  checkWorkflow(label, checkWorkflowPath);
  checkReleaseWorkflow(label, releaseWorkflowPath);
  checkPublishCommandScope(label, packageDir, releaseWorkflowPath);
  checkReleaseConfig(label, releaseConfigPath, pkgSpec.name);
  checkReleaseManifest(label, releaseManifestPath, pkg.version);
}

function checkWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;
  expectNoYamlAnchorsOrAliases(label, workflowPath, workflow);
  expectNoBlockedNpmConfigEnvKeys(label, workflowPath, workflow);
  const onBlock = expectBlock(label, workflowPath, workflow, "on:", 0);
  const pullRequestBlock = expectBlock(label, workflowPath, onBlock, "pull_request:", 2);
  const pushBlock = expectBlock(label, workflowPath, onBlock, "push:", 2);
  const branchesBlock = expectBlock(label, workflowPath, pushBlock, "branches:", 4);
  const checkJob = expectJobBlockContainingRun(
    label,
    workflowPath,
    workflow,
    contract.checkWorkflow.checkCommand,
  );
  const checkoutStep = expectSingleStepWithUses(label, workflowPath, checkJob, contract.checkWorkflow.checkoutAction);
  const installStep = expectStepWithRun(
    label,
    workflowPath,
    checkJob,
    contract.checkWorkflow.installCommand,
  );
  const checkStep = expectStepWithRun(label, workflowPath, checkJob, contract.checkWorkflow.checkCommand);
  const setupNodeStep = expectSingleStepWithUses(
    label,
    workflowPath,
    checkJob,
    contract.checkWorkflow.setupNodeAction,
  );

  expectWorkflowName(label, workflowPath, workflow, contract.checkWorkflow.name);
  expectWorkflowJobs(label, workflowPath, workflow, ["check:"]);
  expectEventKeys(label, workflowPath, onBlock, ["pull_request:", "push:"]);
  expectUnfilteredEvent(label, workflowPath, pullRequestBlock, "pull_request");
  expectPushBranchesOnly(label, workflowPath, pushBlock);
  expectExactSteps(label, workflowPath, checkJob, "check", [
    checkoutStep,
    setupNodeStep,
    installStep,
    checkStep,
  ]);
  expectBlockingJob(label, workflowPath, checkJob, "check");
  expectJobRunner(label, workflowPath, checkJob, "check");
  expectBlockLine(label, workflowPath, branchesBlock, "- main", 6);
  expectSingleListEntry(label, workflowPath, branchesBlock, "- main", 6);
  expectEffectivePermissions(label, workflowPath, workflow, checkJob, ["contents: read", "packages: read"]);
  expectNoStepChildBlock(label, workflowPath, checkoutStep, "with:");
  expectBlockingStep(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectEnvAvailable(label, workflowPath, checkJob, installStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectNoNpmConfigEnvOverrides(
    label,
    workflowPath,
    workflow,
    checkJob,
    installStep,
    contract.checkWorkflow.installCommand,
  );
  expectNoNpmConfigEnvOverrides(
    label,
    workflowPath,
    workflow,
    checkJob,
    checkStep,
    contract.checkWorkflow.checkCommand,
  );
  expectBlockingStep(label, workflowPath, installStep, contract.checkWorkflow.installCommand);
  expectBlockingStep(label, workflowPath, checkStep, contract.checkWorkflow.checkCommand);
  expectPackageRootStep(label, workflowPath, workflow, checkJob, installStep, contract.checkWorkflow.installCommand);
  expectPackageRootStep(label, workflowPath, workflow, checkJob, checkStep, contract.checkWorkflow.checkCommand);

  expectStepOrder(
    label,
    workflowPath,
    checkJob,
    checkoutStep,
    installStep,
    `checkout before ${contract.checkWorkflow.installCommand}`,
  );
  expectStepOrder(
    label,
    workflowPath,
    checkJob,
    setupNodeStep,
    installStep,
    `setup-node before ${contract.checkWorkflow.installCommand}`,
  );
  expectStepOrder(
    label,
    workflowPath,
    checkJob,
    installStep,
    checkStep,
    `${contract.checkWorkflow.installCommand} before ${contract.checkWorkflow.checkCommand}`,
  );
}

function checkReleaseWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;
  expectNoYamlAnchorsOrAliases(label, workflowPath, workflow);
  expectNoBlockedNpmConfigEnvKeys(label, workflowPath, workflow);
  const onBlock = expectBlock(label, workflowPath, workflow, "on:", 0);
  const pushBlock = expectBlock(label, workflowPath, onBlock, "push:", 2);
  const branchesBlock = expectBlock(label, workflowPath, pushBlock, "branches:", 4);
  const releaseJob = expectJobBlock(label, workflowPath, workflow, "release-please");
  const releaseOutputsBlock = expectBlock(label, workflowPath, releaseJob, "outputs:", 4);
  const releaseActionStep = expectSingleStepWithUses(
    label,
    workflowPath,
    releaseJob,
    contract.releaseWorkflow.releaseAction,
  );
  const publishJob = expectSingleJobBlockContainingRun(
    label,
    workflowPath,
    workflow,
    contract.releaseWorkflow.publishCommand,
  );
  const checkoutStep = expectSingleStepWithUses(label, workflowPath, publishJob, contract.checkWorkflow.checkoutAction);
  const setupNodeStep = expectSingleStepWithUses(
    label,
    workflowPath,
    publishJob,
    contract.checkWorkflow.setupNodeAction,
  );
  const installStep = expectStepWithRun(
    label,
    workflowPath,
    publishJob,
    contract.checkWorkflow.installCommand,
  );
  const checkStep = expectStepWithRun(label, workflowPath, publishJob, contract.checkWorkflow.checkCommand);
  const publishStep = expectStepWithRun(
    label,
    workflowPath,
    publishJob,
    contract.releaseWorkflow.publishCommand,
  );

  expectWorkflowName(label, workflowPath, workflow, contract.releaseWorkflow.name);
  expectWorkflowJobs(label, workflowPath, workflow, ["release-please:", "publish:"]);
  expectEventKeys(label, workflowPath, onBlock, ["push:"]);
  expectSinglePublishCommandText(label, workflowPath, workflow);
  expectSingleActionText(label, workflowPath, workflow, contract.releaseWorkflow.releaseAction);
  expectPushBranchesOnly(label, workflowPath, pushBlock);
  expectExactSteps(label, workflowPath, releaseJob, "release-please", [releaseActionStep]);
  expectExactSteps(label, workflowPath, publishJob, "publish", [
    checkoutStep,
    setupNodeStep,
    installStep,
    checkStep,
    publishStep,
  ]);
  expectBlockingJob(label, workflowPath, releaseJob, "release-please");
  expectBlockingJob(
    label,
    workflowPath,
    publishJob,
    "publish",
    contract.releaseWorkflow.publishCondition,
    contract.releaseWorkflow.publishNeeds,
  );
  expectJobRunner(label, workflowPath, releaseJob, "release-please");
  expectJobRunner(label, workflowPath, publishJob, "publish");
  expectBlockLine(label, workflowPath, branchesBlock, "- main", 6);
  expectSingleListEntry(label, workflowPath, branchesBlock, "- main", 6);
  expectJobPermissions(label, workflowPath, releaseJob, "release-please", [
    "contents: write",
    "issues: write",
    "pull-requests: write",
  ]);
  expectBlockLine(label, workflowPath, releaseOutputsBlock, contract.releaseWorkflow.releaseCreatedOutput, 6);
  expectBlockingStep(label, workflowPath, releaseActionStep, contract.releaseWorkflow.releaseAction);
  expectStepLine(label, workflowPath, releaseActionStep, `id: ${contract.releaseWorkflow.releaseStepId}`);
  expectStepWithInput(label, workflowPath, releaseActionStep, "token", contract.releaseWorkflow.token);
  expectStepWithInput(label, workflowPath, releaseActionStep, "config-file", contract.releaseWorkflow.configFile);
  expectStepWithInput(label, workflowPath, releaseActionStep, "manifest-file", contract.releaseWorkflow.manifestFile);
  expectStepInputsOnly(label, workflowPath, releaseActionStep, [
    "token:",
    "config-file:",
    "manifest-file:",
  ]);
  expectStepWithoutInput(label, workflowPath, releaseActionStep, "skip-github-release");
  expectStepWithoutInput(label, workflowPath, releaseActionStep, "skip-github-pull-request");
  expectStepWithoutInput(label, workflowPath, releaseActionStep, "release-type");
  expectJobLine(label, workflowPath, publishJob, `needs: ${contract.releaseWorkflow.publishNeeds}`, 4);
  expectPublishGate(label, workflowPath, publishJob, publishStep);
  expectJobPermissions(label, workflowPath, publishJob, "publish", ["contents: read", "packages: write"]);
  expectNoStepChildBlock(label, workflowPath, checkoutStep, "with:");
  expectBlockingStep(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectEnvAvailable(label, workflowPath, publishJob, installStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectEnvAvailable(label, workflowPath, publishJob, publishStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
  for (const envName of BLOCKED_NPM_CONFIG_ENV_KEYS) {
    expectNoEnvKey(label, workflowPath, workflow, publishJob, publishStep, `${envName}:`);
  }
  expectNoNpmConfigEnvOverrides(
    label,
    workflowPath,
    workflow,
    publishJob,
    installStep,
    contract.checkWorkflow.installCommand,
  );
  expectNoNpmConfigEnvOverrides(
    label,
    workflowPath,
    workflow,
    publishJob,
    checkStep,
    contract.checkWorkflow.checkCommand,
  );
  expectBlockingStep(label, workflowPath, installStep, contract.checkWorkflow.installCommand);
  expectBlockingStep(label, workflowPath, checkStep, contract.checkWorkflow.checkCommand);
  expectBlockingStep(
    label,
    workflowPath,
    publishStep,
    contract.releaseWorkflow.publishCommand,
    contract.releaseWorkflow.publishCondition,
  );
  expectPackageRootStep(label, workflowPath, workflow, publishJob, installStep, contract.checkWorkflow.installCommand);
  expectPackageRootStep(label, workflowPath, workflow, publishJob, checkStep, contract.checkWorkflow.checkCommand);
  expectPackageRootStep(label, workflowPath, workflow, publishJob, publishStep, contract.releaseWorkflow.publishCommand);

  expectStepOrder(
    label,
    workflowPath,
    publishJob,
    checkoutStep,
    installStep,
    `checkout before ${contract.checkWorkflow.installCommand}`,
  );
  expectStepOrder(
    label,
    workflowPath,
    publishJob,
    setupNodeStep,
    installStep,
    `setup-node before ${contract.checkWorkflow.installCommand}`,
  );
  expectStepOrder(
    label,
    workflowPath,
    publishJob,
    installStep,
    checkStep,
    `${contract.checkWorkflow.installCommand} before ${contract.checkWorkflow.checkCommand}`,
  );
  expectStepOrder(
    label,
    workflowPath,
    publishJob,
    checkStep,
    publishStep,
    `${contract.checkWorkflow.checkCommand} before ${contract.releaseWorkflow.publishCommand}`,
  );
}

function checkReleaseConfig(label, releaseConfigPath, packageName) {
  if (!existsSync(releaseConfigPath)) {
    fail(label, "missing release-please-config.json");
    return;
  }

  const config = readJson(releaseConfigPath);
  expectReleasePleaseConfigKeys(label, config);
  expectOnlyPackageConfig(label, config);
  if (config["skip-github-release"] === true) {
    fail(label, "release-please skip-github-release must not be true");
  }
  if (config.packages?.["."]?.["skip-github-release"] === true) {
    fail(label, "release-please package skip-github-release must not be true");
  }
  if (config["skip-github-pull-request"] === true) {
    fail(label, "release-please skip-github-pull-request must not be true");
  }
  if (config.packages?.["."]?.["skip-github-pull-request"] === true) {
    fail(label, "release-please package skip-github-pull-request must not be true");
  }
  expectEqual(
    label,
    "release-please include-component-in-tag",
    config["include-component-in-tag"],
    contract.releasePleaseConfig.includeComponentInTag,
  );
  expectEqual(
    label,
    "release-please package include-component-in-tag",
    config.packages?.["."]?.["include-component-in-tag"] ?? contract.releasePleaseConfig.includeComponentInTag,
    contract.releasePleaseConfig.includeComponentInTag,
  );
  expectEqual(
    label,
    "release-please package release-type",
    config.packages?.["."]?.["release-type"],
    contract.releasePleaseConfig.releaseType,
  );
  expectEqual(
    label,
    "release-please package name",
    config.packages?.["."]?.["package-name"],
    packageName,
  );
}

function checkReleaseManifest(label, releaseManifestPath, packageVersion) {
  if (!existsSync(releaseManifestPath)) {
    fail(label, `missing ${contract.releaseWorkflow.manifestFile}`);
    return;
  }

  const manifest = readJson(releaseManifestPath);
  expectSemver(label, "release-please manifest .", manifest["."]);
  expectEqual(label, "release-please manifest .", manifest["."], packageVersion);
}

function checkPublishCommandScope(label, packageDir, releaseWorkflowPath) {
  const workflowsDir = join(packageDir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return;

  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/u.test(entry.name)) continue;

    const workflowPath = join(workflowsDir, entry.name);
    if (workflowPath === releaseWorkflowPath) continue;

    const workflow = stripYamlComments(readFileSync(workflowPath, "utf8"));
    expectNoYamlAnchorsOrAliases(label, workflowPath, workflow);
    expectNoUnsupportedWorkflowCommands(label, workflowPath, workflow);
    if (hasNpmPublishCommand(workflow)) {
      fail(
        label,
        `${relativePackagePath(workflowPath)} must not include npm publish`,
      );
    }
    if (workflowUsesReleasePleaseAction(workflow)) {
      fail(
        label,
        `${relativePackagePath(workflowPath)} must not include ${contract.releaseWorkflow.releaseAction}`,
      );
    }
    if (workflowHasPackageWritePermission(workflow)) {
      fail(label, `${relativePackagePath(workflowPath)} must not grant packages: write`);
    }
    if (workflowUsesPublishAction(workflow)) {
      fail(label, `${relativePackagePath(workflowPath)} must not use publish-capable actions`);
    }
    if (hasLocalWorkflowExecution(workflow)) {
      fail(label, `${relativePackagePath(workflowPath)} must not invoke local workflow scripts or actions`);
    }
  }
}

function expectNoUnsupportedWorkflowCommands(label, path, workflow) {
  if (hasShellCommandSubstitution(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use shell command substitution`);
  }
  if (hasShellFunctionDefinition(workflow)) {
    fail(label, `${relativePackagePath(path)} must not define shell functions`);
  }
  if (hasShellAliasDefinition(workflow)) {
    fail(label, `${relativePackagePath(path)} must not define shell aliases`);
  }
  if (textFeedsShellInterpreterOnStdin(workflow)) {
    fail(label, `${relativePackagePath(path)} must not feed scripts to shell interpreters on stdin`);
  }
  if (scriptUsesChildProcessExecution(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use child_process command execution`);
  }
  if (textUsesNonShellInterpreterEval(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use non-shell interpreter eval snippets`);
  }
  if (scriptUsesNpmExec(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use npm exec`);
  }
  if (scriptUsesXargs(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use xargs command execution`);
  }
  if (scriptMutatesPackageManifest(workflow)) {
    fail(label, `${relativePackagePath(path)} must not mutate package.json`);
  }
  if (textHasBlockedNpmConfigEnvKey(workflow)) {
    fail(label, `${relativePackagePath(path)} must not set publish-altering npm config env`);
  }
}

function expectNoBlockedNpmConfigEnvKeys(label, path, workflow) {
  if (textHasBlockedNpmConfigEnvKey(workflow)) {
    fail(label, `${relativePackagePath(path)} must not set publish-altering npm config env`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(label, path) {
  if (!existsSync(path)) {
    fail(label, `missing ${relativePackagePath(path)}`);
    return "";
  }
  return stripYamlComments(readFileSync(path, "utf8"));
}

function expectEqual(label, name, actual, expected) {
  if (actual !== expected) {
    fail(label, `${name} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectString(label, name, actual) {
  if (typeof actual !== "string" || actual.length === 0) {
    fail(label, `${name} must be a non-empty string`);
  }
}

function expectSemver(label, name, actual) {
  expectString(label, name, actual);
  if (typeof actual === "string" && !SEMVER_PATTERN.test(actual)) {
    fail(label, `${name} must be a valid semver version`);
  }
}

function expectAbsentPrivate(label, actual) {
  if (actual === true) {
    fail(label, "package must not be private");
  }
}

function expectNoPackageFileExclusions(label, packageDir, files) {
  for (const file of files ?? []) {
    if (typeof file === "string" && file.startsWith("!")) {
      fail(label, `package files must not include exclusion ${file}`);
    }
  }

  for (const ignoreFile of findDistIgnoreFiles(join(packageDir, "dist"))) {
    fail(label, `dist must not include ${ignoreFile}`);
  }
}

function findDistIgnoreFiles(distDir) {
  if (!existsSync(distDir)) return [];

  const ignoreFiles = [];
  for (const entry of readdirSync(distDir, { withFileTypes: true })) {
    const entryPath = join(distDir, entry.name);
    if (entry.isDirectory()) {
      ignoreFiles.push(...findDistIgnoreFiles(entryPath));
    } else if (entry.name === ".npmignore" || entry.name === ".gitignore") {
      ignoreFiles.push(entry.name);
    }
  }
  return ignoreFiles;
}

function expectOnlyPackageConfig(label, config) {
  const packageKeys = Object.keys(config.packages ?? {});
  if (packageKeys.length !== 1 || packageKeys[0] !== ".") {
    fail(label, 'release-please packages must include only "."');
  }
}

function expectReleasePleaseConfigKeys(label, config) {
  expectOnlyJsonObjectKeys(label, "release-please config", config, [
    "$schema",
    "include-component-in-tag",
    "packages",
  ]);

  for (const packageConfig of Object.values(config.packages ?? {})) {
    expectOnlyJsonObjectKeys(label, "release-please package config", packageConfig, [
      "include-component-in-tag",
      "package-name",
      "release-type",
    ]);
  }
}

function expectOnlyJsonObjectKeys(label, name, value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      fail(label, `${name} must not include ${key}`);
    }
  }
}

function expectScriptCommand(label, scriptName, script, command) {
  const commands = splitScriptCommands(script);
  if (!commands.includes(command)) {
    fail(label, `script ${scriptName} must include command ${command}`);
  }
}

function expectScriptCommandOrder(label, scriptName, script, expectedCommands) {
  const commands = splitScriptCommands(script);
  let previousIndex = -1;

  for (const command of expectedCommands) {
    const commandIndex = commands.indexOf(command);
    if (commandIndex === -1) continue;
    if (commandIndex < previousIndex) {
      fail(label, `script ${scriptName} must keep ${expectedCommands.join(" before ")}`);
      return;
    }
    previousIndex = commandIndex;
  }
}

function expectCheckScriptOnlyAuditedCommands(label, script) {
  const commandParts = splitScriptCommandParts(script);
  const commands = commandParts.map((part) => part.command);
  const expectedDelegated = contract.manifest.checkScriptMustInclude;
  const smokeIndex = expectedDelegated.indexOf("npm run smoke:dist");
  const expectedDirect =
    smokeIndex === -1
      ? expectedDelegated
      : [
          ...expectedDelegated.slice(0, smokeIndex),
          BUILD_SCRIPT_COMMAND,
          ...expectedDelegated.slice(smokeIndex),
        ];

  if (!arraysEqual(commands, expectedDelegated) && !arraysEqual(commands, expectedDirect)) {
    fail(label, "script check must contain only audited commands");
    return;
  }

  if (commandParts.slice(1).some((part) => part.separator !== "&&")) {
    fail(label, "script check must join audited commands with &&");
  }
}

function expectBuildBeforeDistSmoke(label, scripts) {
  const checkCommands = splitScriptCommands(scripts?.check);
  const smokeCommandParts = splitScriptCommandParts(scripts?.["smoke:dist"]);
  const smokeCommands = smokeCommandParts.map((part) => part.command);
  const checkBuildIndex = checkCommands.indexOf("npm run build");
  const checkSmokeIndex = checkCommands.indexOf("npm run smoke:dist");

  expectDistSmokeWork(label, smokeCommandParts);

  if (checkBuildIndex !== -1 && checkSmokeIndex !== -1 && checkBuildIndex < checkSmokeIndex) {
    return;
  }

  if (
    checkSmokeIndex !== -1 &&
    smokeCommands.indexOf("npm run build") === 0 &&
    smokeCommands.length > 1 &&
    smokeCommandParts[1]?.separator === "&&"
  ) {
    return;
  }

  fail(label, "check script must run or delegate npm run build before smoke:dist");
}

function expectDistSmokeWork(label, smokeCommandParts) {
  const smokeCommands = smokeCommandParts.map((part) => part.command);
  if (smokeCommands.length === 0) return;
  if (smokeCommandParts.slice(1).some((part) => part.separator === "||")) {
    fail(label, "smoke:dist script must not short-circuit dist smoke work");
  }
  if (smokeCommandParts.some((part) => part.separator === "&")) {
    fail(label, "smoke:dist script must not background dist smoke work");
  }
  if (smokeCommands.some((command) => isSuccessfulExitCommand(command))) {
    fail(label, "smoke:dist script must not exit before dist smoke work");
    return;
  }
  if (smokeCommands.some((command) => NOOP_SCRIPT_COMMANDS.has(command))) {
    fail(label, "smoke:dist script must not be a no-op");
    return;
  }
  if (smokeCommands.every((command) => command === "npm run build")) {
    fail(label, "smoke:dist script must do more than build");
  }
}

function expectDelegatedScriptWork(label, scriptName, script) {
  const commandParts = splitScriptCommandParts(script);
  const commands = commandParts.map((part) => part.command);
  if (commands.length === 0) return;

  if (commandParts.slice(1).some((part) => part.separator === "||")) {
    fail(label, `script ${scriptName} must not short-circuit delegated work`);
  }
  if (commands.some((command) => isSuccessfulExitCommand(command))) {
    fail(label, `script ${scriptName} must not exit before work`);
    return;
  }
  if (commands.some((command) => NOOP_SCRIPT_COMMANDS.has(command))) {
    fail(label, `script ${scriptName} must not be a no-op`);
  }
}

function expectAuditedPackageScriptTemplates(label, scripts) {
  for (const scriptName of Object.keys(scripts ?? {})) {
    if (!ALLOWED_PACKAGE_SCRIPT_NAMES.has(scriptName)) {
      fail(label, `script ${scriptName} must be one of the audited package scripts`);
    }
  }

  expectPrettierScriptTemplate(label, "lint", scripts?.lint, "--check");
  if (typeof scripts?.format === "string") {
    expectPrettierScriptTemplate(label, "format", scripts.format, "--write");
  }
  expectVitestScriptTemplate(label, scripts?.test);
  expectCheckScriptTemplate(label, scripts?.check);
  expectDistSmokeScriptTemplate(label, scripts?.["smoke:dist"]);
}

function expectPrettierScriptTemplate(label, scriptName, script, mode) {
  const tokens = auditedSimpleScriptTokens(script);
  if (!tokens) {
    fail(label, `script ${scriptName} must match the audited prettier ${mode} template`);
    return;
  }
  if (tokens.length === 0) return;

  const paths = tokens.slice(1, -1);
  if (
    tokens[0] !== "prettier" ||
    tokens.at(-1) !== mode ||
    paths.length === 0 ||
    paths.some((path) => !ALLOWED_PRETTIER_PATHS.has(path))
  ) {
    fail(label, `script ${scriptName} must match the audited prettier ${mode} template`);
  }
}

function expectVitestScriptTemplate(label, script) {
  const tokens = auditedSimpleScriptTokens(script);
  if (!tokens) {
    fail(label, "script test must match the audited vitest template");
    return;
  }
  if (tokens.length === 0) return;

  if (tokens[0] !== "vitest" || tokens[1] !== "run") {
    fail(label, "script test must match the audited vitest template");
    return;
  }

  let index = 2;
  if (tokens[index] === "tests") {
    index += 1;
  }
  if (tokens[index] === "--maxWorkers" && tokens[index + 1] === "4") {
    index += 2;
  }
  if (tokens[index] === "--testTimeout" && tokens[index + 1] === "15000") {
    index += 2;
  }
  if (index !== tokens.length) {
    fail(label, "script test must match the audited vitest template");
  }
}

function expectCheckScriptTemplate(label, script) {
  if (typeof script !== "string") return;
  if (script !== CHECK_SCRIPT_WITH_BUILD && script !== CHECK_SCRIPT_WITH_SMOKE_BUILD) {
    fail(label, "script check must match an audited check template");
  }
}

function expectDistSmokeScriptTemplate(label, script) {
  if (typeof script !== "string" || script.trim() === "") return;
  if (script === PROFANITY_DIST_SMOKE_SCRIPT) return;

  const tokens = auditedSimpleScriptTokens(script);
  if (!tokens) {
    fail(label, "script smoke:dist must match an audited dist smoke template");
    return;
  }
  const evalText = tokens[3] ?? "";
  if (
    tokens.length === 4 &&
    tokens[0] === "node" &&
    tokens[1] === "--input-type=module" &&
    tokens[2] === "--eval" &&
    nodeEvalUsesOnlyBuiltDistEntrypoint(evalText)
  ) {
    return;
  }

  fail(label, "script smoke:dist must match an audited dist smoke template");
}

function auditedSimpleScriptTokens(script) {
  if (typeof script !== "string" || script.trim() === "") return [];
  const parts = splitScriptCommandParts(script);
  if (parts.length !== 1 || parts[0]?.separator) return null;
  const tokens = shellTokens(parts[0].command).map((token) => shellWordValue(token));
  return tokens.some((token) => isShellBoundaryToken(token) || isShellRedirectionToken(token) || token === "!")
    ? null
    : tokens;
}

function nodeEvalUsesOnlyBuiltDistEntrypoint(scriptText) {
  if (!scriptText.includes("import('./dist/index.js')") && !scriptText.includes('import("./dist/index.js")')) {
    return false;
  }
  return localScriptDependencySpecifiers(scriptText).every((specifier) => specifier === "./dist/index.js");
}

function isSuccessfulExitCommand(command) {
  return command === "exit" || command === "exit 0";
}

function expectText(label, path, text, expected) {
  if (!text.includes(expected)) {
    fail(label, `${relativePackagePath(path)} must include ${expected}`);
  }
}

function expectWorkflowName(label, path, workflow, name) {
  if (!hasLineAtIndent(workflow, `name: ${name}`, 0)) {
    fail(label, `${relativePackagePath(path)} workflow name must be ${name}`);
  }
}

function expectStepLine(label, path, stepBlock, expected) {
  if (!hasTopLevelStepLine(stepBlock, expected)) {
    fail(label, `${relativePackagePath(path)} step must include exact ${expected}`);
  }
}

function expectStepWithInput(label, path, stepBlock, inputName, expectedValue) {
  const expected = `${inputName}: ${expectedValue}`;
  const withBlock = getStepChildBlock(stepBlock, "with:");
  const inputIndent = stepBaseIndent(stepBlock) + 4;

  if (!withBlock || !hasLineAtIndent(withBlock, expected, inputIndent)) {
    fail(label, `${relativePackagePath(path)} step with block must include ${expected}`);
  }
}

function expectStepWithoutInput(label, path, stepBlock, inputName) {
  const withBlock = getStepChildBlock(stepBlock, "with:");
  const inputIndent = stepBaseIndent(stepBlock) + 4;

  if (withBlock && hasKeyAtIndent(withBlock, `${inputName}:`, inputIndent)) {
    fail(label, `${relativePackagePath(path)} step with block must not include ${inputName}`);
  }
}

function expectStepInputsOnly(label, path, stepBlock, allowedInputKeys) {
  const withBlock = getStepChildBlock(stepBlock, "with:");
  const inputIndent = stepBaseIndent(stepBlock) + 4;
  const inputKeys = blockEntriesAtIndent(withBlock, inputIndent).map((entry) => yamlKey(entry));

  for (const inputKey of inputKeys) {
    if (!allowedInputKeys.includes(inputKey)) {
      fail(label, `${relativePackagePath(path)} step with block must not include ${inputKey.slice(0, -1)}`);
    }
  }
}

function expectNoStepChildBlock(label, path, stepBlock, header) {
  if (getStepChildBlock(stepBlock, header) || hasTopLevelStepKey(stepBlock, header)) {
    fail(label, `${relativePackagePath(path)} step must not include ${header}`);
  }
}

function expectJobLine(label, path, jobBlock, expected, indent) {
  if (!hasLineAtIndent(jobBlock, expected, indent)) {
    fail(label, `${relativePackagePath(path)} job must include ${expected}`);
  }
}

function expectBlockLine(label, path, block, expected, indent) {
  if (!hasLineAtIndent(block, expected, indent)) {
    fail(label, `${relativePackagePath(path)} block must include exact ${expected}`);
  }
}

function expectSingleListEntry(label, path, block, expected, indent) {
  const expectedEntry = expected.startsWith("- ") ? expected.slice(2) : expected;
  const entries = block
    .split("\n")
    .filter((line) => countIndent(line) === indent && line.trimStart().startsWith("- "));

  if (entries.length !== 1 || normalizedYamlLine(entries[0]) !== expectedEntry) {
    fail(label, `${relativePackagePath(path)} block must include only ${expected}`);
  }
}

function expectEffectivePermissions(label, path, workflow, jobBlock, expectedPermissions) {
  const hasJobPermissions = hasKeyAtIndent(jobBlock, "permissions:", 4);
  const permissionBlock = hasJobPermissions
    ? getOptionalBlock(jobBlock, "permissions:", 4)
    : getOptionalBlock(workflow, "permissions:", 0);
  const permissionIndent = hasJobPermissions ? 6 : 2;
  const actualPermissions = blockEntriesAtIndent(permissionBlock, permissionIndent);

  for (const permission of expectedPermissions) {
    if (!actualPermissions.includes(permission)) {
      fail(label, `${relativePackagePath(path)} job permissions must include ${permission}`);
    }
  }

  for (const permission of actualPermissions) {
    if (!expectedPermissions.includes(permission)) {
      fail(label, `${relativePackagePath(path)} job permissions must not include ${permission}`);
    }
  }
}

function expectJobPermissions(label, path, jobBlock, jobName, expectedPermissions) {
  const permissionBlock = expectBlock(label, path, jobBlock, "permissions:", 4);
  const actualPermissions = blockEntriesAtIndent(permissionBlock, 6);

  for (const permission of expectedPermissions) {
    if (!actualPermissions.includes(permission)) {
      fail(label, `${relativePackagePath(path)} ${jobName} job permissions must include ${permission}`);
    }
  }

  for (const permission of actualPermissions) {
    if (!expectedPermissions.includes(permission)) {
      fail(label, `${relativePackagePath(path)} ${jobName} job permissions must not include ${permission}`);
    }
  }
}

function expectPublishGate(label, path, publishJob, publishStep) {
  const condition = `if: ${contract.releaseWorkflow.publishCondition}`;
  const jobCondition = jobTopLevelValue(publishJob, "if:", 4);

  if (jobCondition && jobCondition !== contract.releaseWorkflow.publishCondition) {
    fail(label, `${relativePackagePath(path)} publish job if must be ${contract.releaseWorkflow.publishCondition}`);
    return;
  }
  if (jobCondition === contract.releaseWorkflow.publishCondition || hasTopLevelStepLine(publishStep, condition)) {
    return;
  }

  fail(label, `${relativePackagePath(path)} publish job or publish step must include ${condition}`);
}

function expectEnvAvailable(label, path, jobBlock, stepBlock, envLine) {
  const stepEnvBlock = getStepChildBlock(stepBlock, "env:");
  const stepEnvIndent = stepBaseIndent(stepBlock) + 4;
  const envName = envLine.slice(0, envLine.indexOf(":") + 1);

  if (stepInlineEnvHasKey(stepBlock, envName)) {
    fail(label, `${relativePackagePath(path)} step must not override ${envName} incorrectly`);
    return;
  }

  if (stepEnvBlock && hasKeyAtIndent(stepEnvBlock, envName, stepEnvIndent)) {
    if (hasLineAtIndent(stepEnvBlock, envLine, stepEnvIndent)) {
      return;
    }
    fail(label, `${relativePackagePath(path)} step must not override ${envName} incorrectly`);
    return;
  }

  if (hasEnvLine(jobBlock, envLine, 4)) {
    return;
  }

  fail(label, `${relativePackagePath(path)} step must have ${envLine} available`);
}

function expectNoEnvKey(label, path, workflow, jobBlock, stepBlock, envName) {
  if (hasEnvKey(workflow, envName, 0) || hasEnvKey(jobBlock, envName, 4) || hasStepEnvKey(stepBlock, envName)) {
    fail(label, `${relativePackagePath(path)} publish step must not set ${envName}`);
  }
}

function expectNoNpmConfigEnvOverrides(label, path, workflow, jobBlock, stepBlock, runCommand) {
  for (const envName of BLOCKED_NPM_CONFIG_ENV_KEYS) {
    if (
      hasEnvKey(workflow, `${envName}:`, 0) ||
      hasEnvKey(jobBlock, `${envName}:`, 4) ||
      hasStepEnvKey(stepBlock, `${envName}:`)
    ) {
      fail(label, `${relativePackagePath(path)} ${runCommand} step must not set ${envName}:`);
    }
  }
}

function expectNoYamlAnchorsOrAliases(label, path, workflow) {
  for (const line of workflow.split("\n")) {
    if (yamlLineHasAnchorOrAlias(normalizedYamlLine(line))) {
      fail(label, `${relativePackagePath(path)} must not use YAML anchors or aliases`);
      return;
    }
  }
}

function yamlLineHasAnchorOrAlias(line) {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (quote !== "") continue;
    if ((char === "&" || char === "*") && line[index + 1] !== char && (index === 0 || /\s/u.test(line[index - 1]))) {
      const name = /^[^ \t,[\]{}]+/u.exec(line.slice(index + 1))?.[0] ?? "";
      if (name) {
        return true;
      }
    }
  }

  return false;
}

function expectUnfilteredEvent(label, path, eventBlock, eventName) {
  if (blockHasChildLines(eventBlock) || yamlValue(normalizedYamlLine(eventBlock.split("\n")[0] ?? "")) !== "") {
    fail(label, `${relativePackagePath(path)} ${eventName} event must not be filtered`);
  }
}

function expectPushBranchesOnly(label, path, pushBlock) {
  for (const key of topLevelChildKeys(pushBlock, 4)) {
    if (key !== "branches:") {
      fail(label, `${relativePackagePath(path)} push event must not include ${key}`);
    }
  }
}

function expectBlockingJob(label, path, jobBlock, jobName, allowedCondition = "", allowedNeeds = "") {
  const jobCondition = jobTopLevelValue(jobBlock, "if:", 4);
  if (jobCondition && jobCondition !== allowedCondition) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not be conditional`);
  }
  const jobNeeds = jobTopLevelEntry(jobBlock, "needs:", 4);
  if (jobNeeds.present && (jobNeeds.value === "" || jobNeeds.value !== allowedNeeds)) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not depend on other jobs`);
  }
  const continueOnError = jobTopLevelValue(jobBlock, "continue-on-error:", 4);
  if (continueOnError && continueOnError !== "false") {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not continue on error`);
  }
  if (jobTopLevelEntry(jobBlock, "strategy:", 4).present) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not define strategy`);
  }
  if (jobTopLevelEntry(jobBlock, "container:", 4).present) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not define container`);
  }
  if (jobTopLevelEntry(jobBlock, "services:", 4).present) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not define services`);
  }
}

function expectJobRunner(label, path, jobBlock, jobName) {
  const runner = jobTopLevelValue(jobBlock, "runs-on:", 4);
  if (!runner) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must include runs-on`);
    return;
  }
  if (runner !== TRUSTED_GITHUB_RUNNER) {
    fail(label, `${relativePackagePath(path)} ${jobName} job runs-on must be ${TRUSTED_GITHUB_RUNNER}`);
  }
}

function expectBlockingStep(label, path, stepBlock, runCommand, allowedCondition = "") {
  const stepCondition = stepTopLevelValue(stepBlock, "if:");
  if (stepCondition && stepCondition !== allowedCondition) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not be conditional`);
  }
  const continueOnError = stepTopLevelValue(stepBlock, "continue-on-error:");
  if (continueOnError && continueOnError !== "false") {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not continue on error`);
  }
}

function expectSinglePublishCommandText(label, path, workflow) {
  const publishCommandCount = countNpmPublishCommands(workflow);
  if (publishCommandCount !== 1) {
    fail(label, `${relativePackagePath(path)} must include exactly one npm publish command`);
  }
}

function expectSingleActionText(label, path, workflow, action) {
  const actionCount = workflow
    .split("\n")
    .filter((line) => normalizedYamlLine(line) === `uses: ${action}`)
    .length;

  if (actionCount !== 1) {
    fail(label, `${relativePackagePath(path)} must include exactly one uses: ${action}`);
  }
}

function expectWorkflowJobs(label, path, workflow, expectedJobKeys) {
  const jobsBlock = expectBlock(label, path, workflow, "jobs:", 0);
  const actualJobKeys = topLevelChildKeys(jobsBlock, 2);

  for (const jobKey of expectedJobKeys) {
    if (!actualJobKeys.includes(jobKey)) {
      fail(label, `${relativePackagePath(path)} jobs block must include ${jobKey}`);
    }
  }

  for (const jobKey of actualJobKeys) {
    if (!expectedJobKeys.includes(jobKey)) {
      fail(label, `${relativePackagePath(path)} jobs block must not include ${jobKey}`);
    }
  }
}

function expectEventKeys(label, path, onBlock, expectedKeys) {
  const actualKeys = topLevelChildKeys(onBlock, 2);

  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) {
      fail(label, `${relativePackagePath(path)} on block must include ${key}`);
    }
  }

  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      fail(label, `${relativePackagePath(path)} on block must not include ${key}`);
    }
  }
}

function expectPackageRootStep(label, path, workflow, jobBlock, stepBlock, runCommand) {
  if (workflowDefaultsWorkingDirectory(workflow)) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not inherit a working directory`);
  }
  if (jobDefaultsWorkingDirectory(jobBlock)) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not inherit a working directory`);
  }
  if (workflowDefaultsShell(workflow) || jobDefaultsShell(jobBlock) || stepTopLevelValue(stepBlock, "shell:")) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not override shell`);
  }
  if (hasEnvKey(workflow, "PATH:", 0) || hasEnvKey(jobBlock, "PATH:", 4) || hasStepEnvKey(stepBlock, "PATH:")) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not override PATH`);
  }
  for (const envName of BLOCKED_AUDITED_NPM_ENV_KEYS) {
    if (
      hasEnvKey(workflow, envName, 0) ||
      hasEnvKey(jobBlock, envName, 4) ||
      hasStepEnvKey(stepBlock, envName)
    ) {
      fail(label, `${relativePackagePath(path)} ${runCommand} step must not set ${envName}`);
    }
  }

  const workingDirectory = stepTopLevelValue(stepBlock, "working-directory:");
  if (workingDirectory && workingDirectory !== ".") {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must run at the package root`);
  }
}

function expectBlock(label, path, text, header, indent) {
  if (!text) return "";

  const lines = text.split("\n");
  const start = lines.findIndex((line) => isYamlBlockHeader(line, header, indent));

  if (start === -1) {
    fail(label, `${relativePackagePath(path)} must include ${header}`);
    return "";
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "") continue;
    if (countIndent(lines[index]) <= indent) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join("\n");
}

function getOptionalBlock(text, header, indent) {
  if (!text) return "";

  const lines = text.split("\n");
  const start = lines.findIndex((line) => isYamlBlockHeader(line, header, indent));

  if (start === -1) {
    return "";
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "") continue;
    if (countIndent(lines[index]) <= indent) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join("\n");
}

function expectJobBlock(label, path, workflow, jobName) {
  const jobsBlock = expectBlock(label, path, workflow, "jobs:", 0);
  return expectBlock(label, path, jobsBlock, `${jobName}:`, 2);
}

function expectJobBlockContainingRun(label, path, workflow, runCommand) {
  const jobsBlock = expectBlock(label, path, workflow, "jobs:", 0);
  const jobBlocks = extractNestedBlocks(jobsBlock, 2);
  const jobBlock = jobBlocks.find((block) =>
    extractStepBlocks(block).some((stepBlock) => stepRunCommand(stepBlock) === runCommand),
  );

  if (!jobBlock) {
    fail(label, `${relativePackagePath(path)} must include run: ${runCommand} in a job`);
    return "";
  }

  return jobBlock;
}

function expectSingleJobBlockContainingRun(label, path, workflow, runCommand) {
  const jobsBlock = expectBlock(label, path, workflow, "jobs:", 0);
  const jobBlocks = extractNestedBlocks(jobsBlock, 2);
  const matchingJobs = jobBlocks.filter((block) =>
    extractStepBlocks(block).some((stepBlock) => stepRunCommand(stepBlock) === runCommand),
  );
  const publishCommandCount = matchingJobs.reduce(
    (count, block) =>
      count +
      extractStepBlocks(block).filter((stepBlock) => stepRunCommand(stepBlock) === runCommand).length,
    0,
  );

  if (matchingJobs.length === 0) {
    fail(label, `${relativePackagePath(path)} must include run: ${runCommand} in a job`);
    return "";
  }
  if (publishCommandCount !== 1) {
    fail(label, `${relativePackagePath(path)} must include exactly one run: ${runCommand} step`);
  }

  return matchingJobs[0];
}

function expectStepWithRun(label, path, jobBlock, runCommand) {
  const stepBlocks = extractStepBlocks(jobBlock);
  const stepBlock = stepBlocks.find((block) => stepRunCommand(block) === runCommand);

  if (!stepBlock) {
    fail(label, `${relativePackagePath(path)} must include exact run: ${runCommand} in a step`);
    return "";
  }

  return stepBlock;
}

function expectStepWithUses(label, path, jobBlock, usesAction) {
  const stepBlocks = extractStepBlocks(jobBlock);
  const stepBlock = stepBlocks.find((block) => hasTopLevelStepLine(block, `uses: ${usesAction}`));

  if (!stepBlock) {
    fail(label, `${relativePackagePath(path)} must include uses: ${usesAction} in a step`);
    return "";
  }

  return stepBlock;
}

function expectSingleStepWithUses(label, path, jobBlock, usesAction) {
  const stepBlocks = extractStepBlocks(jobBlock);
  const matchingSteps = stepBlocks.filter((block) => hasTopLevelStepLine(block, `uses: ${usesAction}`));

  if (matchingSteps.length === 0) {
    fail(label, `${relativePackagePath(path)} must include uses: ${usesAction} in a step`);
    return "";
  }
  if (matchingSteps.length !== 1) {
    fail(label, `${relativePackagePath(path)} must include exactly one uses: ${usesAction} step`);
  }

  return matchingSteps[0];
}

function expectStepOrder(label, path, jobBlock, beforeStep, afterStep, description) {
  if (!beforeStep || !afterStep) return;

  const stepBlocks = extractStepBlocks(jobBlock);
  const beforeIndex = stepBlocks.indexOf(beforeStep);
  const afterIndex = stepBlocks.indexOf(afterStep);
  if (beforeIndex === -1 || afterIndex === -1) {
    return;
  }
  if (beforeIndex > afterIndex) {
    fail(label, `${relativePackagePath(path)} must place ${description}`);
  }
}

function expectExactSteps(label, path, jobBlock, jobName, expectedSteps) {
  if (!jobBlock || expectedSteps.some((stepBlock) => !stepBlock)) return;

  const stepBlocks = extractStepBlocks(jobBlock);
  const stepsMatch =
    stepBlocks.length === expectedSteps.length &&
    expectedSteps.every((stepBlock, index) => stepBlocks[index] === stepBlock);

  if (!stepsMatch) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must contain only audited steps`);
  }
}

function arraysEqual(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

function splitScriptCommands(script) {
  return splitScriptCommandParts(script).map((part) => part.command);
}

function splitScriptCommandParts(script) {
  if (typeof script !== "string") return [];

  const text = shellContinuationText(shellCommentText(script));
  const parts = [];
  let command = "";
  let quote = "";
  let escaped = false;
  let separator = "";

  const pushCommand = (nextSeparator) => {
    const trimmed = command.trim();
    if (trimmed) {
      parts.push({ command: trimmed, separator });
    }
    command = "";
    separator = nextSeparator;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      command += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      command += char;
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      command += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      command += char;
      continue;
    }
    if (quote === "" && (char === "&" || char === "|") && text[index + 1] === char) {
      pushCommand(`${char}${char}`);
      index += 1;
      continue;
    }
    if (quote === "" && (char === ";" || char === "|" || char === "&")) {
      pushCommand(char);
      continue;
    }
    if (quote === "" && char === "\n") {
      while (text[index + 1] === "\n") {
        index += 1;
      }
      pushCommand("\n");
      continue;
    }
    command += char;
  }

  pushCommand("");
  return parts;
}

function shellCommentText(text) {
  return text
    .split("\n")
    .map((line) => stripShellLineComment(line))
    .join("\n");
}

function stripShellLineComment(line) {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (char === "#" && quote === "" && (index === 0 || /\s/u.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }

  return line;
}

function expectNoScriptCommandBefore(label, scriptName, script, anchorCommand, blockedCommand) {
  const commands = splitScriptCommands(script);
  const anchorIndex = commands.indexOf(anchorCommand);
  if (anchorIndex === -1) return;

  if (commands.slice(0, anchorIndex).some((command) => isBlockedScriptCommand(command, blockedCommand))) {
    fail(label, `script ${scriptName} must not run ${blockedCommand} before ${anchorCommand}`);
  }
}

function isBlockedScriptCommand(command, blockedCommand) {
  if (blockedCommand === "exit 0") {
    return isSuccessfulExitCommand(command);
  }
  return command === blockedCommand;
}

function expectNoExitBeforeScriptCommands(label, scriptName, script, anchorCommands) {
  for (const anchorCommand of anchorCommands) {
    expectNoScriptCommandBefore(label, scriptName, script, anchorCommand, "exit 0");
  }
}

function expectNoUnsupportedPackageScriptSyntax(label, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script !== "string") continue;

    if (hasShellCommandSubstitution(script)) {
      fail(label, `script ${scriptName} must not use shell command substitution`);
    }
    if (hasShellFunctionDefinition(script)) {
      fail(label, `script ${scriptName} must not define shell functions`);
    }
    if (hasShellAliasDefinition(script)) {
      fail(label, `script ${scriptName} must not define shell aliases`);
    }
    if (textFeedsShellInterpreterOnStdin(script)) {
      fail(label, `script ${scriptName} must not feed scripts to shell interpreters on stdin`);
    }
    if (splitScriptCommandParts(script).some((part) => part.separator === "|")) {
      fail(label, `script ${scriptName} must not use shell pipelines`);
    }
    if (hasShellCommandNegation(script)) {
      fail(label, `script ${scriptName} must not use shell command negation`);
    }
    if (scriptUsesChildProcessExecution(script)) {
      fail(label, `script ${scriptName} must not use child_process command execution`);
    }
    if (textUsesNonShellInterpreterEval(script)) {
      fail(label, `script ${scriptName} must not use non-shell interpreter eval snippets`);
    }
    if (scriptUsesNpmExec(script)) {
      fail(label, `script ${scriptName} must not use npm exec`);
    }
    if (scriptUsesXargs(script)) {
      fail(label, `script ${scriptName} must not use xargs command execution`);
    }
    if (scriptMutatesPackageManifest(script)) {
      fail(label, `script ${scriptName} must not mutate package.json`);
    }
  }
}

function hasShellCommandSubstitution(text) {
  return /`|\$\(/u.test(text);
}

function hasShellFunctionDefinition(text) {
  return /(?:^|[;&|({}\n]\s*)(?:function\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?:\(\s*\))?\s*\{/u.test(text);
}

function hasShellAliasDefinition(text) {
  return shellScanTexts(text).some((commandText) =>
    /(?:^|[;&|\n]\s*)alias\s+[A-Za-z_][A-Za-z0-9_]*=/u.test(shellContinuationText(commandText)),
  );
}

function hasShellCommandNegation(text) {
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => shellTokens(line).some((token) => shellWordValue(token) === "!"));
}

function textFeedsShellInterpreterOnStdin(text) {
  return shellScanTexts(text).some((commandText) => shellTextFeedsShellInterpreterOnStdin(commandText));
}

function shellTextFeedsShellInterpreterOnStdin(text) {
  const strippedText = shellContinuationText(shellCommentText(text));
  return strippedText
    .split("\n")
    .some(
      (line) =>
        /(?:^|[;&]\s*)(?:bash|bun|deno|node|perl|php|python|python3|ruby|sh|tsx)\b[^;&|]*(?:<<<|<<)/u.test(line) ||
        /\|\s*(?:bash|bun|deno|node|perl|php|python|python3|ruby|sh|tsx)\b/u.test(line),
    );
}

function expectNoPublishInScripts(label, packageDir, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script === "string" && hasNpmPublishCommand(script)) {
      fail(label, `script ${scriptName} must not include npm publish`);
    }
    for (const scriptPath of localFilesInvokedByScript(packageDir, script)) {
      const scriptText = readExistingLocalScriptFile(scriptPath, packageDir);
      if (scriptText && hasNpmPublishCommand(scriptText)) {
        fail(label, `script ${scriptName} referenced file ${relativePackagePath(scriptPath)} must not include npm publish`);
      }
      expectNoUnsupportedLocalScriptText(
        label,
        `script ${scriptName} referenced file ${relativePackagePath(scriptPath)}`,
        scriptText,
      );
      expectNoPublishEnvMutationInScriptText(
        label,
        `script ${scriptName} referenced file ${relativePackagePath(scriptPath)}`,
        scriptText,
      );
    }
  }
}

function expectNoUnsupportedLocalScriptText(label, subject, script) {
  if (!script) return;
  if (scriptUsesChildProcessExecution(script)) {
    fail(label, `${subject} must not use child_process command execution`);
  }
  if (scriptUsesNpmExec(script)) {
    fail(label, `${subject} must not use npm exec`);
  }
  if (scriptMutatesPackageManifest(script)) {
    fail(label, `${subject} must not mutate package.json`);
  }
}

function localFilesInvokedByScript(packageDir, script) {
  if (typeof script !== "string") return [];

  const localFiles = new Set();
  const shellVariables = new Map();
  for (const command of splitScriptCommands(script)) {
    const tokens = shellTokens(command).map((token) => shellWordValue(token));
    for (let index = 0; index < tokens.length; index += 1) {
      const word = tokens[index];
      recordShellVariable(word, shellVariables);
      const token = resolveShellVariables(word, shellVariables);
      const resolvedTokens = tokens.map((candidate) => resolveShellVariables(candidate, shellVariables));
      for (const scriptToken of nodeOptionsLocalScriptTokens(token)) {
        localFiles.add(resolve(packageDir, scriptToken));
      }
      if (isLocalScriptFileToken(token)) {
        localFiles.add(resolve(packageDir, token));
      }
      if (isShellOrNodeInterpreterToken(token)) {
        for (const scriptToken of interpreterLocalScriptTokens(token, resolvedTokens, index + 1)) {
          localFiles.add(resolve(packageDir, scriptToken));
        }
      } else if (isFileArgumentInterpreterToken(token)) {
        const scriptToken = interpreterFileArgumentToken(resolvedTokens, index + 1);
        if (scriptToken && (isLocalScriptFileToken(scriptToken) || isBareInterpreterScriptToken(scriptToken))) {
          localFiles.add(resolve(packageDir, scriptToken));
        }
      } else if (isEnvCommandToken(token)) {
        for (const scriptToken of envCommandLocalScriptTokens(resolvedTokens, index + 1)) {
          localFiles.add(resolve(packageDir, scriptToken));
        }
      }
    }
  }

  return [...localFiles].filter((path) => isPathInsidePackageDir(path, packageDir));
}

function nodeOptionsLocalScriptTokens(word) {
  const assignment = shellVariableAssignment(word);
  if (assignment?.name !== "NODE_OPTIONS") return [];

  const tokens = shellTokens(assignment.value).map((token) => shellWordValue(token));
  return interpreterLocalScriptTokens("node", tokens, 0);
}

function isShellOrNodeInterpreterToken(token) {
  return ["bash", "sh", "node"].includes(commandBasename(token));
}

function isEnvCommandToken(token) {
  return commandBasename(token) === "env";
}

function envCommandLocalScriptTokens(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) return [];
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    if (shellVariableAssignment(token)) {
      continue;
    }
    if (token.startsWith("-")) {
      if (["-S", "--split-string"].includes(token)) {
        return envSplitStringLocalScriptTokens(tokens[index + 1] ?? "");
      }
      const splitString = envSplitStringOptionValue(token);
      if (splitString) return envSplitStringLocalScriptTokens(splitString);
      continue;
    }
    if (!isShellOrNodeInterpreterToken(token)) return [];
    return interpreterLocalScriptTokens(token, tokens, index + 1);
  }

  return [];
}

function envSplitStringOptionValue(token) {
  for (const option of ["-S", "--split-string"]) {
    if (token.startsWith(`${option}=`)) {
      return token.slice(option.length + 1);
    }
  }

  return "";
}

function envSplitStringCommandText(tokens, startIndex, shellVariables = new Map()) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) return "";
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    const splitString = envSplitStringOptionValue(token);
    if (splitString) {
      return splitString;
    }
    if (token === "-S" || token === "--split-string") {
      return resolveShellVariables(shellWordValue(tokens[index + 1] ?? ""), shellVariables);
    }
    if (shellVariableAssignment(token)) {
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    return "";
  }

  return "";
}

function envSplitStringLocalScriptTokens(scriptText) {
  const tokens = shellTokens(scriptText).map((token) => shellWordValue(token));
  const shellVariables = new Map();
  const scriptTokens = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const word = tokens[index];
    recordShellVariable(word, shellVariables);
    const token = resolveShellVariables(word, shellVariables);
    const resolvedTokens = tokens.map((candidate) => resolveShellVariables(candidate, shellVariables));
    for (const scriptToken of nodeOptionsLocalScriptTokens(token)) {
      scriptTokens.push(scriptToken);
    }
    if (isShellBoundaryToken(token)) return scriptTokens;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (shellVariableAssignment(token)) continue;
    if (!isShellOrNodeInterpreterToken(token)) continue;
    return [...scriptTokens, ...interpreterLocalScriptTokens(token, resolvedTokens, index + 1)];
  }

  return scriptTokens;
}

function interpreterLocalScriptTokens(command, tokens, startIndex) {
  const scriptTokens = [];
  const basename = commandBasename(command);

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    const inlinePreloadValue = nodePreloadOptionValue(basename, token);
    if (inlinePreloadValue) {
      if (isLocalScriptFileToken(inlinePreloadValue) || isBareInterpreterScriptToken(inlinePreloadValue)) {
        scriptTokens.push(inlinePreloadValue);
      }
      continue;
    }
    if (token.startsWith("-")) {
      const evalScriptToken = nodeEvalOptionConsumesValue(basename, token) ? tokens[index + 1] ?? "" : "";
      if (evalScriptToken) {
        scriptTokens.push(...nodeEvalLocalScriptTokens(evalScriptToken));
        index += 1;
        continue;
      }
      if (nodePreloadOptionConsumesValue(basename, token)) {
        const preloadToken = tokens[index + 1] ?? "";
        if (isLocalScriptFileToken(preloadToken) || isBareInterpreterScriptToken(preloadToken)) {
          scriptTokens.push(preloadToken);
        }
        index += 1;
      } else if (interpreterOptionConsumesValue(token)) {
        index += 1;
      }
      continue;
    }
    if (isLocalScriptFileToken(token) || isBareInterpreterScriptToken(token)) {
      scriptTokens.push(token);
    }
  }

  return scriptTokens;
}

function nodeEvalLocalScriptTokens(scriptText) {
  return localScriptDependencySpecifiers(scriptText).filter((specifier) => specifier !== "./dist/index.js");
}

function nodePreloadOptionValue(command, token) {
  if (commandBasename(command) !== "node") return "";

  for (const option of ["--require", "--import", "--loader", "--experimental-loader"]) {
    if (token.startsWith(`${option}=`)) {
      return token.slice(option.length + 1);
    }
  }

  return "";
}

function nodePreloadOptionConsumesValue(command, token) {
  return (
    commandBasename(command) === "node" &&
    ["-r", "--require", "--import", "--loader", "--experimental-loader"].includes(token)
  );
}

function nodeEvalOptionConsumesValue(command, token) {
  return commandBasename(command) === "node" && ["-e", "--eval", "-p", "--print"].includes(token);
}

function interpreterOptionConsumesValue(token) {
  return [
    "-r",
    "--require",
    "--import",
    "--loader",
    "--experimental-loader",
    "-e",
    "--eval",
    "-p",
    "--print",
    "-c",
  ].includes(token);
}

function commandBasename(command) {
  return command.replace(/\\/gu, "/").split("/").pop() ?? "";
}

function isPathInsidePackageDir(path, packageDir) {
  return path === packageDir || path.startsWith(`${packageDir}/`);
}

function isLocalScriptFileToken(token) {
  return token.startsWith("./") || token.startsWith("../") || isRelativeLocalPathToken(token);
}

function isRelativeLocalPathToken(token) {
  return /^[A-Za-z0-9_.-]+\/(?:[A-Za-z0-9_.-]+\/?)*$/u.test(token);
}

function readExistingLocalScriptFile(path, packageDir, visited = new Set()) {
  const scriptPath = existingLocalScriptPath(path);
  if (!scriptPath) return "";
  if (!isPathInsidePackageDir(scriptPath, packageDir)) return "";
  if (visited.has(scriptPath)) return "";
  visited.add(scriptPath);

  try {
    if (statSync(scriptPath).isDirectory()) {
      return localScriptDirectoryEntrypointText(scriptPath, packageDir, visited);
    }
    const scriptText = readFileSync(scriptPath, "utf8");
    const dependencyTexts = localScriptDependencyPaths(scriptText, dirname(scriptPath), packageDir).map(
      (dependencyPath) => readExistingLocalScriptFile(dependencyPath, packageDir, visited),
    );
    return [scriptText, ...dependencyTexts].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

function existingLocalScriptPath(path) {
  if (existsSync(path)) return path;
  if (extname(path)) return "";

  for (const extension of [".js", ".mjs", ".cjs", ".ts", ".tsx", ".sh"]) {
    const candidate = `${path}${extension}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

function localScriptDirectoryEntrypointText(path, packageDir, visited) {
  const entrypointTexts = [];
  const packageJsonPath = join(path, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = readJson(packageJsonPath);
      for (const entrypoint of [pkg.main, pkg.module]) {
        if (typeof entrypoint === "string") {
          const entrypointPath = resolve(path, entrypoint);
          if (isPathInsidePackageDir(entrypointPath, packageDir) && existsSync(entrypointPath)) {
            entrypointTexts.push(readExistingLocalScriptFile(entrypointPath, packageDir, visited));
          }
        }
      }
    } catch {
      // Ignore invalid nested metadata; the package-level audit reports package metadata issues separately.
    }
  }

  for (const entrypoint of ["index.js", "index.mjs", "index.cjs", "index.ts", "index.tsx", "index.sh"]) {
    const entrypointPath = join(path, entrypoint);
    if (existsSync(entrypointPath)) {
      entrypointTexts.push(readExistingLocalScriptFile(entrypointPath, packageDir, visited));
    }
  }

  return entrypointTexts.join("\n");
}

function localScriptDependencyPaths(scriptText, baseDir, packageDir) {
  const dependencyPaths = new Set();

  for (const specifier of localScriptDependencySpecifiers(scriptText)) {
    const dependencyPath = existingLocalScriptPath(resolve(baseDir, specifier));
    if (dependencyPath && isPathInsidePackageDir(dependencyPath, packageDir)) {
      dependencyPaths.add(dependencyPath);
    }
  }

  return [...dependencyPaths];
}

function localScriptDependencySpecifiers(text) {
  const specifiers = [];
  const staticImportPattern = /^\s*import\s+(?:(?!["'`]).*?\s+from\s+)?(["'`])(\.[^"'`$]+)\1/u;
  const exportFromPattern = /^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+(["'`])(\.[^"'`$]+)\1/u;
  const callPattern = /\b(?:import|require)\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])(\.[^"'`$]+)\1/gu;
  const shellSourcePattern =
    /^\s*(?:\.|source)\s+((?:\.{1,2}\/|[A-Za-z0-9_.-]+\/)[^\s;&|]+|[A-Za-z0-9_.-]+\.(?:bash|sh))\b/u;

  for (const rawLine of text.split("\n")) {
    const staticImport = staticImportPattern.exec(rawLine);
    const exportFrom = exportFromPattern.exec(rawLine);
    const shellSource = shellSourcePattern.exec(rawLine);
    if (staticImport) specifiers.push(staticImport[2]);
    if (exportFrom) specifiers.push(exportFrom[2]);
    if (shellSource) specifiers.push(shellSource[1]);
  }
  for (const match of text.matchAll(callPattern)) {
    specifiers.push(match[2]);
  }

  return specifiers;
}

function expectNoPublishEnvMutationInScripts(label, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script !== "string") continue;
    expectNoPublishEnvMutationInScriptText(label, `script ${scriptName}`, script);
  }
}

function expectNoExecutedPackageToolingMutations(label, packageDir) {
  for (const scriptPath of executedPackageToolingScriptPaths(packageDir)) {
    const scriptText = readExecutedToolingScriptText(scriptPath, packageDir);
    if (!scriptText) continue;

    const subject = `tooling file ${relativePackagePath(scriptPath)}`;
    if (hasNpmPublishCommand(scriptText)) {
      fail(label, `${subject} must not include npm publish`);
    }
    expectNoUnsupportedLocalScriptText(label, subject, scriptText);
    expectNoPublishEnvMutationInScriptText(label, subject, scriptText);
  }
}

function executedPackageToolingScriptPaths(packageDir) {
  const scriptPaths = new Set();

  for (const configFile of EXECUTED_TOOLING_CONFIG_FILES) {
    const configPath = join(packageDir, configFile);
    if (existsSync(configPath)) {
      scriptPaths.add(configPath);
    }
  }

  collectExecutedToolingScriptPaths(join(packageDir, "tests"), scriptPaths);
  return [...scriptPaths].filter((scriptPath) => isPathInsidePackageDir(scriptPath, packageDir));
}

function collectExecutedToolingScriptPaths(directory, scriptPaths) {
  if (!existsSync(directory)) return;

  let entries = [];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectExecutedToolingScriptPaths(entryPath, scriptPaths);
    } else if (entry.isFile() && isExecutedToolingScriptFile(entryPath)) {
      scriptPaths.add(entryPath);
    }
  }
}

function isExecutedToolingScriptFile(path) {
  if (path.endsWith(".d.ts")) return false;
  return EXECUTED_TOOLING_SCRIPT_EXTENSIONS.has(extname(path));
}

function readExecutedToolingScriptText(scriptPath, packageDir, visited = new Set()) {
  if (!existsSync(scriptPath)) return "";
  if (!isPathInsidePackageDir(scriptPath, packageDir)) return "";
  if (visited.has(scriptPath)) return "";
  visited.add(scriptPath);

  let scriptText = "";
  try {
    scriptText = readFileSync(scriptPath, "utf8");
  } catch {
    return "";
  }

  const dependencyTexts = localScriptDependencyPaths(scriptText, dirname(scriptPath), packageDir)
    .filter((dependencyPath) => shouldScanExecutedToolingDependency(dependencyPath, packageDir))
    .map((dependencyPath) => readExecutedToolingScriptText(dependencyPath, packageDir, visited));
  return [scriptText, ...dependencyTexts].filter(Boolean).join("\n");
}

function shouldScanExecutedToolingDependency(dependencyPath, packageDir) {
  const relativePath = dependencyPath.slice(packageDir.length + 1);
  return (
    !relativePath.startsWith("dist/") &&
    !relativePath.startsWith("examples/") &&
    relativePath !== "package.json" &&
    relativePath !== "package-lock.json"
  );
}

function expectNoPublishEnvMutationInScriptText(label, subject, script) {
  if (!script) return;
  if (scriptWritesGitHubActionsEnvironmentFile(script)) {
    fail(label, `${subject} must not write GitHub Actions environment files`);
  }
  if (scriptWritesNpmConfigFile(script)) {
    fail(label, `${subject} must not write npm config files`);
  }
  if (textHasBlockedNpmConfigEnvKey(script)) {
    fail(label, `${subject} must not set publish-altering npm config env`);
  }
  if (scriptHasBlockedNpmConfigCommand(script)) {
    fail(label, `${subject} must not write publish-altering npm config`);
  }
}

function scriptWritesGitHubActionsEnvironmentFile(script) {
  if (/\bGITHUB_(ENV|PATH)\b/u.test(script)) {
    return true;
  }

  return shellContinuationText(script)
    .split("\n")
    .some((line) =>
      shellTokens(line)
        .map((token) => shellWordValue(token))
        .some((word) => /\bGITHUB_(ENV|PATH)\b/u.test(word)),
  );
}

function scriptWritesNpmConfigFile(script) {
  const npmConfigWriteApiPattern =
    /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\([\s\S]{0,240}\.npmrc/u;
  if (
    npmConfigWriteApiPattern.test(script) ||
    scriptWritesTargetFileThroughJavaScriptLiteral(script, isNpmConfigPathToken) ||
    scriptWritesTargetFileThroughJavaScriptVariable(script, isNpmConfigPathToken) ||
    scriptMentionsTargetPathWithWriteOperation(script, isNpmConfigPathToken)
  ) {
    return true;
  }

  const shellVariables = new Map();
  return shellContinuationText(shellCommentText(script))
    .split("\n")
    .some((line) => {
      const tokens = shellTokens(line).map((token) => {
        const word = shellWordValue(token);
        recordShellVariable(word, shellVariables);
        return resolveShellVariables(word, shellVariables);
      });
      return shellTokensWriteNpmConfigFile(tokens);
    });
}

function scriptUsesChildProcessExecution(script) {
  return (
    scriptReferencesChildProcessModule(script) &&
    /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\b/u.test(script)
  );
}

function scriptReferencesChildProcessModule(script) {
  return (
    /\b(?:node:)?child_process\b/u.test(script) ||
    javascriptConcatenatedStringTexts(script).some(
      (value) => value === "child_process" || value === "node:child_process",
    )
  );
}

function scriptUsesNpmExec(script) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  const npxVariables = new Set();
  return shellContinuationText(shellCommentText(script))
    .split("\n")
    .some((line) => lineUsesNpmExec(line, shellVariables, npmVariables, npxVariables));
}

function scriptUsesXargs(script) {
  const shellVariables = new Map();
  return shellScanTexts(script).some((commandText) =>
    shellContinuationText(shellCommentText(commandText))
      .split("\n")
      .some((line) =>
        shellTokens(line).some((token) => {
          const word = shellWordValue(token);
          recordShellVariable(word, shellVariables);
          return commandBasename(resolveShellVariables(word, shellVariables)) === "xargs";
        }),
      ),
  );
}

function lineUsesNpmExec(line, shellVariables, npmVariables, npxVariables) {
  const tokens = shellTokens(line);

  for (let index = 0; index < tokens.length; index += 1) {
    const word = shellWordValue(tokens[index]);
    recordShellVariable(word, shellVariables);
    const resolvedWord = resolveShellVariables(word, shellVariables);
    recordNpmCommandVariable(resolvedWord, npmVariables);
    recordNpxCommandVariable(resolvedWord, npxVariables);
    if (isNpxCommandToken(resolvedWord, npxVariables)) return true;
    if (!isNpmCommandToken(resolvedWord, npmVariables)) continue;

    for (let commandIndex = index + 1; commandIndex < tokens.length; commandIndex += 1) {
      const token = resolveShellVariables(shellWordValue(tokens[commandIndex]), shellVariables);
      if (isShellRedirectionToken(token)) {
        commandIndex += 1;
        continue;
      }
      if (isShellBoundaryToken(token)) break;
      if (token === "exec" || token === "x") {
        return true;
      }
      if (token.startsWith("-")) {
        if (!token.includes("=") && npmConfigOptionConsumesValue(npmOptionName(token))) {
          commandIndex += 1;
        }
        continue;
      }
      break;
    }
  }

  return false;
}

function scriptMutatesPackageManifest(script) {
  return scriptHasNpmPackageCommand(script) || scriptWritesPackageManifestFile(script);
}

function scriptHasNpmPackageCommand(script) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  return shellContinuationText(shellCommentText(script))
    .split("\n")
    .some((line) => lineHasNpmPackageCommand(line, shellVariables, npmVariables));
}

function lineHasNpmPackageCommand(line, shellVariables, npmVariables) {
  const tokens = shellTokens(line);

  for (let index = 0; index < tokens.length; index += 1) {
    const word = shellWordValue(tokens[index]);
    recordShellVariable(word, shellVariables);
    const resolvedWord = resolveShellVariables(word, shellVariables);
    recordNpmCommandVariable(resolvedWord, npmVariables);
    if (!isNpmCommandToken(resolvedWord, npmVariables)) continue;

    for (let commandIndex = index + 1; commandIndex < tokens.length; commandIndex += 1) {
      const token = resolveShellVariables(shellWordValue(tokens[commandIndex]), shellVariables);
      if (isShellRedirectionToken(token)) {
        commandIndex += 1;
        continue;
      }
      if (isShellBoundaryToken(token)) break;
      if (NPM_MANIFEST_MUTATION_SUBCOMMANDS.has(token)) {
        return true;
      }
      if (token.startsWith("-")) {
        if (!token.includes("=") && npmConfigOptionConsumesValue(npmOptionName(token))) {
          commandIndex += 1;
        }
        continue;
      }
      break;
    }
  }

  return false;
}

function scriptWritesPackageManifestFile(script) {
  const packageWriteApiPattern =
    /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\([\s\S]{0,240}package\.json/u;
  if (
    packageWriteApiPattern.test(script) ||
    scriptWritesTargetFileThroughJavaScriptLiteral(script, isPackageManifestPathToken) ||
    scriptWritesTargetFileThroughJavaScriptVariable(script, isPackageManifestPathToken) ||
    scriptMentionsTargetPathWithWriteOperation(script, isPackageManifestPathToken)
  ) {
    return true;
  }

  const shellVariables = new Map();
  return shellContinuationText(shellCommentText(script))
    .split("\n")
    .some((line) => {
      const tokens = shellTokens(line).map((token) => {
        const word = shellWordValue(token);
        recordShellVariable(word, shellVariables);
        return resolveShellVariables(word, shellVariables);
      });
      return shellTokensWritePackageManifestFile(tokens);
    });
}

function scriptWritesTargetFileThroughJavaScriptLiteral(script, isTargetPathToken) {
  const writeCallPattern = /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\(/gu;
  for (const match of script.matchAll(writeCallPattern)) {
    const string = readJavaScriptStringConcatAt(script, match.index + match[0].length);
    if (string.closed && isTargetPathToken(string.value)) {
      return true;
    }
  }

  return false;
}

function scriptWritesTargetFileThroughJavaScriptVariable(script, isTargetPathToken) {
  const targetVariables = new Set();
  const assignmentPattern = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/gu;

  for (const match of script.matchAll(assignmentPattern)) {
    const string = readJavaScriptStringConcatAt(script, match.index + match[0].length);
    if (string.closed && isTargetPathToken(string.value)) {
      targetVariables.add(match[1]);
    }
  }

  if (targetVariables.size === 0) return false;

  const writeCallPattern =
    /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\b/gu;
  for (const match of script.matchAll(writeCallPattern)) {
    if (targetVariables.has(match[1])) {
      return true;
    }
  }

  return false;
}

function scriptMentionsTargetPathWithWriteOperation(script, isTargetPathToken) {
  if (
    !/\b(?:append|copy|cp(?:Sync)?|create|link(?:Sync)?|open|rename|replace|symlink(?:Sync)?|touch|truncate|write)(?:\b|_)/u.test(
      script,
    )
  ) {
    return false;
  }

  return [...javascriptStringTexts(script), ...javascriptConcatenatedStringTexts(script)].some((value) =>
    isTargetPathToken(value),
  );
}

function shellTokensWritePackageManifestFile(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (isShellOutputRedirectionToken(tokens[index]) && isPackageManifestPathToken(tokens[index + 1] ?? "")) {
      return true;
    }
    if (isTeeCommandToken(tokens[index]) && teeCommandTargetsPackageManifest(tokens, index + 1)) {
      return true;
    }
    if (isCopyCommandToken(tokens[index]) && copyCommandTargetsFile(tokens, index + 1, isPackageManifestPathToken)) {
      return true;
    }
    if (isInPlaceEditCommandToken(tokens[index]) && inPlaceEditTargetsFile(tokens, index + 1, isPackageManifestPathToken)) {
      return true;
    }
  }

  return false;
}

function shellTokensWriteNpmConfigFile(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (isShellOutputRedirectionToken(tokens[index]) && isNpmConfigPathToken(tokens[index + 1] ?? "")) {
      return true;
    }
    if (isTeeCommandToken(tokens[index]) && teeCommandTargetsNpmConfig(tokens, index + 1)) {
      return true;
    }
    if (isCopyCommandToken(tokens[index]) && copyCommandTargetsFile(tokens, index + 1, isNpmConfigPathToken)) {
      return true;
    }
    if (isInPlaceEditCommandToken(tokens[index]) && inPlaceEditTargetsFile(tokens, index + 1, isNpmConfigPathToken)) {
      return true;
    }
  }

  return false;
}

function teeCommandTargetsNpmConfig(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) {
      break;
    }
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    if (isNpmConfigPathToken(token)) {
      return true;
    }
  }

  return false;
}

function teeCommandTargetsPackageManifest(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) {
      break;
    }
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    if (isPackageManifestPathToken(token)) {
      return true;
    }
  }

  return false;
}

function copyCommandTargetsFile(tokens, startIndex, isTargetPathToken) {
  const operands = [];
  let afterOptions = false;

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      afterOptions = true;
      continue;
    }
    if (!afterOptions && token.startsWith("-")) {
      continue;
    }
    operands.push(token);
  }

  return operands.length >= 2 && isTargetPathToken(operands.at(-1) ?? "");
}

function isTeeCommandToken(token) {
  return /(?:^|\/)tee$/u.test(token.replace(/\\/gu, "/"));
}

function isCopyCommandToken(token) {
  return /(?:^|\/)cp$/u.test(token.replace(/\\/gu, "/"));
}

function isInPlaceEditCommandToken(token) {
  return /(?:^|\/)(?:perl|sed)$/u.test(token.replace(/\\/gu, "/"));
}

function inPlaceEditTargetsFile(tokens, startIndex, isTargetPathToken) {
  let hasInPlaceOption = false;

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    if (isInPlaceEditOption(token)) {
      hasInPlaceOption = true;
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    if (hasInPlaceOption && isTargetPathToken(token)) {
      return true;
    }
  }

  return false;
}

function isInPlaceEditOption(token) {
  return token === "-i" || /^-i\S*/u.test(token) || /^-[A-Za-z]*i[A-Za-z]*$/u.test(token);
}

function isNpmConfigPathToken(token) {
  return (
    token === ".npmrc" ||
    token.endsWith("/.npmrc") ||
    token === "~/.npmrc" ||
    token === "$HOME/.npmrc" ||
    token === "${HOME}/.npmrc"
  );
}

function isPackageManifestPathToken(token) {
  return token === "package.json" || token === "./package.json" || token.endsWith("/package.json");
}

function expectNoPublishLifecycleScripts(label, scripts) {
  const blockedLifecycleScripts = [
    "preinstall",
    "install",
    "postinstall",
    "prepublish",
    "prepublishOnly",
    "preprepare",
    "prepare",
    "postprepare",
    "postpack",
    "publish",
    "postpublish",
  ];

  for (const scriptName of blockedLifecycleScripts) {
    if (typeof scripts?.[scriptName] === "string") {
      fail(label, `script ${scriptName} must not be defined`);
    }
  }

  for (const scriptName of contract.manifest.requiredScriptNames) {
    for (const prefix of ["pre", "post"]) {
      const hookName = `${prefix}${scriptName}`;
      if (hookName === "prepack") continue;
      if (typeof scripts?.[hookName] === "string") {
        fail(label, `script ${hookName} must not be defined`);
      }
    }
  }
}

function expectNoWorkspaces(label, pkg) {
  if (pkg.workspaces !== undefined) {
    fail(label, "package workspaces must not be defined");
  }
}

function expectAuditableNpmCiLockfile(label, lockfilePath) {
  if (!lockfilePath) return;

  const lockfile = readJson(lockfilePath);
  if (
    !lockfile ||
    typeof lockfile !== "object" ||
    !Number.isInteger(lockfile.lockfileVersion) ||
    lockfile.lockfileVersion < 2 ||
    !lockfile.packages ||
    typeof lockfile.packages !== "object"
  ) {
    fail(label, `${relativePackagePath(lockfilePath)} must use lockfileVersion 2 or newer with packages map`);
  }
}

function expectNoNpmBinaryShadowing(label, pkg, lockfilePath) {
  if (packageDeclaresNpmBin(pkg)) {
    fail(label, "package bin must not include npm");
  }

  for (const dependencyGroup of DEPENDENCY_GROUPS) {
    if (pkg[dependencyGroup]?.npm !== undefined) {
      fail(label, `${dependencyGroup} must not include npm`);
    }
  }

  if (!lockfilePath) return;

  const lockfile = readJson(lockfilePath);
  for (const [entryPath, entry] of Object.entries(lockfile.packages ?? {})) {
    if (packageDeclaresNpmBin(entry, entryPath)) {
      fail(label, `${relativePackagePath(lockfilePath)} must not include npm binary from ${entryPath || "."}`);
    }
  }
}

function expectNoLocalDependencySpecs(label, pkg, lockfilePath) {
  for (const dependencyGroup of DEPENDENCY_GROUPS) {
    for (const [dependency, spec] of Object.entries(pkg[dependencyGroup] ?? {})) {
      if (isLocalDependencySpec(spec)) {
        fail(label, `${dependencyGroup} ${dependency} must not use local file/link spec`);
      }
    }
  }

  if (!lockfilePath) return;

  const lockfile = readJson(lockfilePath);
  for (const [entryPath, entry] of Object.entries(lockfile.packages ?? {})) {
    if (!entryPath || !entry || typeof entry !== "object") continue;

    if (
      entry.link === true ||
      isLocalDependencySpec(entry.version) ||
      isLocalDependencySpec(entry.resolved)
    ) {
      fail(label, `${relativePackagePath(lockfilePath)} dependency ${entryPath} must not use local file/link spec`);
    }
    for (const dependencyGroup of DEPENDENCY_GROUPS) {
      for (const [dependency, spec] of Object.entries(entry[dependencyGroup] ?? {})) {
        if (isLocalDependencySpec(spec)) {
          fail(
            label,
            `${relativePackagePath(lockfilePath)} dependency ${entryPath} ${dependencyGroup} ${dependency} must not use local file/link spec`,
          );
        }
      }
    }
  }
}

function isLocalDependencySpec(spec) {
  return typeof spec === "string" && /^(?:file|link):/iu.test(spec.trim());
}

function expectNoDependencyInstallLifecycleScripts(label, lockfilePath) {
  if (!lockfilePath) return;

  const lockfile = readJson(lockfilePath);
  for (const [entryPath, entry] of Object.entries(lockfile.packages ?? {})) {
    if (!entryPath || !entry || typeof entry !== "object") continue;

    if (entry.hasInstallScript === true && lockfilePackageCanInstallOnAuditedRunner(entry)) {
      fail(label, `${relativePackagePath(lockfilePath)} dependency ${entryPath} must not have install lifecycle scripts`);
    }
    for (const scriptName of DEPENDENCY_INSTALL_LIFECYCLE_SCRIPTS) {
      if (typeof entry.scripts?.[scriptName] === "string") {
        fail(label, `${relativePackagePath(lockfilePath)} dependency ${entryPath} must not define ${scriptName}`);
      }
    }
  }
}

function lockfilePackageCanInstallOnAuditedRunner(entry) {
  return (
    packagePlatformAllows(entry.os, AUDITED_RUNNER_OS) &&
    packagePlatformAllows(entry.cpu, AUDITED_RUNNER_CPU) &&
    packagePlatformAllows(entry.libc, AUDITED_RUNNER_LIBC)
  );
}

function packagePlatformAllows(values, currentValue) {
  if (!Array.isArray(values) || values.length === 0) {
    return true;
  }

  const normalizedValues = values.filter((value) => typeof value === "string").map((value) => value.toLowerCase());
  if (normalizedValues.includes(`!${currentValue}`)) {
    return false;
  }

  const positiveValues = normalizedValues.filter((value) => !value.startsWith("!"));
  return positiveValues.length === 0 || positiveValues.includes(currentValue);
}

function packageDeclaresNpmBin(pkg, packagePath = "") {
  if (!pkg || typeof pkg !== "object") return false;
  if (typeof pkg.bin === "string") {
    return packageBinName(pkg.name || packagePath) === "npm";
  }
  return Boolean(pkg.bin && typeof pkg.bin === "object" && Object.hasOwn(pkg.bin, "npm"));
}

function packageBinName(packageName) {
  if (typeof packageName !== "string") return "";
  return packageName.split("/").pop() ?? "";
}

function expectSafeNpmConfig(label, npmrcPath) {
  if (!existsSync(npmrcPath)) return;

  const npmrc = readFileSync(npmrcPath, "utf8");

  for (const entry of npmConfigEntries(npmrc)) {
    if (isBlockedNpmConfigKey(entry.key, { blockScopedRegistry: false })) {
      fail(label, `.npmrc must not set ${entry.key}`);
    }
  }

  for (const key of ["registry", `${contract.checkWorkflow.scope}:registry`]) {
    const entry = npmConfigEntry(npmrc, key);
    if (entry.present && entry.value !== contract.manifest.publishConfig.registry) {
      fail(label, `.npmrc ${key} must be ${contract.manifest.publishConfig.registry}`);
    }
  }
}

function npmCiLockfilePath(packageDir) {
  const shrinkwrapPath = join(packageDir, "npm-shrinkwrap.json");
  if (existsSync(shrinkwrapPath)) {
    return shrinkwrapPath;
  }

  const packageLockPath = join(packageDir, "package-lock.json");
  return existsSync(packageLockPath) ? packageLockPath : "";
}

function stripYamlComments(text) {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .map((line) => stripInlineYamlComment(line))
    .join("\n");
}

function stripInlineYamlComment(line) {
  let quote = "";

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === "'" || char === '"') && line[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (char === "#" && quote === "" && /\s/u.test(line[index - 1] ?? "")) {
      return line.slice(0, index).trimEnd();
    }
  }

  return line;
}

function extractNestedBlocks(text, indent) {
  const lines = text.split("\n");
  const blocks = [];
  let start = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === "") continue;
    if (isYamlChildBlockHeader(lines[index], indent)) {
      if (start !== -1) {
        blocks.push(lines.slice(start, index).join("\n"));
      }
      start = index;
    }
  }

  if (start !== -1) {
    blocks.push(lines.slice(start).join("\n"));
  }

  return blocks;
}

function extractStepBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  const stepsIndex = lines.findIndex((line) => isYamlBlockHeader(line, "steps:", countIndent(line)));
  if (stepsIndex === -1) return blocks;
  const stepsIndent = countIndent(lines[stepsIndex]);
  const stepIndent = stepsIndent + 2;
  let start = -1;

  for (let index = stepsIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== "" && countIndent(lines[index]) <= stepsIndent) {
      break;
    }
    if (countIndent(lines[index]) === stepIndent && lines[index].trimStart().startsWith("- ")) {
      if (start !== -1) {
        blocks.push(lines.slice(start, index).join("\n"));
      }
      start = index;
    }
  }

  if (start !== -1) {
    blocks.push(lines.slice(start).join("\n"));
  }

  return blocks;
}

function hasLine(text, expected) {
  return text.split("\n").some((line) => normalizedYamlLine(line) === expected);
}

function hasTopLevelStepLine(stepBlock, expected) {
  return stepBlock
    .split("\n")
    .some((line) => stepTopLevelLine(stepBlock, line) === expected);
}

function hasTopLevelStepKey(stepBlock, key) {
  return stepBlock
    .split("\n")
    .some((line) => yamlKey(stepTopLevelLine(stepBlock, line)) === key);
}

function jobTopLevelValue(jobBlock, key, indent) {
  return jobTopLevelEntry(jobBlock, key, indent).value;
}

function jobTopLevelEntry(jobBlock, key, indent) {
  const entry = jobBlock
    .split("\n")
    .map((entry) => (countIndent(entry) === indent ? normalizedYamlLine(entry) : ""))
    .find((entry) => yamlKey(entry) === key);

  return entry ? { present: true, value: yamlValue(entry) } : { present: false, value: "" };
}

function blockHasChildLines(block) {
  const lines = block.split("\n").filter((line) => line.trim() !== "");
  const header = lines[0] ?? "";
  const headerIndent = countIndent(header);

  return lines.slice(1).some((line) => countIndent(line) > headerIndent);
}

function hasLineAtIndent(text, expected, indent) {
  const prefix = " ".repeat(indent);
  return text.split("\n").some((line) => line === `${prefix}${expected}`);
}

function hasNpmPublishCommand(text) {
  return countNpmPublishCommands(text) > 0;
}

function countNpmPublishCommands(text) {
  return shellScanTexts(text).reduce(
    (count, commandText) =>
      count +
      countNpmPublishCommandsInShellText(shellContinuationText(commandText)),
    0,
  );
}

function shellContinuationText(text) {
  return text.replace(/\\[ \t]*\n/gu, "");
}

function shellScanTexts(text) {
  const lines = text.split("\n");
  const commandTexts = [];
  const workflowEnvValues = workflowEnvValueMap(text);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);

    if (yamlKey(normalizedLine) === "run:") {
      const runValue = yamlScalarValue(yamlValue(normalizedLine));
      if (/^[|>]/u.test(runValue)) {
        const block = yamlRunBlockCommandText(lines, index, countIndent(line), runValue);
        commandTexts.push(normalizeWorkflowRunCommandText(block.commandText, workflowEnvValues));
        index = block.endIndex;
      } else if (startsMultilineQuotedYamlScalar(yamlValue(normalizedLine))) {
        const scalar = yamlMultilineQuotedScalarText(lines, index, countIndent(line), yamlValue(normalizedLine));
        commandTexts.push(normalizeWorkflowRunCommandText(scalar.commandText, workflowEnvValues));
        index = scalar.endIndex;
      } else if (hasMultilinePlainYamlScalar(lines, index, countIndent(line))) {
        const scalar = yamlMultilinePlainScalarText(lines, index, countIndent(line), runValue);
        commandTexts.push(normalizeWorkflowRunCommandText(scalar.commandText, workflowEnvValues));
        index = scalar.endIndex;
      } else {
        commandTexts.push(normalizeWorkflowRunCommandText(runValue, workflowEnvValues));
      }
      continue;
    }

    commandTexts.push(line);
  }

  return commandTexts;
}

function normalizeWorkflowRunCommandText(text, workflowEnvValues) {
  return resolveShellVariables(normalizeGitHubActionsExpressions(text), workflowEnvValues);
}

function normalizeGitHubActionsExpressions(text) {
  return text.replace(/\$\{\{\s*([^}]*)\s*\}\}/gu, (_match, expression) => {
    const singleQuoted = /^'((?:''|[^'])*)'$/u.exec(expression.trim());
    if (singleQuoted) return singleQuoted[1].replace(/''/gu, "'");

    const doubleQuoted = /^"((?:\\.|[^"])*)"$/u.exec(expression.trim());
    if (doubleQuoted) return decodeDoubleQuotedYamlKey(doubleQuoted[1]);

    return "";
  });
}

function workflowEnvValueMap(text) {
  const envValues = new Map();
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);
    if (yamlKey(normalizedLine) !== "env:") continue;

    const value = yamlScalarValue(yamlValue(normalizedLine));
    if (value.startsWith("{")) {
      for (const entry of inlineMappingEntries(value)) {
        recordWorkflowEnvValue(envValues, entry.key, entry.value);
      }
      continue;
    }

    const envIndent = countIndent(line);
    for (let entryIndex = index + 1; entryIndex < lines.length; entryIndex += 1) {
      const entryLine = lines[entryIndex];
      if (entryLine.trim() === "") continue;
      if (countIndent(entryLine) <= envIndent) break;

      const entry = normalizedYamlLine(entryLine);
      const key = yamlKey(entry);
      if (!key) continue;
      recordWorkflowEnvValue(envValues, key.slice(0, -1), yamlScalarValue(yamlValue(entry)));
    }
  }

  return envValues;
}

function recordWorkflowEnvValue(envValues, key, value) {
  const name = unquoteYamlKey(key).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) return;
  if (typeof value !== "string" || value.includes("${{")) return;
  envValues.set(name, value);
}

function startsMultilineQuotedYamlScalar(value) {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('"') || trimmed.startsWith("'")) &&
    !yamlQuotedScalarClosed(trimmed)
  );
}

function yamlQuotedScalarClosed(value) {
  const quote = value[0];
  let escaped = false;

  for (let index = 1; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return index === value.length - 1;
    }
  }

  return false;
}

function yamlMultilineQuotedScalarText(lines, startIndex, runIndent, firstValue) {
  const rawBlockLines = [];
  let endIndex = startIndex;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() !== "" && countIndent(line) <= runIndent) {
      break;
    }
    rawBlockLines.push(line);
    endIndex = index;
    if (yamlQuotedScalarClosed(`${firstValue} ${line.trim()}`)) {
      break;
    }
  }

  const contentIndent = yamlBlockScalarContentIndent(rawBlockLines);
  const blockLines = rawBlockLines.map((line) =>
    line.trim() === "" ? "" : line.slice(Math.min(countIndent(line), contentIndent)),
  );
  return {
    commandText: yamlScalarValue([firstValue, ...blockLines].join(" ")),
    endIndex,
  };
}

function hasMultilinePlainYamlScalar(lines, startIndex, runIndent) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    return countIndent(line) > runIndent;
  }

  return false;
}

function yamlMultilinePlainScalarText(lines, startIndex, runIndent, firstValue) {
  const blockLines = [firstValue];
  let endIndex = startIndex;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() !== "" && countIndent(line) <= runIndent) {
      break;
    }
    blockLines.push(line.trim());
    endIndex = index;
  }

  return {
    commandText: foldYamlPlainScalarLines(blockLines),
    endIndex,
  };
}

function foldYamlPlainScalarLines(lines) {
  const foldedLines = [];
  let currentLine = "";

  for (const line of lines) {
    if (line === "") {
      if (currentLine) {
        foldedLines.push(currentLine);
        currentLine = "";
      }
      foldedLines.push("");
      continue;
    }

    currentLine = currentLine ? `${currentLine} ${line}` : line;
  }

  if (currentLine) {
    foldedLines.push(currentLine);
  }

  return yamlScalarValue(foldedLines.join("\n"));
}

function yamlRunBlockCommandText(lines, startIndex, runIndent, runValue) {
  const rawBlockLines = [];
  let endIndex = startIndex;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() !== "" && countIndent(line) <= runIndent) {
      break;
    }
    rawBlockLines.push(line);
    endIndex = index;
  }

  const contentIndent = yamlBlockScalarContentIndent(rawBlockLines);
  const blockLines = rawBlockLines.map((line) =>
    line.trim() === "" ? "" : line.slice(Math.min(countIndent(line), contentIndent)),
  );

  return {
    commandText: runValue.startsWith(">") ? foldYamlBlockScalarLines(blockLines) : blockLines.join("\n"),
    endIndex,
  };
}

function yamlBlockScalarContentIndent(lines) {
  const indents = lines.filter((line) => line.trim() !== "").map((line) => countIndent(line));
  return indents.length === 0 ? 0 : Math.min(...indents);
}

function foldYamlBlockScalarLines(lines) {
  const foldedLines = [];
  let currentLine = "";

  for (const line of lines) {
    if (line === "") {
      if (currentLine) {
        foldedLines.push(currentLine);
        currentLine = "";
      }
      foldedLines.push("");
      continue;
    }

    currentLine = currentLine ? `${currentLine} ${line}` : line;
  }

  if (currentLine) {
    foldedLines.push(currentLine);
  }

  return foldedLines.join("\n");
}

function lineHasNpmPublishCommand(line) {
  return countNpmPublishCommandsInLine(line) > 0;
}

function countNpmPublishCommandsInShellText(text) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  const publishSubcommandVariables = new Set();
  const npmFunctionNames = new Set();
  return text
    .split("\n")
    .reduce(
      (lineCount, line) =>
        lineCount +
        countNpmPublishCommandsInLine(
          line,
          shellVariables,
          npmVariables,
          publishSubcommandVariables,
          npmFunctionNames,
        ),
      0,
    );
}

function countNpmPublishCommandsInLine(
  line,
  shellVariables = new Map(),
  npmVariables = new Set(),
  publishSubcommandVariables = new Set(),
  npmFunctionNames = new Set(),
) {
  const tokens = shellTokens(line);
  let publishCommandCount =
    shellCommandSubstitutionTexts(line).reduce(
      (count, commandText) => count + countNpmPublishCommandsInShellText(commandText),
      0,
    ) + countJavaScriptEmbeddedPublishCommands(line);

  for (let index = 0; index < tokens.length; index += 1) {
    const word = shellWordValue(tokens[index]);
    recordShellVariable(word, shellVariables);
    const resolvedWord = resolveShellVariables(word, shellVariables);
    recordNpmCommandVariable(resolvedWord, npmVariables);
    recordNpmPublishSubcommandVariable(resolvedWord, publishSubcommandVariables);
    const functionDefinition = recordNpmFunctionWrapper(
      tokens,
      index,
      shellVariables,
      npmVariables,
      npmFunctionNames,
    );
    if (functionDefinition) {
      index = functionDefinition.endIndex;
      continue;
    }
    publishCommandCount += countEnvSplitStringPublishCommands(tokens, index, shellVariables);
    publishCommandCount += countEvalWrappedPublishCommands(tokens, index, shellVariables);
    publishCommandCount += countInterpreterWrappedPublishCommands(tokens, index, shellVariables);
    if (!isNpmCommandToken(resolvedWord, npmVariables) && !npmFunctionNames.has(resolvedWord)) continue;

    for (let commandIndex = index + 1; commandIndex < tokens.length; commandIndex += 1) {
      const token = resolveShellVariables(shellWordValue(tokens[commandIndex]), shellVariables);
      if (isShellRedirectionToken(token)) {
        commandIndex += 1;
        continue;
      }
      if (isShellBoundaryToken(token)) {
        break;
      }
      if (isNpmPublishSubcommandToken(token, publishSubcommandVariables)) {
        publishCommandCount += 1;
        break;
      }
    }
  }

  return publishCommandCount;
}

function countEnvSplitStringPublishCommands(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isEnvCommandToken(command)) return 0;

  const scriptText = envSplitStringCommandText(tokens, index + 1, shellVariables);
  return scriptText ? countNpmPublishCommandsInShellText(scriptText) : 0;
}

function recordNpmFunctionWrapper(tokens, index, shellVariables, npmVariables, npmFunctionNames) {
  const definition = shellFunctionDefinition(tokens, index);
  if (!definition) return null;

  if (shellFunctionBodyDelegatesToNpm(definition.bodyTokens, shellVariables, npmVariables)) {
    npmFunctionNames.add(definition.name);
  } else {
    npmFunctionNames.delete(definition.name);
  }

  return { endIndex: definition.endIndex };
}

function shellFunctionDefinition(tokens, index) {
  const name = shellWordValue(tokens[index]);
  if (
    isShellFunctionName(name) &&
    tokens[index + 1] === "(" &&
    tokens[index + 2] === ")" &&
    tokens[index + 3] === "{"
  ) {
    return readShellFunctionDefinition(tokens, name, index + 4);
  }
  if (
    name === "function" &&
    isShellFunctionName(shellWordValue(tokens[index + 1] ?? "")) &&
    tokens[index + 2] === "{"
  ) {
    return readShellFunctionDefinition(tokens, shellWordValue(tokens[index + 1]), index + 3);
  }

  return null;
}

function readShellFunctionDefinition(tokens, name, bodyStartIndex) {
  let depth = 1;
  for (let index = bodyStartIndex; index < tokens.length; index += 1) {
    if (tokens[index] === "{") {
      depth += 1;
    } else if (tokens[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { name, bodyTokens: tokens.slice(bodyStartIndex, index), endIndex: index };
      }
    }
  }

  return null;
}

function isShellFunctionName(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}

function shellFunctionBodyDelegatesToNpm(bodyTokens, shellVariables, npmVariables) {
  for (let index = 0; index < bodyTokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(bodyTokens[index]), shellVariables);
    if (!isNpmCommandToken(token, npmVariables)) continue;

    for (let commandIndex = index + 1; commandIndex < bodyTokens.length; commandIndex += 1) {
      const argument = resolveShellVariables(shellWordValue(bodyTokens[commandIndex]), shellVariables);
      if (isShellBoundaryToken(argument)) break;
      if (isShellRedirectionToken(argument)) {
        commandIndex += 1;
        continue;
      }
      if (isShellArgumentForwardingToken(argument)) {
        return true;
      }
    }
  }

  return false;
}

function isShellArgumentForwardingToken(token) {
  return token === "$@" || token === "${@}" || token === "$*" || token === "${*}";
}

function recordNpmCommandVariable(word, npmVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isNpmCommandToken(value, npmVariables)) {
    npmVariables.add(name);
  } else {
    npmVariables.delete(name);
  }
}

function recordNpxCommandVariable(word, npxVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isNpxCommandToken(value, npxVariables)) {
    npxVariables.add(name);
  } else {
    npxVariables.delete(name);
  }
}

function recordNpmPublishSubcommandVariable(word, publishSubcommandVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isNpmPublishSubcommandToken(value, publishSubcommandVariables)) {
    publishSubcommandVariables.add(name);
  } else {
    publishSubcommandVariables.delete(name);
  }
}

function shellVariableAssignment(word) {
  const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(word);
  return assignment ? { name: assignment[1], value: assignment[2] } : null;
}

function recordShellVariable(word, shellVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  shellVariables.set(assignment.name, resolveShellVariables(assignment.value, shellVariables));
}

function resolveShellVariables(word, shellVariables) {
  let resolved = word;
  for (let depth = 0; depth < 5; depth += 1) {
    const next = resolved
      .replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-+=?])([^}]*))?\}/gu,
        (match, name, operator = "", fallback = "") =>
          resolveShellParameterExpansion(match, name, operator, fallback, shellVariables),
      )
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/gu, (match, name) =>
        shellVariables.has(name) ? shellVariables.get(name) : match,
      );
    if (next === resolved) {
      return resolved;
    }
    resolved = next;
  }

  return resolved;
}

function resolveShellParameterExpansion(match, name, operator, fallback, shellVariables) {
  const hasValue = shellVariables.has(name);
  const value = hasValue ? shellVariables.get(name) : "";
  const isSetAndNonEmpty = hasValue && value !== "";

  if (!operator) {
    return hasValue ? value : match;
  }
  if (operator === "-") {
    return hasValue ? value : fallback;
  }
  if (operator === ":-" || operator === ":=" || operator === ":?") {
    return isSetAndNonEmpty ? value : fallback;
  }
  if (operator === "=" || operator === "?") {
    return hasValue ? value : fallback;
  }
  if (operator === "+") {
    return hasValue ? fallback : "";
  }
  if (operator === ":+") {
    return isSetAndNonEmpty ? fallback : "";
  }

  return match;
}

function shellTokens(line) {
  const tokens = [];
  let token = "";
  let quote = "";
  let escaped = false;

  const pushToken = () => {
    if (token) {
      tokens.push(token);
      token = "";
    }
  };

  const expandedLine = shellExpansionText(line);
  for (let index = 0; index < expandedLine.length; index += 1) {
    const char = expandedLine[index];

    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      token += char;
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      token += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      token += char;
      continue;
    }
    if (quote === "" && /\s/u.test(char)) {
      pushToken();
      continue;
    }
    if (quote === "" && /[;&|()]/u.test(char)) {
      pushToken();
      tokens.push(char);
      continue;
    }
    if (quote === "" && /[<>]/u.test(char)) {
      const repeated = expandedLine[index + 1] === char ? `${char}${char}` : char;
      if (repeated.length === 2) {
        index += 1;
      }
      if (/^\d+$/u.test(token)) {
        tokens.push(`${token}${repeated}`);
        token = "";
      } else {
        pushToken();
        tokens.push(repeated);
      }
      continue;
    }

    token += char;
  }

  pushToken();
  return tokens;
}

function shellExpansionText(line) {
  return line.replace(/\$(?:\{IFS\}|IFS)\b/gu, " ");
}

function shellCommandSubstitutionTexts(line) {
  const texts = [];
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (char === "$" && line[index + 1] === "(" && quote !== "'") {
      const command = readDollarCommandSubstitution(line, index + 2);
      if (command.closed) {
        texts.push(command.value);
        index = command.endIndex;
      }
      continue;
    }
    if (char !== "`" || quote === "'") {
      continue;
    }

    const command = readBacktickCommandSubstitution(line, index + 1);
    if (command.closed) {
      texts.push(command.value);
      index = command.endIndex;
    }
  }

  return texts;
}

function readDollarCommandSubstitution(line, startIndex) {
  let value = "";
  let quote = "";
  let escaped = false;
  let depth = 1;

  for (let index = startIndex; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      value += char;
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      value += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      value += char;
      continue;
    }
    if (quote === "" && char === "$" && line[index + 1] === "(") {
      depth += 1;
      value += "$(";
      index += 1;
      continue;
    }
    if (quote === "" && char === ")") {
      depth -= 1;
      if (depth === 0) {
        return { value, endIndex: index, closed: true };
      }
    }
    value += char;
  }

  return { value, endIndex: line.length - 1, closed: false };
}

function readBacktickCommandSubstitution(line, startIndex) {
  let value = "";
  let escaped = false;

  for (let index = startIndex; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "`") {
      return { value, endIndex: index, closed: true };
    }
    value += char;
  }

  return { value, endIndex: line.length - 1, closed: false };
}

function countEvalWrappedPublishCommands(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (command !== "eval") return 0;

  const scriptText = shellEvalArgument(tokens, index + 1, shellVariables);
  return scriptText ? countNpmPublishCommandsInShellText(scriptText) : 0;
}

function shellEvalArgument(tokens, startIndex, shellVariables) {
  const parts = [];
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    parts.push(token);
  }

  return parts.join(" ").trim();
}

function countInterpreterWrappedPublishCommands(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isShellInterpreterCommand(command)) return 0;

  let publishCommandCount = 0;
  for (let optionIndex = index + 1; optionIndex < tokens.length; optionIndex += 1) {
    const option = resolveShellVariables(shellWordValue(tokens[optionIndex]), shellVariables);
    if (isShellBoundaryToken(option)) break;
    if (isShellRedirectionToken(option)) {
      optionIndex += 1;
      continue;
    }
    if (!isInterpreterEvalOption(command, option)) continue;

    const scriptText = interpreterEvalArgument(tokens, optionIndex + 1, shellVariables);
    if (!scriptText) continue;
    publishCommandCount += countInterpreterEvalPublishCommands(command, scriptText);
    break;
  }

  return publishCommandCount;
}

function textUsesNonShellInterpreterEval(text) {
  return shellScanTexts(text).some((commandText) => shellTextUsesNonShellInterpreterEval(commandText));
}

function shellTextUsesNonShellInterpreterEval(text) {
  const shellVariables = new Map();
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => {
      const tokens = shellTokens(line);
      for (let index = 0; index < tokens.length; index += 1) {
        const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
        recordShellVariable(command, shellVariables);
        if (!isFileArgumentInterpreterToken(command) || isShellInterpreterCommand(command)) continue;
        if (interpreterCommandHasEvalSnippet(command, tokens, index + 1, shellVariables)) {
          return true;
        }
      }

      return false;
    });
}

function interpreterCommandHasEvalSnippet(command, tokens, startIndex, shellVariables) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (isInterpreterEvalOption(command, token)) {
      return true;
    }
    if (token === "--") {
      continue;
    }
    if (token.startsWith("-")) {
      if (interpreterFileOptionConsumesValue(token)) {
        index += 1;
      }
      continue;
    }
    return false;
  }

  return false;
}

function isShellInterpreterCommand(command) {
  return ["node", "bash", "sh"].includes(command.replace(/\\/gu, "/").split("/").pop() ?? "");
}

function isInterpreterEvalOption(command, option) {
  const basename = command.replace(/\\/gu, "/").split("/").pop() ?? "";
  if (basename === "node") {
    return option === "-e" || option === "--eval" || option === "-p" || option === "--print";
  }
  if (basename === "bash" || basename === "sh" || basename === "python" || basename === "python3") {
    return option === "-c";
  }
  if (basename === "perl" || basename === "ruby") {
    return option === "-e";
  }
  if (basename === "php") {
    return option === "-r";
  }
  if (basename === "bun") {
    return option === "-e" || option === "--eval";
  }

  return false;
}

function interpreterEvalArgument(tokens, startIndex, shellVariables) {
  const parts = [];
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    parts.push(token);
  }

  return parts.join(" ").trim();
}

function countInterpreterEvalPublishCommands(command, scriptText) {
  const basename = command.replace(/\\/gu, "/").split("/").pop() ?? "";
  if (basename === "node") {
    return countJavaScriptStringPublishCommands(scriptText);
  }

  return countNpmPublishCommandsInShellText(scriptText);
}

function countJavaScriptEmbeddedPublishCommands(text) {
  if (!/\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\b/u.test(text)) {
    return 0;
  }

  return countJavaScriptStringPublishCommands(text);
}

function countJavaScriptStringPublishCommands(text) {
  return javascriptStringTexts(text).reduce(
    (count, stringText) => count + countNpmPublishCommandsInShellText(stringText),
    0,
  );
}

function javascriptStringTexts(text) {
  const strings = [];
  for (let index = 0; index < text.length; index += 1) {
    const quote = text[index];
    if (quote !== "'" && quote !== "\"" && quote !== "`") continue;

    const string = readJavaScriptString(text, index + 1, quote);
    if (string.closed) {
      strings.push(string.value);
      index = string.endIndex;
    }
  }

  return strings;
}

function javascriptConcatenatedStringTexts(text) {
  const strings = [];
  for (let index = 0; index < text.length; index += 1) {
    const string = readJavaScriptStringConcatAt(text, index);
    if (!string.closed || string.parts < 2) continue;

    strings.push(string.value);
    index = string.endIndex;
  }

  return strings;
}

function readJavaScriptStringConcatAt(text, startIndex) {
  let index = skipJavaScriptWhitespace(text, startIndex);
  let value = "";
  let endIndex = index;
  let parts = 0;

  while (index < text.length) {
    const quote = text[index];
    if (quote !== "'" && quote !== "\"" && quote !== "`") {
      return { value, endIndex, parts, closed: parts > 0 };
    }

    const string = readJavaScriptString(text, index + 1, quote);
    if (!string.closed) {
      return { value, endIndex: string.endIndex, parts, closed: false };
    }

    value += string.value;
    parts += 1;
    endIndex = string.endIndex;
    index = skipJavaScriptWhitespace(text, string.endIndex + 1);
    if (text[index] !== "+") {
      return { value, endIndex, parts, closed: true };
    }
    index = skipJavaScriptWhitespace(text, index + 1);
  }

  return { value, endIndex, parts, closed: parts > 0 };
}

function skipJavaScriptWhitespace(text, index) {
  let currentIndex = index;
  while (/\s/u.test(text[currentIndex] ?? "")) {
    currentIndex += 1;
  }
  return currentIndex;
}

function readJavaScriptString(text, startIndex, quote) {
  let rawValue = "";
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      rawValue += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return { value: decodeDoubleQuotedYamlKey(rawValue), endIndex: index, closed: true };
    }
    rawValue += char;
  }

  return { value: rawValue, endIndex: text.length - 1, closed: false };
}

function isShellBoundaryToken(token) {
  return token === ";" || token === "&" || token === "|";
}

function isShellRedirectionToken(token) {
  return /^\d*(?:<|>|<<|>>)$/u.test(token);
}

function isShellOutputRedirectionToken(token) {
  return /^\d*(?:>|>>)$/u.test(token);
}

function isNpmCommandToken(token, npmVariables = new Set()) {
  const normalizedToken = token.replace(/\\/gu, "/");
  return (
    /(?:^|\/)npm$/u.test(normalizedToken) ||
    npmVariables.has(shellVariableReferenceName(token))
  );
}

function isNpxCommandToken(token, npxVariables = new Set()) {
  return (
    /(?:^|\/)npx$/u.test(token.replace(/\\/gu, "/")) ||
    npxVariables.has(shellVariableReferenceName(token))
  );
}

function isNpmPublishSubcommandToken(token, publishSubcommandVariables = new Set()) {
  return (
    NPM_PUBLISH_SUBCOMMANDS.has(token) ||
    publishSubcommandVariables.has(shellVariableReferenceName(token))
  );
}

function shellVariableReferenceName(token) {
  const braced = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/u.exec(token);
  if (braced) return braced[1];

  const plain = /^\$([A-Za-z_][A-Za-z0-9_]*)$/u.exec(token);
  return plain ? plain[1] : "";
}

function blockEntriesAtIndent(text, indent) {
  return text
    .split("\n")
    .filter((line) => countIndent(line) === indent)
    .map((line) => normalizedYamlLine(line))
    .filter((line) => line.includes(":"));
}

function topLevelChildKeys(block, indent) {
  return block
    .split("\n")
    .filter((line) => countIndent(line) === indent)
    .map((line) => normalizedYamlLine(line))
    .map((line) => yamlKey(line))
    .filter(Boolean);
}

function hasEnvLine(text, envLine, indent) {
  const envBlock = getOptionalBlock(text, "env:", indent);
  return envBlock ? hasLineAtIndent(envBlock, envLine, indent + 2) : false;
}

function hasEnvKey(text, envName, indent) {
  const envBlock = getOptionalBlock(text, "env:", indent);
  return (
    (envBlock ? hasEnvKeyAtIndent(envBlock, envName, indent + 2) : false) ||
    inlineMappingHasEnvKey(topLevelValue(text, "env:", indent), envName)
  );
}

function hasStepEnvKey(stepBlock, envName) {
  const envBlock = getStepChildBlock(stepBlock, "env:");
  return (
    (envBlock ? hasEnvKeyAtIndent(envBlock, envName, stepBaseIndent(stepBlock) + 4) : false) ||
    stepInlineEnvHasKey(stepBlock, envName)
  );
}

function stepInlineEnvHasKey(stepBlock, envName) {
  return inlineMappingHasEnvKey(stepTopLevelValue(stepBlock, "env:"), envName);
}

function stepRunCommand(stepBlock) {
  const line = stepBlock.split("\n").find((entry) => stepTopLevelLine(stepBlock, entry).startsWith("run: "));
  if (!line) return "";
  return stepTopLevelLine(stepBlock, line).slice("run: ".length);
}

function stepTopLevelValue(stepBlock, key) {
  const entry = stepBlock
    .split("\n")
    .map((entry) => stepTopLevelLine(stepBlock, entry))
    .find((entry) => yamlKey(entry) === key);

  return entry ? yamlValue(entry) : "";
}

function workflowDefaultsWorkingDirectory(workflow) {
  return Boolean(workflowDefaultsWorkingDirectoryValue(workflow));
}

function jobDefaultsWorkingDirectory(jobBlock) {
  return Boolean(jobDefaultsWorkingDirectoryValue(jobBlock));
}

function workflowDefaultsWorkingDirectoryValue(workflow) {
  const defaultsBlock = getOptionalBlock(workflow, "defaults:", 0);
  return (
    defaultsWorkingDirectoryValue(defaultsBlock, 2) ||
    inlineMappingValue(topLevelValue(workflow, "defaults:", 0), "working-directory")
  );
}

function jobDefaultsWorkingDirectoryValue(jobBlock) {
  const defaultsBlock = getOptionalBlock(jobBlock, "defaults:", 4);
  return (
    defaultsWorkingDirectoryValue(defaultsBlock, 6) ||
    inlineMappingValue(topLevelValue(jobBlock, "defaults:", 4), "working-directory")
  );
}

function defaultsWorkingDirectory(defaultsBlock, runIndent) {
  return Boolean(defaultsWorkingDirectoryValue(defaultsBlock, runIndent));
}

function defaultsWorkingDirectoryValue(defaultsBlock, runIndent) {
  const runBlock = getOptionalBlock(defaultsBlock, "run:", runIndent);
  const inlineDefaults = topLevelValue(defaultsBlock, "run:", runIndent);
  return (
    topLevelValue(runBlock, "working-directory:", runIndent + 2) ||
    inlineMappingValue(inlineDefaults, "working-directory") ||
    inlineRunMappingValue(topLevelValue(defaultsBlock, "defaults:", runIndent - 2), "working-directory")
  );
}

function workflowDefaultsShell(workflow) {
  const defaultsBlock = getOptionalBlock(workflow, "defaults:", 0);
  return defaultsShell(defaultsBlock, 2) || inlineMappingHasKey(topLevelValue(workflow, "defaults:", 0), "shell:");
}

function jobDefaultsShell(jobBlock) {
  const defaultsBlock = getOptionalBlock(jobBlock, "defaults:", 4);
  return defaultsShell(defaultsBlock, 6) || inlineMappingHasKey(topLevelValue(jobBlock, "defaults:", 4), "shell:");
}

function defaultsShell(defaultsBlock, runIndent) {
  const runBlock = getOptionalBlock(defaultsBlock, "run:", runIndent);
  const inlineDefaults = topLevelValue(defaultsBlock, "run:", runIndent);
  return (
    hasKeyAtIndent(runBlock, "shell:", runIndent + 2) ||
    inlineMappingHasKey(inlineDefaults, "shell:") ||
    inlineRunMappingHasKey(topLevelValue(defaultsBlock, "defaults:", runIndent - 2), "shell:")
  );
}

function hasKeyAtIndent(text, key, indent) {
  return text
    .split("\n")
    .some((line) => countIndent(line) === indent && yamlKey(normalizedYamlLine(line)) === key);
}

function hasEnvKeyAtIndent(text, key, indent) {
  if (!isNpmConfigEnvKey(key)) {
    return hasKeyAtIndent(text, key, indent);
  }

  const normalizedKey = normalizeEnvKeyName(key);
  return text
    .split("\n")
    .some(
      (line) =>
        countIndent(line) === indent &&
        normalizeEnvKeyName(yamlKey(normalizedYamlLine(line))) === normalizedKey,
    );
}

function topLevelValue(text, key, indent) {
  const entry = text
    .split("\n")
    .map((line) => (countIndent(line) === indent ? normalizedYamlLine(line) : ""))
    .find((line) => yamlKey(line) === key);

  return entry ? yamlValue(entry) : "";
}

function inlineMappingHasKey(value, key) {
  const expectedKey = key.slice(0, -1);
  return (
    inlineMappingKeys(value).some((keyName) => keyName === expectedKey) ||
    inlineMappingHasRawKey(value, expectedKey)
  );
}

function inlineMappingHasEnvKey(value, key) {
  if (!isNpmConfigEnvKey(key)) {
    return inlineMappingHasKey(value, key);
  }

  const normalizedKey = normalizeEnvKeyName(key);
  return inlineMappingKeys(value).some((keyName) => normalizeEnvKeyName(`${keyName}:`) === normalizedKey);
}

function inlineMappingKeys(value) {
  return inlineMappingEntries(value).map((entry) => entry.key);
}

function inlineMappingHasRawKey(value, key) {
  if (!value || !value.trim().startsWith("{")) return false;

  const keyPattern = new RegExp(`(?:^|[{,]\\s*)(?:"${key}"|'${key}'|${key})\\s*:`, "u");
  return keyPattern.test(value);
}

function inlineMappingValue(value, key) {
  return inlineMappingEntries(value).find((entry) => entry.key === key)?.value ?? "";
}

function inlineRunMappingHasKey(value, key) {
  const runMapping = inlineNestedMappingValue(value, "run");
  return runMapping ? inlineMappingHasKey(runMapping, key) : false;
}

function inlineRunMappingValue(value, key) {
  const runMapping = inlineNestedMappingValue(value, "run");
  return runMapping ? inlineMappingValue(runMapping, key) : "";
}

function inlineNestedMappingValue(value, key) {
  if (!value || !value.trim().startsWith("{")) return "";

  const entry = inlineMappingEntry(value, key);
  if (!entry) return "";

  const nestedValue = entry.value.trim();
  if (!nestedValue.startsWith("{")) return "";

  const mapping = readBalancedInlineMapping(nestedValue, 0);
  return mapping.closed ? mapping.value : "";
}

function inlineMappingEntry(value, expectedKey) {
  const text = value.trim();
  if (!text.startsWith("{")) return null;

  for (let index = 1; index < text.length; index += 1) {
    index = skipInlineMappingSpace(text, index);
    if (text[index] === ",") {
      continue;
    }
    if (text[index] === "}") {
      break;
    }

    const key = readInlineMappingKey(text, index);
    if (!key) return null;
    index = skipInlineMappingSpace(text, key.endIndex);
    if (text[index] !== ":") return null;
    index = skipInlineMappingSpace(text, index + 1);

    const entryValue = readInlineMappingValue(text, index);
    if (key.value === expectedKey) {
      return { key: key.value, value: entryValue.value };
    }
    index = entryValue.endIndex;
  }

  return null;
}

function skipInlineMappingSpace(text, index) {
  while (/[ \t\n\r]/u.test(text[index] ?? "")) {
    index += 1;
  }
  return index;
}

function readInlineMappingKey(text, startIndex) {
  const quote = text[startIndex];
  if (quote === '"' || quote === "'") {
    const scalar = readInlineQuotedScalar(text, startIndex, quote);
    return scalar.closed ? scalar : null;
  }

  const colonIndex = text.indexOf(":", startIndex);
  if (colonIndex === -1) return null;

  return {
    value: yamlScalarValue(text.slice(startIndex, colonIndex).trim()),
    endIndex: colonIndex,
    closed: true,
  };
}

function readInlineQuotedScalar(text, startIndex, quote) {
  let rawValue = "";
  let escaped = false;

  for (let index = startIndex + 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      rawValue += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return {
        value: unquoteYamlKey(`${quote}${rawValue}${quote}`),
        endIndex: index + 1,
        closed: true,
      };
    }
    rawValue += char;
  }

  return { value: rawValue, endIndex: text.length, closed: false };
}

function readInlineMappingValue(text, startIndex) {
  let quote = "";
  let escaped = false;
  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (quote !== "") continue;
    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      if (depth === 0) {
        return { value: text.slice(startIndex, index).trim(), endIndex: index };
      }
      depth -= 1;
      continue;
    }
    if (char === "," && depth === 0) {
      return { value: text.slice(startIndex, index).trim(), endIndex: index };
    }
  }

  return { value: text.slice(startIndex).trim(), endIndex: text.length };
}

function readBalancedInlineMapping(value, startIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === "\"") && quote === "") {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (quote !== "") continue;
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: value.slice(startIndex, index + 1), closed: true };
      }
    }
  }

  return { value: "", closed: false };
}

function inlineMappingEntries(value) {
  if (!value || !value.startsWith("{")) return [];

  const entries = [];
  const entryPattern =
    /(?:^|[{,]\s*)(?:"((?:\\.|[^"])*)"|'((?:''|[^'])*)'|((?:[^,{}:]|:(?!\s))+))\s*:\s*(?:"((?:\\.|[^"])*)"|'((?:''|[^'])*)'|([^,{}]*?))\s*(?=,|\})/gu;
  for (const match of value.matchAll(entryPattern)) {
    entries.push({
      key: inlineMappingScalarValue(match[1], match[2], match[3]),
      value: inlineMappingScalarValue(match[4], match[5], match[6]),
    });
  }
  return entries;
}

function inlineMappingScalarValue(doubleQuoted, singleQuoted, plain) {
  if (doubleQuoted !== undefined) return unquoteYamlKey(`"${doubleQuoted}"`);
  if (singleQuoted !== undefined) return unquoteYamlKey(`'${singleQuoted}'`);
  return yamlScalarValue((plain ?? "").trim());
}

function textHasBlockedNpmConfigEnvKey(text) {
  const keyPattern =
    /(?:^|[\s{,])["']?(npm_config_[^\s:=,'"{}]+(?::[^\s=,'"{}]+)?)["']?\s*[:=]/giu;
  for (const match of text.matchAll(keyPattern)) {
    if (isBlockedNpmConfigEnvKey(match[1])) {
      return true;
    }
  }

  return false;
}

function isBlockedNpmConfigEnvKey(envName) {
  const normalizedEnvName = normalizeEnvKeyName(envName);
  if (!normalizedEnvName.startsWith("npm_config_")) return false;

  const npmConfigKey = normalizedEnvName.slice("npm_config_".length);
  return isBlockedNpmConfigKey(npmConfigKey);
}

function workflowHasPackageWritePermission(workflow) {
  const lines = workflow.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);
    const key = yamlKey(normalizedLine);
    if (key !== "permissions:" && key !== "packages:") continue;

    let value = yamlScalarValue(yamlValue(normalizedLine));
    if (/^[|>]/u.test(value)) {
      const block = yamlRunBlockCommandText(lines, index, countIndent(line), value);
      value = yamlScalarValue(block.commandText);
      index = block.endIndex;
    }

    if (
      (key === "permissions:" && value === "write-all") ||
      (key === "packages:" && value === "write") ||
      inlineMappingHasPackageWrite(value)
    ) {
      return true;
    }
  }

  return false;
}

function inlineMappingHasPackageWrite(value) {
  return inlineMappingEntries(value).some((entry) => entry.key === "packages" && entry.value === "write");
}

function workflowUsesPublishAction(workflow) {
  return workflowScalarValues(workflow, "uses:").some((action) =>
    !isLocalPathToken(action) && action.toLowerCase().includes("publish"),
  );
}

function workflowUsesReleasePleaseAction(workflow) {
  const releaseActionName = actionName(contract.releaseWorkflow.releaseAction);
  return workflowScalarValues(workflow, "uses:").some((action) => actionName(action) === releaseActionName);
}

function actionName(action) {
  return action.toLowerCase().split("@")[0];
}

function workflowScalarValues(workflow, keyName) {
  const lines = workflow.split("\n");
  const values = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);
    if (yamlKey(normalizedLine) !== keyName) continue;

    const rawValue = yamlValue(normalizedLine);
    const value = yamlScalarValue(rawValue);
    if (/^[|>]/u.test(value)) {
      const block = yamlRunBlockCommandText(lines, index, countIndent(line), value);
      values.push(yamlScalarValue(block.commandText));
      index = block.endIndex;
    } else if (startsMultilineQuotedYamlScalar(rawValue)) {
      const scalar = yamlMultilineQuotedScalarText(lines, index, countIndent(line), rawValue);
      values.push(scalar.commandText);
      index = scalar.endIndex;
    } else if (hasMultilinePlainYamlScalar(lines, index, countIndent(line))) {
      const scalar = yamlMultilinePlainScalarText(lines, index, countIndent(line), value);
      values.push(scalar.commandText);
      index = scalar.endIndex;
    } else {
      values.push(value);
    }
  }

  return values;
}

function scriptHasBlockedNpmConfigCommand(script) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  const npmFunctionNames = new Set();
  return shellContinuationText(script)
    .split("\n")
    .some((line) => lineHasBlockedNpmConfigCommand(line, shellVariables, npmVariables, npmFunctionNames));
}

function lineHasBlockedNpmConfigCommand(
  line,
  shellVariables = new Map(),
  npmVariables = new Set(),
  npmFunctionNames = new Set(),
) {
  const tokens = shellTokens(line);
  if (
    shellCommandSubstitutionTexts(line).some((commandText) => scriptHasBlockedNpmConfigCommand(commandText)) ||
    javascriptEmbeddedHasBlockedNpmConfigCommand(line)
  ) {
    return true;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const word = shellWordValue(tokens[index]);
    recordShellVariable(word, shellVariables);
    const resolvedWord = resolveShellVariables(word, shellVariables);
    recordNpmCommandVariable(resolvedWord, npmVariables);
    const functionDefinition = recordNpmFunctionWrapper(tokens, index, shellVariables, npmVariables, npmFunctionNames);
    if (functionDefinition) {
      index = functionDefinition.endIndex;
      continue;
    }
    if (
      envSplitStringHasBlockedNpmConfigCommand(tokens, index, shellVariables) ||
      evalWrappedHasBlockedNpmConfigCommand(tokens, index, shellVariables) ||
      interpreterWrappedHasBlockedNpmConfigCommand(tokens, index, shellVariables)
    ) {
      return true;
    }
    if (!isNpmCommandToken(resolvedWord, npmVariables) && !npmFunctionNames.has(resolvedWord)) continue;

    const commandTokens = [];
    for (let commandIndex = index + 1; commandIndex < tokens.length; commandIndex += 1) {
      const token = resolveShellVariables(shellWordValue(tokens[commandIndex]), shellVariables);
      if (isShellRedirectionToken(token)) {
        commandIndex += 1;
        continue;
      }
      if (isShellBoundaryToken(token)) break;
      commandTokens.push(token);
    }

    if (npmCommandWritesBlockedConfig(commandTokens)) {
      return true;
    }
  }

  return false;
}

function envSplitStringHasBlockedNpmConfigCommand(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isEnvCommandToken(command)) return false;

  const scriptText = envSplitStringCommandText(tokens, index + 1, shellVariables);
  return scriptText ? scriptHasBlockedNpmConfigCommand(scriptText) : false;
}

function evalWrappedHasBlockedNpmConfigCommand(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (command !== "eval") return false;

  const scriptText = shellEvalArgument(tokens, index + 1, shellVariables);
  return scriptText ? scriptHasBlockedNpmConfigCommand(scriptText) : false;
}

function interpreterWrappedHasBlockedNpmConfigCommand(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isShellInterpreterCommand(command)) return false;

  for (let optionIndex = index + 1; optionIndex < tokens.length; optionIndex += 1) {
    const option = resolveShellVariables(shellWordValue(tokens[optionIndex]), shellVariables);
    if (isShellBoundaryToken(option)) break;
    if (isShellRedirectionToken(option)) {
      optionIndex += 1;
      continue;
    }
    if (!isInterpreterEvalOption(command, option)) continue;

    const scriptText = interpreterEvalArgument(tokens, optionIndex + 1, shellVariables);
    if (!scriptText) continue;
    return interpreterEvalHasBlockedNpmConfigCommand(command, scriptText);
  }

  return false;
}

function interpreterEvalHasBlockedNpmConfigCommand(command, scriptText) {
  const basename = command.replace(/\\/gu, "/").split("/").pop() ?? "";
  if (basename === "node") {
    return javascriptStringTexts(scriptText).some((stringText) => scriptHasBlockedNpmConfigCommand(stringText));
  }

  return scriptHasBlockedNpmConfigCommand(scriptText);
}

function javascriptEmbeddedHasBlockedNpmConfigCommand(text) {
  if (!/\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\b/u.test(text)) {
    return false;
  }

  return javascriptStringTexts(text).some((stringText) => scriptHasBlockedNpmConfigCommand(stringText));
}

function npmCommandWritesBlockedConfig(commandTokens) {
  for (let index = 0; index < commandTokens.length; index += 1) {
    if (commandTokens[index] === "config" || commandTokens[index] === "conf" || commandTokens[index] === "c") {
      const setIndex = commandTokens.indexOf("set", index + 1);
      if (setIndex !== -1 && commandHasBlockedNpmConfigKey(commandTokens.slice(setIndex + 1))) {
        return true;
      }
    }
    if (commandTokens[index] === "set" && commandHasBlockedNpmConfigKey(commandTokens.slice(index + 1))) {
      return true;
    }
  }

  return false;
}

function commandHasBlockedNpmConfigKey(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--") {
      continue;
    }
    if (token.startsWith("-")) {
      const optionName = npmOptionName(token);
      if (isBlockedNpmConfigKey(optionName)) {
        return true;
      }
      if (!token.includes("=") && npmConfigOptionConsumesValue(optionName)) {
        index += 1;
      }
      continue;
    }
    if (isBlockedNpmConfigKey(token.split("=")[0])) {
      return true;
    }
  }

  return false;
}

function npmOptionName(token) {
  return token.replace(/^-+/u, "").split("=")[0];
}

function npmConfigOptionConsumesValue(optionName) {
  return NPM_CONFIG_SET_OPTIONS_WITH_VALUE.has(optionName);
}

function hasNpmConfigKey(text, key) {
  return npmConfigEntry(text, key).present;
}

function isBlockedNpmConfigKey(key, options = {}) {
  const { blockScopedRegistry = true } = options;
  const normalizedKey = normalizeNpmConfigKey(key);
  return (
    BLOCKED_NPM_CONFIG_KEYS.includes(normalizedKey) ||
    (blockScopedRegistry && normalizedKey === normalizeNpmConfigKey(`${contract.checkWorkflow.scope}:registry`)) ||
    isBlockedNpmAuthConfigKey(normalizedKey)
  );
}

function isBlockedNpmAuthConfigKey(normalizedKey) {
  return /(?:^|:)(?:-auth|-authtoken|-password|username|email|always-auth)$/u.test(normalizedKey);
}

function npmConfigValue(text, key) {
  return npmConfigEntry(text, key).value;
}

function npmConfigEntry(text, key) {
  const normalizedKey = normalizeNpmConfigKey(key);
  for (const { key: entryKey, value } of npmConfigEntries(text)) {
    if (normalizeNpmConfigKey(entryKey) === normalizedKey) {
      return { present: true, value };
    }
  }

  return { present: false, value: "" };
}

function npmConfigEntries(text) {
  const entries = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const separatorIndex = line.indexOf("=");
    const key = separatorIndex === -1 ? line : line.slice(0, separatorIndex).trim();
    const value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).trim();
    entries.push({ key, value });
  }

  return entries;
}

function normalizeNpmConfigKey(key) {
  return key.toLowerCase().replace(/\[\]$/u, "").replace(/_/gu, "-");
}

function getStepChildBlock(stepBlock, header) {
  const indent = stepBaseIndent(stepBlock) + 2;
  return getOptionalBlock(stepBlock, header, indent);
}

function stepTopLevelLine(stepBlock, line) {
  const topLevelIndent = stepBaseIndent(stepBlock) + 2;
  if (countIndent(line) === stepBaseIndent(stepBlock) && line.trimStart().startsWith("- ")) {
    return normalizedYamlLine(line);
  }
  if (countIndent(line) !== topLevelIndent) {
    return "";
  }
  return normalizedYamlLine(line);
}

function stepBaseIndent(stepBlock) {
  const firstLine = stepBlock.split("\n").find((line) => line.trim() !== "");
  return firstLine ? countIndent(firstLine) : 0;
}

function normalizedYamlLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("- ") ? trimmed.slice(2) : trimmed;
}

function isYamlBlockHeader(line, header, indent) {
  return countIndent(line) === indent && yamlKey(normalizedYamlLine(line)) === header;
}

function isYamlChildBlockHeader(line, indent) {
  return countIndent(line) === indent && yamlKey(normalizedYamlLine(line)) !== "";
}

function yamlKey(line) {
  const quotedMatch = /^(['"])((?:\\.|(?!\1).)+)\1\s*:(?:\s|$)/u.exec(line);
  if (quotedMatch) {
    return `${unquoteYamlKey(`${quotedMatch[1]}${quotedMatch[2]}${quotedMatch[1]}`)}:`;
  }

  const match = /^((?:[^:[\]{}#]|:(?!\s|$))+?)\s*:(?:\s|$)/u.exec(line);
  return match ? `${unquoteYamlKey(match[1].trim())}:` : "";
}

function yamlValue(line) {
  if (!yamlKey(line)) return "";

  const quotedMatch = /^(['"])(?:\\.|(?!\1).)+\1\s*:/u.exec(line);
  if (quotedMatch) {
    return line.slice(quotedMatch[0].length).trim();
  }

  const match = /^((?:[^:[\]{}#]|:(?!\s|$))+?)\s*:(?:\s|$)/u.exec(line);
  return match ? line.slice(match[0].length).trim() : "";
}

function yamlScalarValue(value) {
  const trimmed = value.trim().replace(/^&[^ \t,[\]{}]+(?:[ \t]+|$)/u, "").trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return decodeDoubleQuotedYamlKey(trimmed.slice(1, -1));
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/gu, "'");
  }
  return trimmed;
}

function unquoteYamlKey(key) {
  if (key.startsWith('"') && key.endsWith('"')) {
    return decodeDoubleQuotedYamlKey(key.slice(1, -1));
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    return key.slice(1, -1).replace(/''/gu, "'");
  }
  return key;
}

function decodeDoubleQuotedYamlKey(key) {
  return key.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|(.))/gu, (
    _match,
    hexByte,
    hexWord,
    hexCodePoint,
    escaped,
  ) => {
    const codePoint = hexByte ?? hexWord ?? hexCodePoint;
    if (codePoint) {
      return String.fromCodePoint(Number.parseInt(codePoint, 16));
    }

    const escapes = {
      "0": "\0",
      a: "\x07",
      b: "\b",
      t: "\t",
      n: "\n",
      v: "\v",
      f: "\f",
      r: "\r",
      e: "\x1b",
      "\"": "\"",
      "/": "/",
      "\\": "\\",
      N: "\x85",
      _: "\xa0",
      L: "\u2028",
      P: "\u2029",
      " ": " ",
    };
    return escapes[escaped] ?? escaped;
  });
}

function hasLocalWorkflowExecution(workflow) {
  const lines = workflow.split("\n");
  if (workflowScalarValues(workflow, "uses:").some((action) => isLocalPathToken(action))) {
    return true;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;

    const indent = countIndent(line);
    const normalizedLine = normalizedYamlLine(line);

    if (yamlKey(normalizedLine) === "run:") {
      const rawRunValue = yamlValue(normalizedLine);
      const runValue = yamlScalarValue(rawRunValue);
      if (/^[|>]/u.test(runValue)) {
        const block = yamlRunBlockCommandText(lines, index, indent, runValue);
        if (shellTextInvokesLocalCode(block.commandText)) {
          return true;
        }
        index = block.endIndex;
      } else if (startsMultilineQuotedYamlScalar(rawRunValue)) {
        const scalar = yamlMultilineQuotedScalarText(lines, index, indent, rawRunValue);
        if (shellTextInvokesLocalCode(scalar.commandText)) {
          return true;
        }
        index = scalar.endIndex;
      } else if (hasMultilinePlainYamlScalar(lines, index, indent)) {
        const scalar = yamlMultilinePlainScalarText(lines, index, indent, runValue);
        if (shellTextInvokesLocalCode(scalar.commandText)) {
          return true;
        }
        index = scalar.endIndex;
      } else if (shellLineInvokesLocalCode(runValue)) {
        return true;
      }
    }
  }

  return workflowInvokesLocalCodeFromWorkingDirectory(workflow);
}

function workflowInvokesLocalCodeFromWorkingDirectory(workflow) {
  const workflowWorkingDirectory = workflowDefaultsWorkingDirectoryValue(workflow);
  const jobsBlock = getOptionalBlock(workflow, "jobs:", 0);

  for (const jobBlock of extractNestedBlocks(jobsBlock, 2)) {
    const jobWorkingDirectory = jobDefaultsWorkingDirectoryValue(jobBlock) || workflowWorkingDirectory;
    for (const stepBlock of extractStepBlocks(jobBlock)) {
      const stepWorkingDirectory =
        yamlScalarValue(stepTopLevelValue(stepBlock, "working-directory:")) || jobWorkingDirectory;
      if (!isNonRootWorkingDirectory(stepWorkingDirectory)) continue;

      if (stepRunCommandTexts(stepBlock).some((commandText) => shellTextInvokesBareLocalCode(commandText))) {
        return true;
      }
    }
  }

  return false;
}

function stepRunCommandTexts(stepBlock) {
  const lines = stepBlock.split("\n");
  const commandTexts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const topLevelLine = stepTopLevelLine(stepBlock, line);
    if (yamlKey(topLevelLine) !== "run:") continue;

    const rawRunValue = yamlValue(topLevelLine);
    const runValue = yamlScalarValue(rawRunValue);
    if (/^[|>]/u.test(runValue)) {
      const block = yamlRunBlockCommandText(lines, index, countIndent(line), runValue);
      commandTexts.push(block.commandText);
      index = block.endIndex;
    } else if (startsMultilineQuotedYamlScalar(rawRunValue)) {
      const scalar = yamlMultilineQuotedScalarText(lines, index, countIndent(line), rawRunValue);
      commandTexts.push(scalar.commandText);
      index = scalar.endIndex;
    } else if (hasMultilinePlainYamlScalar(lines, index, countIndent(line))) {
      const scalar = yamlMultilinePlainScalarText(lines, index, countIndent(line), runValue);
      commandTexts.push(scalar.commandText);
      index = scalar.endIndex;
    } else {
      commandTexts.push(runValue);
    }
  }

  return commandTexts;
}

function shellTextInvokesLocalCode(text) {
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => shellLineInvokesLocalCode(line));
}

function shellTextInvokesBareLocalCode(text) {
  return shellContinuationText(text)
    .split("\n")
    .some((line) => shellLineInvokesBareLocalCode(line));
}

function shellLineInvokesBareLocalCode(line) {
  const tokens = shellTokens(line).map((token) => shellWordValue(token));
  return tokens.some((token, index) => {
    if (isShellBoundaryToken(token) || isShellRedirectionToken(token)) return false;
    if (isBareLocalScriptToken(token)) return true;
    if (interpreterInvokesLocalModule(tokens, index)) return true;
    const scriptToken = interpreterFileArgumentToken(tokens, index + 1);
    return isFileArgumentInterpreterToken(token) && Boolean(scriptToken) && isBareInterpreterScriptToken(scriptToken);
  });
}

function isBareLocalScriptToken(token) {
  return /^[A-Za-z0-9_.-]+\.(?:cjs|js|mjs|sh|ts|tsx|py|rb|pl|php)$/u.test(token);
}

function isBareInterpreterScriptToken(token) {
  return /^[A-Za-z0-9_.-]+(?:\.(?:cjs|js|mjs|sh|ts|tsx|py|rb|pl|php))?$/u.test(token) && !token.startsWith("-");
}

function isNonRootWorkingDirectory(value) {
  const workingDirectory = yamlScalarValue(value).replace(/\/+$/u, "");
  return workingDirectory !== "" && workingDirectory !== "." && workingDirectory !== "./";
}

function shellLineInvokesLocalCode(line) {
  if (lineReferencesWorkspaceLocalPath(line)) {
    return true;
  }
  if (shellLineInvokesMake(line)) {
    return true;
  }

  const tokens = shellTokens(line).map((token) => shellWordValue(token));
  return tokens.some((token, index) => {
    if (isShellBoundaryToken(token) || isShellRedirectionToken(token)) return false;
    if (isLocalPathToken(token)) return true;
    if (interpreterInvokesLocalModule(tokens, index)) return true;
    const scriptToken = interpreterFileArgumentToken(tokens, index + 1);
    return (
      isFileArgumentInterpreterToken(token) &&
      Boolean(scriptToken) &&
      (isLocalPathToken(scriptToken) || isBareInterpreterScriptToken(scriptToken))
    );
  });
}

function interpreterInvokesLocalModule(tokens, index) {
  const command = tokens[index];
  if (!isFileArgumentInterpreterToken(command)) return false;
  const basename = commandBasename(command);
  if (basename !== "python" && basename !== "python3") return false;

  for (let tokenIndex = index + 1; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      tokenIndex += 1;
      continue;
    }
    if (token === "-m" || token === "--module") {
      return isBareInterpreterScriptToken(tokens[tokenIndex + 1] ?? "");
    }
    if (token === "--") continue;
    if (token.startsWith("-")) {
      if (interpreterFileOptionConsumesValue(token)) {
        tokenIndex += 1;
      }
      continue;
    }
    return false;
  }

  return false;
}

function shellLineInvokesMake(line) {
  const tokens = shellTokens(line).map((token) => shellWordValue(token));
  return tokens.some((token) => commandBasename(token) === "make" || commandBasename(token) === "gmake");
}

function interpreterFileArgumentToken(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) return "";
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    if (token === "-m" || token === "--module") {
      return "";
    }
    if (token.startsWith("-")) {
      if (interpreterFileOptionConsumesValue(token)) {
        index += 1;
      }
      continue;
    }
    return token;
  }

  return "";
}

function interpreterFileOptionConsumesValue(token) {
  return [
    "-c",
    "-e",
    "--eval",
    "-p",
    "--print",
    "-r",
    "--require",
    "--import",
    "--loader",
    "--experimental-loader",
  ].includes(token);
}

function isFileArgumentInterpreterToken(token) {
  return [
    "bash",
    "bun",
    "deno",
    "node",
    "perl",
    "php",
    "python",
    "python3",
    "ruby",
    "sh",
    "tsx",
  ].includes(commandBasename(token));
}

function isLocalPathToken(token) {
  return (
    token.startsWith("./") ||
    token.startsWith("../") ||
    isRelativeLocalPathToken(token) ||
    token.startsWith("$GITHUB_WORKSPACE/") ||
    token.startsWith("${GITHUB_WORKSPACE}/") ||
    /^\$\{\{\s*github\.workspace\s*\}\}\//u.test(token)
  );
}

function lineReferencesWorkspaceLocalPath(line) {
  return /(?:\$GITHUB_WORKSPACE|\$\{GITHUB_WORKSPACE\}|\$\{\{\s*github\.workspace\s*\}\})\//u.test(line);
}

function shellWordValue(token) {
  let value = "";
  let quote = "";

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === "$" && token[index + 1] === "'" && quote === "") {
      const ansiString = readBashAnsiCString(token, index + 2);
      value += ansiString.value;
      index = ansiString.endIndex;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (char === "\\" && quote !== "'") {
      index += 1;
      value += token[index] ?? "";
      continue;
    }
    value += char;
  }

  return value;
}

function readBashAnsiCString(token, startIndex) {
  let value = "";
  let index = startIndex;

  for (; index < token.length; index += 1) {
    const char = token[index];
    if (char === "'") {
      break;
    }
    if (char === "\\") {
      const escape = decodeBashAnsiEscape(token, index + 1);
      value += escape.value;
      index = escape.endIndex;
      continue;
    }
    value += char;
  }

  return { value, endIndex: index };
}

function decodeBashAnsiEscape(token, index) {
  const char = token[index] ?? "";
  const namedEscapes = {
    a: "\x07",
    b: "\b",
    e: "\x1b",
    E: "\x1b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
    "'": "'",
    "\"": "\"",
    "?": "?",
  };

  if (Object.hasOwn(namedEscapes, char)) {
    return { value: namedEscapes[char], endIndex: index };
  }

  if (char === "x") {
    return decodeFixedBashAnsiHexEscape(token, index + 1, 2, index);
  }
  if (char === "u") {
    return decodeFixedBashAnsiHexEscape(token, index + 1, 4, index);
  }
  if (char === "U") {
    return decodeFixedBashAnsiHexEscape(token, index + 1, 8, index);
  }
  if (/[0-7]/u.test(char)) {
    const match = /^[0-7]{1,3}/u.exec(token.slice(index));
    const octal = match?.[0] ?? char;
    return { value: String.fromCodePoint(Number.parseInt(octal, 8)), endIndex: index + octal.length - 1 };
  }

  return { value: char, endIndex: index };
}

function decodeFixedBashAnsiHexEscape(token, startIndex, maxLength, fallbackIndex) {
  const pattern = new RegExp(`^[0-9a-fA-F]{1,${maxLength}}`, "u");
  const match = pattern.exec(token.slice(startIndex));
  if (!match) {
    return { value: token[fallbackIndex] ?? "", endIndex: fallbackIndex };
  }

  const hex = match[0];
  return { value: String.fromCodePoint(Number.parseInt(hex, 16)), endIndex: startIndex + hex.length - 1 };
}

function isNpmConfigEnvKey(key) {
  return normalizeEnvKeyName(key).startsWith("npm_config_");
}

function normalizeEnvKeyName(key) {
  return unquoteYamlKey(key.replace(/:$/u, "").trim()).toLowerCase().replace(/-/gu, "_");
}

function countIndent(line) {
  return line.length - line.trimStart().length;
}

function relativePackagePath(path) {
  return path.startsWith(packagesRoot)
    ? path.slice(packagesRoot.length + 1)
    : path.slice(repoDir.length + 1);
}
