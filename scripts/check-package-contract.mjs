import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
const NPM_PUBLISH_SUBCOMMANDS = new Set(["publish", "pu", "pub", "publ", "publi", "publis"]);
const BLOCKED_NPM_CONFIG_KEYS = [
  "dry-run",
  "globalconfig",
  "ignore-scripts",
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

  for (const file of contract.manifest.requiredFiles) {
    if (!Array.isArray(pkg.files) || !pkg.files.includes(file)) {
      fail(label, `package files must include ${file}`);
    }
    if (file !== "dist" && !existsSync(join(packageDir, file))) {
      fail(label, `package file entry ${file} must exist`);
    }
  }
  expectNoPackageFileExclusions(label, packageDir, pkg.files);

  if (
    !contract.manifest.requiredLockfiles.some((lockfile) => existsSync(join(packageDir, lockfile)))
  ) {
    fail(label, `missing one of ${contract.manifest.requiredLockfiles.join(", ")}`);
  }

  for (const scriptName of contract.manifest.requiredScriptNames) {
    if (typeof pkg.scripts?.[scriptName] !== "string") {
      fail(label, `missing script ${scriptName}`);
    } else if (pkg.scripts[scriptName].trim() === "") {
      fail(label, `script ${scriptName} must not be empty`);
    }
  }

  for (const [scriptName, expected] of Object.entries(contract.manifest.requiredScripts)) {
    expectEqual(label, `script ${scriptName}`, pkg.scripts?.[scriptName], expected);
  }

  for (const command of contract.manifest.checkScriptMustInclude) {
    expectScriptCommand(label, "check", pkg.scripts?.check, command);
  }
  expectScriptCommandOrder(label, "check", pkg.scripts?.check, contract.manifest.checkScriptMustInclude);
  expectCheckScriptOnlyAuditedCommands(label, pkg.scripts?.check);
  expectNoExitBeforeScriptCommands(label, "check", pkg.scripts?.check, contract.manifest.checkScriptMustInclude);
  expectNoPublishInScripts(label, pkg.scripts);
  expectNoPublishEnvMutationInScripts(label, pkg.scripts);
  expectNoPublishLifecycleScripts(label, pkg.scripts);
  expectNoWorkspaces(label, pkg);
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
  expectNoNpmScriptShellOverride(label, workflowPath, workflow, checkJob, checkStep);
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
  expectNoNpmScriptShellOverride(label, workflowPath, workflow, publishJob, checkStep);
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
    if (hasNpmPublishCommand(workflow)) {
      fail(
        label,
        `${relativePackagePath(workflowPath)} must not include npm publish`,
      );
    }
    if (workflow.includes(contract.releaseWorkflow.releaseAction)) {
      fail(
        label,
        `${relativePackagePath(workflowPath)} must not include ${contract.releaseWorkflow.releaseAction}`,
      );
    }
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

  if (existsSync(join(packageDir, "dist", ".npmignore"))) {
    fail(label, "dist must not include .npmignore");
  }
  if (existsSync(join(packageDir, "dist", ".gitignore"))) {
    fail(label, "dist must not include .gitignore");
  }
}

function expectOnlyPackageConfig(label, config) {
  const packageKeys = Object.keys(config.packages ?? {});
  if (packageKeys.length !== 1 || packageKeys[0] !== ".") {
    fail(label, 'release-please packages must include only "."');
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
  const commands = splitScriptCommands(script);
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
  }
}

function expectBuildBeforeDistSmoke(label, scripts) {
  const checkCommands = splitScriptCommands(scripts?.check);
  const smokeCommands = splitScriptCommands(scripts?.["smoke:dist"]);
  const checkBuildIndex = checkCommands.indexOf("npm run build");
  const checkSmokeIndex = checkCommands.indexOf("npm run smoke:dist");

  expectDistSmokeWork(label, smokeCommands);

  if (checkBuildIndex !== -1 && checkSmokeIndex !== -1 && checkBuildIndex < checkSmokeIndex) {
    return;
  }

  if (checkSmokeIndex !== -1 && smokeCommands.indexOf("npm run build") === 0 && smokeCommands.length > 1) {
    return;
  }

  fail(label, "check script must run or delegate npm run build before smoke:dist");
}

