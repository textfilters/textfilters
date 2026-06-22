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
  const checkoutStep = expectStepWithUses(label, workflowPath, checkJob, contract.checkWorkflow.checkoutAction);
  const installStep = expectStepWithRun(
    label,
    workflowPath,
    checkJob,
    contract.checkWorkflow.installCommand,
  );
  const checkStep = expectStepWithRun(label, workflowPath, checkJob, contract.checkWorkflow.checkCommand);
  const setupNodeStep = expectStepWithUses(
    label,
    workflowPath,
    checkJob,
    contract.checkWorkflow.setupNodeAction,
  );

  expectWorkflowName(label, workflowPath, workflow, contract.checkWorkflow.name);
  expectUnfilteredEvent(label, workflowPath, pullRequestBlock, "pull_request");
  expectPushBranchesOnly(label, workflowPath, pushBlock);
  expectBlockingJob(label, workflowPath, checkJob, "check");
  expectBlockLine(label, workflowPath, branchesBlock, "- main", 6);
  expectEffectivePermission(label, workflowPath, workflow, checkJob, "contents: read");
  expectEffectivePermission(label, workflowPath, workflow, checkJob, "packages: read");
  expectBlockingStep(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectEnvAvailable(label, workflowPath, checkJob, installStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
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
  const onBlock = expectBlock(label, workflowPath, workflow, "on:", 0);
  const pushBlock = expectBlock(label, workflowPath, onBlock, "push:", 2);
  const branchesBlock = expectBlock(label, workflowPath, pushBlock, "branches:", 4);
  const releaseJob = expectJobBlock(label, workflowPath, workflow, "release-please");
  const releasePermissionsBlock = expectBlock(label, workflowPath, releaseJob, "permissions:", 4);
  const releaseOutputsBlock = expectBlock(label, workflowPath, releaseJob, "outputs:", 4);
  const releaseActionStep = expectStepWithUses(
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
  const publishPermissionsBlock = expectBlock(label, workflowPath, publishJob, "permissions:", 4);
  const checkoutStep = expectStepWithUses(label, workflowPath, publishJob, contract.checkWorkflow.checkoutAction);
  const setupNodeStep = expectStepWithUses(
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
  expectSinglePublishCommandText(label, workflowPath, workflow);
  expectPushBranchesOnly(label, workflowPath, pushBlock);
  expectBlockingJob(label, workflowPath, releaseJob, "release-please");
  expectBlockingJob(label, workflowPath, publishJob, "publish", contract.releaseWorkflow.publishCondition);
  expectBlockLine(label, workflowPath, branchesBlock, "- main", 6);
  expectBlockLine(label, workflowPath, releasePermissionsBlock, "contents: write", 6);
  expectBlockLine(label, workflowPath, releasePermissionsBlock, "issues: write", 6);
  expectBlockLine(label, workflowPath, releasePermissionsBlock, "pull-requests: write", 6);
  expectBlockLine(label, workflowPath, releaseOutputsBlock, contract.releaseWorkflow.releaseCreatedOutput, 6);
  expectBlockingStep(label, workflowPath, releaseActionStep, contract.releaseWorkflow.releaseAction);
  expectStepLine(label, workflowPath, releaseActionStep, `id: ${contract.releaseWorkflow.releaseStepId}`);
  expectStepWithInput(label, workflowPath, releaseActionStep, "token", contract.releaseWorkflow.token);
  expectStepWithInput(label, workflowPath, releaseActionStep, "config-file", contract.releaseWorkflow.configFile);
  expectStepWithInput(label, workflowPath, releaseActionStep, "manifest-file", contract.releaseWorkflow.manifestFile);
  expectJobLine(label, workflowPath, publishJob, `needs: ${contract.releaseWorkflow.publishNeeds}`, 4);
  expectPublishGate(label, workflowPath, publishJob, publishStep);
  expectBlockLine(label, workflowPath, publishPermissionsBlock, "contents: read", 6);
  expectBlockLine(label, workflowPath, publishPermissionsBlock, "packages: write", 6);
  expectBlockingStep(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectEnvAvailable(label, workflowPath, publishJob, installStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectEnvAvailable(label, workflowPath, publishJob, publishStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
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

function expectBuildBeforeDistSmoke(label, scripts) {
  const checkCommands = splitScriptCommands(scripts?.check);
  const smokeCommands = splitScriptCommands(scripts?.["smoke:dist"]);
  const checkBuildIndex = checkCommands.indexOf("npm run build");
  const checkSmokeIndex = checkCommands.indexOf("npm run smoke:dist");

  if (checkBuildIndex !== -1 && checkSmokeIndex !== -1 && checkBuildIndex < checkSmokeIndex) {
    return;
  }

  if (checkSmokeIndex !== -1 && smokeCommands.indexOf("npm run build") === 0) {
    return;
  }

  fail(label, "check script must run or delegate npm run build before smoke:dist");
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

function expectEffectivePermission(label, path, workflow, jobBlock, permission) {
  const jobPermissions = getOptionalBlock(jobBlock, "permissions:", 4);
  const scopeBlock = jobPermissions || getOptionalBlock(workflow, "permissions:", 0);
  const permissionIndent = jobPermissions ? 6 : 2;

  if (!scopeBlock || !hasLineAtIndent(scopeBlock, permission, permissionIndent)) {
    fail(label, `${relativePackagePath(path)} job permissions must include ${permission}`);
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

function expectUnfilteredEvent(label, path, eventBlock, eventName) {
  if (blockHasChildLines(eventBlock)) {
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

function expectBlockingJob(label, path, jobBlock, jobName, allowedCondition = "") {
  const jobCondition = jobTopLevelValue(jobBlock, "if:", 4);
  if (jobCondition && jobCondition !== allowedCondition) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not be conditional`);
  }
  const continueOnError = jobTopLevelValue(jobBlock, "continue-on-error:", 4);
  if (continueOnError && continueOnError !== "false") {
    fail(label, `${relativePackagePath(path)} ${jobName} job must not continue on error`);
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

function expectPackageRootStep(label, path, workflow, jobBlock, stepBlock, runCommand) {
  if (workflowDefaultsWorkingDirectory(workflow)) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not inherit a working directory`);
  }
  if (jobDefaultsWorkingDirectory(jobBlock)) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not inherit a working directory`);
  }

  const workingDirectory = stepTopLevelValue(stepBlock, "working-directory:");
  if (workingDirectory && workingDirectory !== ".") {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must run at the package root`);
  }
}

function expectBlock(label, path, text, header, indent) {
  if (!text) return "";

  const lines = text.split("\n");
  const prefix = " ".repeat(indent);
  const start = lines.findIndex((line) => line === `${prefix}${header}`);

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
  const prefix = " ".repeat(indent);
  const start = lines.findIndex((line) => line === `${prefix}${header}`);

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
    if (countIndent(lines[index]) === indent && lines[index].trim().endsWith(":")) {
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
  const stepsIndex = lines.findIndex((line) => line.trim() === "steps:");
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
    .some((line) => stepTopLevelLine(stepBlock, line).startsWith(key));
}

function jobTopLevelValue(jobBlock, key, indent) {
  const line = jobBlock
    .split("\n")
    .map((entry) => (countIndent(entry) === indent ? normalizedYamlLine(entry) : ""))
    .find((entry) => entry.startsWith(`${key} `));

  return line ? line.slice(key.length).trim() : "";
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
  return text
    .split("\n")
    .filter((line) => /(^|\s)npm\s+publish(\s|$)/u.test(line))
    .length;
}

function topLevelChildKeys(block, indent) {
  return block
    .split("\n")
    .filter((line) => countIndent(line) === indent)
    .map((line) => normalizedYamlLine(line))
    .filter((line) => line.endsWith(":"));
}

function hasEnvLine(text, envLine, indent) {
  const envBlock = getOptionalBlock(text, "env:", indent);
  return envBlock ? hasLineAtIndent(envBlock, envLine, indent + 2) : false;
}

function stepRunCommand(stepBlock) {
  const line = stepBlock.split("\n").find((entry) => stepTopLevelLine(stepBlock, entry).startsWith("run: "));
  if (!line) return "";
  return stepTopLevelLine(stepBlock, line).slice("run: ".length);
}

function stepTopLevelValue(stepBlock, key) {
  const line = stepBlock
    .split("\n")
    .map((entry) => stepTopLevelLine(stepBlock, entry))
    .find((entry) => entry.startsWith(`${key} `));

  return line ? line.slice(key.length).trim() : "";
}

function workflowDefaultsWorkingDirectory(workflow) {
  const defaultsBlock = getOptionalBlock(workflow, "defaults:", 0);
  return defaultsWorkingDirectory(defaultsBlock, 2);
}

function jobDefaultsWorkingDirectory(jobBlock) {
  const defaultsBlock = getOptionalBlock(jobBlock, "defaults:", 4);
  return defaultsWorkingDirectory(defaultsBlock, 6);
}

function defaultsWorkingDirectory(defaultsBlock, runIndent) {
  const runBlock = getOptionalBlock(defaultsBlock, "run:", runIndent);
  return hasKeyAtIndent(runBlock, "working-directory:", runIndent + 2);
}

function hasKeyAtIndent(text, key, indent) {
  return text
    .split("\n")
    .some((line) => countIndent(line) === indent && normalizedYamlLine(line).startsWith(key));
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

function countIndent(line) {
  return line.length - line.trimStart().length;
}

function relativePackagePath(path) {
  return path.startsWith(packagesRoot)
    ? path.slice(packagesRoot.length + 1)
    : path.slice(repoDir.length + 1);
}
