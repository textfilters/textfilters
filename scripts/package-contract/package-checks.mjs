import { expectNoPublishInScripts } from "./local-script-execution.mjs";
import { hasLocalWorkflowExecution, relativePackagePath } from "./local-workflow-scanner.mjs";
import { expectAbsentPrivate, expectAuditedPackageScriptTemplates, expectBuildBeforeDistSmoke, expectCheckScriptOnlyAuditedCommands, expectDelegatedScriptWork, expectEqual, expectNoPackageFileExclusions, expectOnlyJsonObjectKeys, expectOnlyPackageConfig, expectReleasePleaseConfigKeys, expectScriptCommand, expectScriptCommandOrder, expectSemver, readJson, readText } from "./package-json-policy.mjs";
import { textUsesAwkSystemExecution, textUsesNonShellInterpreterEval } from "./shell-publish-counter.mjs";
import { expectNoExitBeforeScriptCommands, expectNoUnsupportedPackageScriptSyntax, hasShellAliasDefinition, hasShellCommandSubstitution, hasShellFunctionDefinition, hasShellProcessSubstitution, textFeedsShellInterpreterOnStdin, workflowRunCommandsUseShellGlobs, workflowRunCommandsUseUnsupportedShellParameterExpansion, workflowRunCommandsWriteGeneratedTempScripts, workflowUsesUnsupportedRunShell } from "./shell-script-syntax.mjs";
import { BLOCKED_AUDITED_NPM_ENV_KEYS, BLOCKED_NPM_CONFIG_ENV_KEYS, contract } from "./state.mjs";
import { expectAuditableNpmCiLockfile, expectNoDependencyInstallLifecycleScripts, expectNoExecutedPackageToolingMutations, expectNoLocalDependencySpecs, expectNoNpmBinaryShadowing, expectNoPublishEnvMutationInScripts, expectNoPublishLifecycleScripts, expectNoWorkspaces, expectSafeNpmConfig, npmCiLockfilePath, scriptMutatesPackageManifest, scriptUsesChildProcessExecution, scriptUsesFindExec, scriptUsesNpmExec, scriptUsesXargs, scriptWritesGitHubActionsEnvironmentFile, scriptWritesNpmConfigFile } from "./tooling-mutations.mjs";
import { workflowHasPackageWritePermission, workflowUsesPublishAction, workflowUsesReleasePleaseAction } from "./workflow-action-config.mjs";
import { expectBlock, expectBlockLine, expectBlockingJob, expectBlockingStep, expectEffectivePermissions, expectEnvAvailable, expectEventKeys, expectExactSteps, expectJobBlock, expectJobBlockContainingRun, expectJobLine, expectJobPermissions, expectJobRunner, expectNoEnvKey, expectNoNpmConfigEnvOverrides, expectNoStepChildBlock, expectNoStepEnvKey, expectNoYamlAnchorsOrAliases, expectPackageRootStep, expectPublishGate, expectPushBranchesOnly, expectSingleActionText, expectSingleJobBlockContainingRun, expectSingleListEntry, expectSinglePublishCommandText, expectSingleStepWithUses, expectStepInputsOnly, expectStepLine, expectStepOrder, expectStepWithInput, expectStepWithRun, expectStepWithoutInput, expectUnfilteredEvent, expectWorkflowJobs, expectWorkflowName, fail, getOptionalBlock } from "./workflow-assertions.mjs";
import { stepTopLevelKeyCount, textHasBlockedNpmConfigEnvKey, textHasBlockedWorkflowStartupEnvKey } from "./yaml-inline-queries.mjs";
import { extractNestedBlocks, extractStepBlocks, hasNpmPublishCommand, stripYamlComments } from "./yaml-workflow-parser.mjs";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function checkPackage(pkgSpec, packageDir) {
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

export function checkWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;
  expectNoYamlAnchorsOrAliases(label, workflowPath, workflow);
  expectNoDuplicateWorkflowStepRunKeys(label, workflowPath, workflow);
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
  expectBlockingStep(label, workflowPath, checkoutStep, contract.checkWorkflow.checkoutAction);
  expectBlockingStep(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectStepInputsOnly(label, workflowPath, setupNodeStep, ["node-version:", "registry-url:", "scope:"]);
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

export function checkReleaseWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;
  expectNoYamlAnchorsOrAliases(label, workflowPath, workflow);
  expectNoDuplicateWorkflowStepRunKeys(label, workflowPath, workflow);
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
  expectBlockingStep(label, workflowPath, checkoutStep, contract.checkWorkflow.checkoutAction);
  expectBlockingStep(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectStepInputsOnly(label, workflowPath, setupNodeStep, ["node-version:", "registry-url:", "scope:"]);
  for (const envName of BLOCKED_AUDITED_NPM_ENV_KEYS) {
    expectNoStepEnvKey(label, workflowPath, setupNodeStep, contract.checkWorkflow.setupNodeAction, envName);
  }
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

export function checkReleaseConfig(label, releaseConfigPath, packageName) {
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

export function checkReleaseManifest(label, releaseManifestPath, packageVersion) {
  if (!existsSync(releaseManifestPath)) {
    fail(label, `missing ${contract.releaseWorkflow.manifestFile}`);
    return;
  }

  const manifest = readJson(releaseManifestPath);
  expectSemver(label, "release-please manifest .", manifest["."]);
  expectEqual(label, "release-please manifest .", manifest["."], packageVersion);
}

export function checkPublishCommandScope(label, packageDir, releaseWorkflowPath) {
  const workflowsDir = join(packageDir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return;

  const checkWorkflowPath = join(packageDir, contract.checkWorkflow.path);
  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/u.test(entry.name)) continue;

    const workflowPath = join(workflowsDir, entry.name);
    if (workflowPath === releaseWorkflowPath) continue;

    const workflow = stripYamlComments(readFileSync(workflowPath, "utf8"));
    expectNoYamlAnchorsOrAliases(label, workflowPath, workflow);
    if (workflowPath !== checkWorkflowPath) {
      expectNoDuplicateWorkflowStepRunKeys(label, workflowPath, workflow);
    }
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

export function expectNoUnsupportedWorkflowCommands(label, path, workflow) {
  if (hasShellCommandSubstitution(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use shell command substitution`);
  }
  if (hasShellProcessSubstitution(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use shell process substitution`);
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
  if (workflowRunCommandsUseShellGlobs(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use shell globs in run commands`);
  }
  if (workflowRunCommandsUseUnsupportedShellParameterExpansion(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use unsupported shell parameter expansion`);
  }
  if (workflowRunCommandsWriteGeneratedTempScripts(workflow)) {
    fail(label, `${relativePackagePath(path)} must not write generated workflow scripts`);
  }
  if (workflowUsesUnsupportedRunShell(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use non-shell run shells`);
  }
  if (scriptUsesChildProcessExecution(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use child_process command execution`);
  }
  if (textUsesAwkSystemExecution(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use awk command execution`);
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
  if (scriptUsesFindExec(workflow)) {
    fail(label, `${relativePackagePath(path)} must not use find command execution`);
  }
  if (scriptMutatesPackageManifest(workflow)) {
    fail(label, `${relativePackagePath(path)} must not mutate package.json`);
  }
  if (textHasBlockedNpmConfigEnvKey(workflow)) {
    fail(label, `${relativePackagePath(path)} must not set publish-altering npm config env`);
  }
  if (textHasBlockedWorkflowStartupEnvKey(workflow)) {
    fail(label, `${relativePackagePath(path)} must not set startup hook env`);
  }
  if (scriptWritesGitHubActionsEnvironmentFile(workflow)) {
    fail(label, `${relativePackagePath(path)} must not write GitHub Actions environment files`);
  }
  if (scriptWritesNpmConfigFile(workflow)) {
    fail(label, `${relativePackagePath(path)} must not write npm config files`);
  }
}

export function expectNoDuplicateWorkflowStepRunKeys(label, path, workflow) {
  const jobsBlock = getOptionalBlock(workflow, "jobs:", 0);
  for (const jobBlock of extractNestedBlocks(jobsBlock, 2)) {
    for (const stepBlock of extractStepBlocks(jobBlock)) {
      if (stepTopLevelKeyCount(stepBlock, "run:") > 1) {
        fail(label, `${relativePackagePath(path)} step must not repeat run`);
      }
    }
  }
}

export function expectNoBlockedNpmConfigEnvKeys(label, path, workflow) {
  if (textHasBlockedNpmConfigEnvKey(workflow)) {
    fail(label, `${relativePackagePath(path)} must not set publish-altering npm config env`);
  }
}