function expectDistSmokeWork(label, smokeCommands) {
  if (smokeCommands.length === 0) return;
  if (smokeCommands.includes("exit 0")) {
    fail(label, "smoke:dist script must not exit before dist smoke work");
    return;
  }
  if (smokeCommands.every((command) => command === "npm run build")) {
    fail(label, "smoke:dist script must do more than build");
  }
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

function expectNoNpmScriptShellOverride(label, path, workflow, jobBlock, stepBlock) {
  const envName = "npm_config_script_shell:";
  if (hasEnvKey(workflow, envName, 0) || hasEnvKey(jobBlock, envName, 4) || hasStepEnvKey(stepBlock, envName)) {
    fail(label, `${relativePackagePath(path)} npm run check step must not set ${envName}`);
  }
}

function expectNoYamlAnchorsOrAliases(label, path, workflow) {
  for (const line of workflow.split("\n")) {
    const value = yamlValue(normalizedYamlLine(line));
    if (/(^|\s)[&*](?![&*])[^ \t,[\]{}]+/u.test(value)) {
      fail(label, `${relativePackagePath(path)} must not use YAML anchors or aliases`);
      return;
    }
  }
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
}

function expectJobRunner(label, path, jobBlock, jobName) {
  if (!jobTopLevelValue(jobBlock, "runs-on:", 4)) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must include runs-on`);
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
  if (typeof script !== "string") return [];
  return script
    .split(/\s+&&\s+/u)
    .map((command) => command.trim())
    .filter(Boolean);
}

function expectNoScriptCommandBefore(label, scriptName, script, anchorCommand, blockedCommand) {
  const commands = splitScriptCommands(script);
  const anchorIndex = commands.indexOf(anchorCommand);
  if (anchorIndex === -1) return;

  if (commands.slice(0, anchorIndex).includes(blockedCommand)) {
    fail(label, `script ${scriptName} must not run ${blockedCommand} before ${anchorCommand}`);
  }
}

function expectNoExitBeforeScriptCommands(label, scriptName, script, anchorCommands) {
  for (const anchorCommand of anchorCommands) {
    expectNoScriptCommandBefore(label, scriptName, script, anchorCommand, "exit 0");
  }
}

function expectNoPublishInScripts(label, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script === "string" && hasNpmPublishCommand(script)) {
      fail(label, `script ${scriptName} must not include npm publish`);
    }
  }
}

function expectNoPublishEnvMutationInScripts(label, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script !== "string") continue;
    if (/\bGITHUB_(ENV|PATH)\b/u.test(script)) {
      fail(label, `script ${scriptName} must not write GitHub Actions environment files`);
    }
    if (textHasBlockedNpmConfigEnvKey(script)) {
      fail(label, `script ${scriptName} must not set publish-altering npm config env`);
    }
  }
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

function expectSafeNpmConfig(label, npmrcPath) {
  if (!existsSync(npmrcPath)) return;

  const npmrc = readFileSync(npmrcPath, "utf8");

  for (const key of BLOCKED_NPM_CONFIG_KEYS) {
    if (hasNpmConfigKey(npmrc, key)) {
      fail(label, `.npmrc must not set ${key}`);
    }
  }

  for (const key of ["registry", `${contract.checkWorkflow.scope}:registry`]) {
    const value = npmConfigValue(npmrc, key);
    if (value && value !== contract.manifest.publishConfig.registry) {
      fail(label, `.npmrc ${key} must be ${contract.manifest.publishConfig.registry}`);
    }
  }
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
  return shellContinuationText(text)
    .split("\n")
    .reduce((count, line) => count + countNpmPublishCommandsInLine(line), 0);
}

function shellContinuationText(text) {
  return text.replace(/\\[ \t]*\n[ \t]*/gu, "");
}

function lineHasNpmPublishCommand(line) {
  return countNpmPublishCommandsInLine(line) > 0;
}

function countNpmPublishCommandsInLine(line) {
  const tokens = shellTokens(line);
  let publishCommandCount = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    if (shellWordValue(tokens[index]) !== "npm") continue;

    for (let commandIndex = index + 1; commandIndex < tokens.length; commandIndex += 1) {
      const token = shellWordValue(tokens[commandIndex]);
      if (isShellBoundaryToken(token)) {
        break;
      }
      if (NPM_PUBLISH_SUBCOMMANDS.has(token)) {
        publishCommandCount += 1;
        break;
      }
    }
  }

  return publishCommandCount;
}

function shellTokens(line) {
  return line
    .replace(/([;&|<>])/gu, " $1 ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function isShellBoundaryToken(token) {
  return token === ";" || token === "&" || token === "|" || token === "<" || token === ">";
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
  const defaultsBlock = getOptionalBlock(workflow, "defaults:", 0);
  return (
    defaultsWorkingDirectory(defaultsBlock, 2) ||
    inlineMappingHasKey(topLevelValue(workflow, "defaults:", 0), "working-directory:")
  );
}

function jobDefaultsWorkingDirectory(jobBlock) {
  const defaultsBlock = getOptionalBlock(jobBlock, "defaults:", 4);
  return (
    defaultsWorkingDirectory(defaultsBlock, 6) ||
    inlineMappingHasKey(topLevelValue(jobBlock, "defaults:", 4), "working-directory:")
  );
}

function defaultsWorkingDirectory(defaultsBlock, runIndent) {
  const runBlock = getOptionalBlock(defaultsBlock, "run:", runIndent);
  return (
    hasKeyAtIndent(runBlock, "working-directory:", runIndent + 2) ||
    inlineMappingHasKey(topLevelValue(defaultsBlock, "run:", runIndent), "working-directory:")
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
  return (
    hasKeyAtIndent(runBlock, "shell:", runIndent + 2) ||
    inlineMappingHasKey(topLevelValue(defaultsBlock, "run:", runIndent), "shell:")
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
  if (!value || !value.startsWith("{")) return false;

  const keyName = key.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[{,]\\s*)(?:"${keyName}"|'${keyName}'|${keyName})\\s*:`, "u").test(value);
}

