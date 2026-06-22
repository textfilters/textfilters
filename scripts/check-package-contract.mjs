import { existsSync, readFileSync } from "node:fs";
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
  checkReleaseConfig(label, releaseConfigPath, pkgSpec.name);
  checkReleaseManifest(label, releaseManifestPath, pkg.version);
}

function checkWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;
  const onBlock = expectBlock(label, workflowPath, workflow, "on:", 0);
  const pushBlock = expectBlock(label, workflowPath, onBlock, "push:", 2);
  const checkJob = expectJobBlockContainingRun(
    label,
    workflowPath,
    workflow,
    contract.checkWorkflow.checkCommand,
  );
  const installStep = expectStepWithRun(
    label,
    workflowPath,
    checkJob,
    contract.checkWorkflow.installCommand,
  );
  expectStepWithRun(label, workflowPath, checkJob, contract.checkWorkflow.checkCommand);
  const setupNodeStep = expectStepWithUses(
    label,
    workflowPath,
    checkJob,
    contract.checkWorkflow.setupNodeAction,
  );

  expectText(label, workflowPath, workflow, `name: ${contract.checkWorkflow.name}`);
  expectText(label, workflowPath, onBlock, "pull_request:");
  expectText(label, workflowPath, pushBlock, "branches:");
  expectText(label, workflowPath, pushBlock, "- main");
  expectEffectivePermission(label, workflowPath, workflow, checkJob, "contents: read");
  expectEffectivePermission(label, workflowPath, workflow, checkJob, "packages: read");
  expectStepWithUses(label, workflowPath, checkJob, contract.checkWorkflow.checkoutAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectEnvAvailable(label, workflowPath, checkJob, installStep, "NODE_AUTH_TOKEN: ${{ github.token }}");

  expectOrder(
    label,
    workflowPath,
    checkJob,
    `uses: ${contract.checkWorkflow.checkoutAction}`,
    `run: ${contract.checkWorkflow.installCommand}`,
  );
  expectOrder(
    label,
    workflowPath,
    checkJob,
    `uses: ${contract.checkWorkflow.setupNodeAction}`,
    `run: ${contract.checkWorkflow.installCommand}`,
  );
  expectOrder(
    label,
    workflowPath,
    checkJob,
    `run: ${contract.checkWorkflow.installCommand}`,
    `run: ${contract.checkWorkflow.checkCommand}`,
  );
}

function checkReleaseWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;
  const onBlock = expectBlock(label, workflowPath, workflow, "on:", 0);
  const pushBlock = expectBlock(label, workflowPath, onBlock, "push:", 2);
  const releaseJob = expectJobBlock(label, workflowPath, workflow, "release-please");
  const releasePermissionsBlock = expectBlock(label, workflowPath, releaseJob, "permissions:", 4);
  const releaseActionStep = expectStepWithUses(
    label,
    workflowPath,
    releaseJob,
    contract.releaseWorkflow.releaseAction,
  );
  const publishJob = expectJobBlockContainingRun(
    label,
    workflowPath,
    workflow,
    contract.releaseWorkflow.publishCommand,
  );
  const publishPermissionsBlock = expectBlock(label, workflowPath, publishJob, "permissions:", 4);
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

  expectText(label, workflowPath, workflow, `name: ${contract.releaseWorkflow.name}`);
  expectText(label, workflowPath, pushBlock, "branches:");
  expectText(label, workflowPath, pushBlock, "- main");
  expectText(label, workflowPath, releasePermissionsBlock, "contents: write");
  expectText(label, workflowPath, releasePermissionsBlock, "issues: write");
  expectText(label, workflowPath, releasePermissionsBlock, "pull-requests: write");
  expectText(label, workflowPath, releaseJob, "outputs:");
  expectText(label, workflowPath, releaseJob, contract.releaseWorkflow.releaseCreatedOutput);
  expectStepLine(label, workflowPath, releaseActionStep, `id: ${contract.releaseWorkflow.releaseStepId}`);
  expectStepWithInput(label, workflowPath, releaseActionStep, "token", contract.releaseWorkflow.token);
  expectStepWithInput(label, workflowPath, releaseActionStep, "config-file", contract.releaseWorkflow.configFile);
  expectStepWithInput(label, workflowPath, releaseActionStep, "manifest-file", contract.releaseWorkflow.manifestFile);
  expectJobLine(label, workflowPath, publishJob, `needs: ${contract.releaseWorkflow.publishNeeds}`);
  expectPublishGate(label, workflowPath, publishJob, publishStep);
  expectText(label, workflowPath, publishPermissionsBlock, "contents: read");
  expectText(label, workflowPath, publishPermissionsBlock, "packages: write");
  expectStepWithUses(label, workflowPath, publishJob, contract.checkWorkflow.checkoutAction);
  expectStepWithInput(label, workflowPath, setupNodeStep, "node-version", contract.checkWorkflow.nodeVersion);
  expectStepWithInput(label, workflowPath, setupNodeStep, "registry-url", contract.checkWorkflow.registryUrl);
  expectStepWithInput(label, workflowPath, setupNodeStep, "scope", `"${contract.checkWorkflow.scope}"`);
  expectEnvAvailable(label, workflowPath, publishJob, installStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectEnvAvailable(label, workflowPath, publishJob, publishStep, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectBlockingStep(label, workflowPath, checkStep, contract.checkWorkflow.checkCommand);

  expectOrder(
    label,
    workflowPath,
    publishJob,
    `uses: ${contract.checkWorkflow.checkoutAction}`,
    `run: ${contract.checkWorkflow.installCommand}`,
  );
  expectOrder(
    label,
    workflowPath,
    publishJob,
    `uses: ${contract.checkWorkflow.setupNodeAction}`,
    `run: ${contract.checkWorkflow.installCommand}`,
  );
  expectOrder(
    label,
    workflowPath,
    publishJob,
    `run: ${contract.checkWorkflow.installCommand}`,
    `run: ${contract.checkWorkflow.checkCommand}`,
  );
  expectOrder(
    label,
    workflowPath,
    publishJob,
    `run: ${contract.checkWorkflow.checkCommand}`,
    `run: ${contract.releaseWorkflow.publishCommand}`,
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

function expectStepLine(label, path, stepBlock, expected) {
  if (!hasTopLevelStepLine(stepBlock, expected)) {
    fail(label, `${relativePackagePath(path)} step must include exact ${expected}`);
  }
}

function expectStepWithInput(label, path, stepBlock, inputName, expectedValue) {
  const expected = `${inputName}: ${expectedValue}`;
  const withBlock = getStepChildBlock(stepBlock, "with:");

  if (!withBlock || !hasLine(withBlock, expected)) {
    fail(label, `${relativePackagePath(path)} step with block must include ${expected}`);
  }
}

function expectJobLine(label, path, jobBlock, expected) {
  if (!hasLine(jobBlock, expected)) {
    fail(label, `${relativePackagePath(path)} job must include ${expected}`);
  }
}

function expectEffectivePermission(label, path, workflow, jobBlock, permission) {
  const jobPermissions = getOptionalBlock(jobBlock, "permissions:", 4);
  const scopeBlock = jobPermissions || getOptionalBlock(workflow, "permissions:", 0);

  if (!scopeBlock || !hasLine(scopeBlock, permission)) {
    fail(label, `${relativePackagePath(path)} job permissions must include ${permission}`);
  }
}

function expectPublishGate(label, path, publishJob, publishStep) {
  const condition = `if: ${contract.releaseWorkflow.publishCondition}`;
  if (hasLineAtIndent(publishJob, condition, 4) || hasLine(publishStep, condition)) {
    return;
  }

  fail(label, `${relativePackagePath(path)} publish job or publish step must include ${condition}`);
}

function expectEnvAvailable(label, path, jobBlock, stepBlock, envLine) {
  const stepEnvBlock = getStepChildBlock(stepBlock, "env:");
  if (hasEnvLine(jobBlock, envLine, 4) || (stepEnvBlock && hasLine(stepEnvBlock, envLine))) {
    return;
  }

  fail(label, `${relativePackagePath(path)} step must have ${envLine} available`);
}

function expectBlockingStep(label, path, stepBlock, runCommand) {
  if (hasTopLevelStepKey(stepBlock, "if:")) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not be conditional`);
  }
  if (hasTopLevelStepLine(stepBlock, "continue-on-error: true")) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not continue on error`);
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

function expectOrder(label, path, text, before, after) {
  const beforeIndex = text.indexOf(before);
  const afterIndex = text.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1) {
    return;
  }
  if (beforeIndex > afterIndex) {
    fail(label, `${relativePackagePath(path)} must place ${before} before ${after}`);
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

function hasLineAtIndent(text, expected, indent) {
  const prefix = " ".repeat(indent);
  return text.split("\n").some((line) => line === `${prefix}${expected}`);
}

function hasEnvLine(text, envLine, indent) {
  const envBlock = getOptionalBlock(text, "env:", indent);
  return envBlock ? hasLine(envBlock, envLine) : false;
}

function stepRunCommand(stepBlock) {
  const line = stepBlock.split("\n").find((entry) => stepTopLevelLine(stepBlock, entry).startsWith("run: "));
  if (!line) return "";
  return stepTopLevelLine(stepBlock, line).slice("run: ".length);
}

function getStepChildBlock(stepBlock, header) {
  const indent = stepBaseIndent(stepBlock) + 2;
  return getOptionalBlock(stepBlock, header, indent);
}

function stepTopLevelLine(stepBlock, line) {
  const topLevelIndent = stepBaseIndent(stepBlock) + 2;
  if (countIndent(line) !== topLevelIndent && !line.trimStart().startsWith("- ")) {
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