function inlineMappingHasEnvKey(value, key) {
  if (!isNpmConfigEnvKey(key)) {
    return inlineMappingHasKey(value, key);
  }

  if (!value || !value.startsWith("{")) return false;

  const normalizedKey = normalizeEnvKeyName(key);
  const keyPattern = /(?:^|[{,]\s*)(?:"([^"]+)"|'([^']+)'|([^,{}:]+))\s*:/gu;
  for (const match of value.matchAll(keyPattern)) {
    const keyName = match[1] ?? match[2] ?? match[3] ?? "";
    if (normalizeEnvKeyName(`${keyName.trim()}:`) === normalizedKey) {
      return true;
    }
  }

  return false;
}

function textHasBlockedNpmConfigEnvKey(text) {
  const keyPattern = /[A-Za-z_][A-Za-z0-9_@:-]*/gu;
  for (const match of text.matchAll(keyPattern)) {
    if (BLOCKED_NPM_CONFIG_ENV_KEYS.has(normalizeEnvKeyName(`${match[0]}:`))) {
      return true;
    }
  }

  return false;
}

function hasNpmConfigKey(text, key) {
  return npmConfigValue(text, key) !== "";
}

function npmConfigValue(text, key) {
  const normalizedKey = normalizeNpmConfigKey(key);
  const entry = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line.includes("=") && !line.startsWith("#") && !line.startsWith(";"))
    .find((line) => normalizeNpmConfigKey(line.slice(0, line.indexOf("=")).trim()) === normalizedKey);

  return entry ? entry.slice(entry.indexOf("=") + 1).trim() : "";
}

function normalizeNpmConfigKey(key) {
  return key.toLowerCase().replace(/_/gu, "-");
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

  const match = /^([^:[\]{}#]+?)\s*:(?:\s|$)/u.exec(line);
  return match ? `${unquoteYamlKey(match[1].trim())}:` : "";
}

function yamlValue(line) {
  if (!yamlKey(line)) return "";

  const quotedMatch = /^(['"])(?:\\.|(?!\1).)+\1\s*:/u.exec(line);
  if (quotedMatch) {
    return line.slice(quotedMatch[0].length).trim();
  }

  return line.slice(line.indexOf(":") + 1).trim();
}

function unquoteYamlKey(key) {
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    return key.slice(1, -1);
  }
  return key;
}

function shellWordValue(token) {
  let value = "";
  let quote = "";

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
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
