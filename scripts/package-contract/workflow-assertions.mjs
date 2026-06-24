import { countIndent, relativePackagePath } from "./local-workflow-scanner.mjs";
import { BLOCKED_AUDITED_NPM_ENV_KEYS, BLOCKED_NPM_CONFIG_ENV_KEYS, TRUSTED_GITHUB_RUNNER, contract, failures } from "./state.mjs";
import { getStepChildBlock, isYamlBlockHeader, normalizedYamlLine, stepBaseIndent, yamlKey, yamlValue } from "./workflow-action-config.mjs";
import { blockEntriesAtIndent, hasEnvKey, hasEnvLine, hasKeyAtIndent, hasStepEnvKey, jobDefaultsShell, jobDefaultsWorkingDirectory, stepInlineEnvHasKey, stepRunCommand, stepTopLevelValue, topLevelChildKeys, workflowDefaultsShell, workflowDefaultsWorkingDirectory } from "./yaml-inline-queries.mjs";
import { blockHasChildLines, countNpmPublishCommands, extractNestedBlocks, extractStepBlocks, hasLineAtIndent, hasTopLevelStepKey, hasTopLevelStepLine, jobTopLevelEntry, jobTopLevelValue } from "./yaml-workflow-parser.mjs";
import { join } from "node:path";

export function expectText(label, path, text, expected) {
  if (!text.includes(expected)) {
    fail(label, `${relativePackagePath(path)} must include ${expected}`);
  }
}

export function expectWorkflowName(label, path, workflow, name) {
  if (!hasLineAtIndent(workflow, `name: ${name}`, 0)) {
    fail(label, `${relativePackagePath(path)} workflow name must be ${name}`);
  }
}

export function expectStepLine(label, path, stepBlock, expected) {
  if (!hasTopLevelStepLine(stepBlock, expected)) {
    fail(label, `${relativePackagePath(path)} step must include exact ${expected}`);
  }
}

export function expectStepWithInput(label, path, stepBlock, inputName, expectedValue) {
  const expected = `${inputName}: ${expectedValue}`;
  const withBlock = getStepChildBlock(stepBlock, "with:");
  const inputIndent = stepBaseIndent(stepBlock) + 4;

  if (!withBlock || !hasLineAtIndent(withBlock, expected, inputIndent)) {
    fail(label, `${relativePackagePath(path)} step with block must include ${expected}`);
  }
}

export function expectStepWithoutInput(label, path, stepBlock, inputName) {
  const withBlock = getStepChildBlock(stepBlock, "with:");
  const inputIndent = stepBaseIndent(stepBlock) + 4;

  if (withBlock && hasKeyAtIndent(withBlock, `${inputName}:`, inputIndent)) {
    fail(label, `${relativePackagePath(path)} step with block must not include ${inputName}`);
  }
}

export function expectStepInputsOnly(label, path, stepBlock, allowedInputKeys) {
  const withBlock = getStepChildBlock(stepBlock, "with:");
  const inputIndent = stepBaseIndent(stepBlock) + 4;
  const inputKeys = blockEntriesAtIndent(withBlock, inputIndent).map((entry) => yamlKey(entry));

  for (const inputKey of inputKeys) {
    if (!allowedInputKeys.includes(inputKey)) {
      fail(label, `${relativePackagePath(path)} step with block must not include ${inputKey.slice(0, -1)}`);
    }
  }
}

export function expectNoStepChildBlock(label, path, stepBlock, header) {
  if (getStepChildBlock(stepBlock, header) || hasTopLevelStepKey(stepBlock, header)) {
    fail(label, `${relativePackagePath(path)} step must not include ${header}`);
  }
}

export function expectJobLine(label, path, jobBlock, expected, indent) {
  if (!hasLineAtIndent(jobBlock, expected, indent)) {
    fail(label, `${relativePackagePath(path)} job must include ${expected}`);
  }
}

export function expectBlockLine(label, path, block, expected, indent) {
  if (!hasLineAtIndent(block, expected, indent)) {
    fail(label, `${relativePackagePath(path)} block must include exact ${expected}`);
  }
}

export function expectSingleListEntry(label, path, block, expected, indent) {
  const expectedEntry = expected.startsWith("- ") ? expected.slice(2) : expected;
  const entries = block
    .split("\n")
    .filter((line) => countIndent(line) === indent && line.trimStart().startsWith("- "));

  if (entries.length !== 1 || normalizedYamlLine(entries[0]) !== expectedEntry) {
    fail(label, `${relativePackagePath(path)} block must include only ${expected}`);
  }
}

export function expectEffectivePermissions(label, path, workflow, jobBlock, expectedPermissions) {
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

export function expectJobPermissions(label, path, jobBlock, jobName, expectedPermissions) {
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

export function expectPublishGate(label, path, publishJob, publishStep) {
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

export function expectEnvAvailable(label, path, jobBlock, stepBlock, envLine) {
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

export function expectNoEnvKey(label, path, workflow, jobBlock, stepBlock, envName) {
  if (hasEnvKey(workflow, envName, 0) || hasEnvKey(jobBlock, envName, 4) || hasStepEnvKey(stepBlock, envName)) {
    fail(label, `${relativePackagePath(path)} publish step must not set ${envName}`);
  }
}

export function expectNoNpmConfigEnvOverrides(label, path, workflow, jobBlock, stepBlock, runCommand) {
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

export function expectNoYamlAnchorsOrAliases(label, path, workflow) {
  for (const line of workflow.split("\n")) {
    if (yamlLineHasAnchorOrAlias(normalizedYamlLine(line))) {
      fail(label, `${relativePackagePath(path)} must not use YAML anchors or aliases`);
      return;
    }
  }
}

export function yamlLineHasAnchorOrAlias(line) {
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

export function expectUnfilteredEvent(label, path, eventBlock, eventName) {
  if (blockHasChildLines(eventBlock) || yamlValue(normalizedYamlLine(eventBlock.split("\n")[0] ?? "")) !== "") {
    fail(label, `${relativePackagePath(path)} ${eventName} event must not be filtered`);
  }
}

export function expectPushBranchesOnly(label, path, pushBlock) {
  for (const key of topLevelChildKeys(pushBlock, 4)) {
    if (key !== "branches:") {
      fail(label, `${relativePackagePath(path)} push event must not include ${key}`);
    }
  }
}

export function expectBlockingJob(label, path, jobBlock, jobName, allowedCondition = "", allowedNeeds = "") {
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

export function expectJobRunner(label, path, jobBlock, jobName) {
  const runner = jobTopLevelValue(jobBlock, "runs-on:", 4);
  if (!runner) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must include runs-on`);
    return;
  }
  if (runner !== TRUSTED_GITHUB_RUNNER) {
    fail(label, `${relativePackagePath(path)} ${jobName} job runs-on must be ${TRUSTED_GITHUB_RUNNER}`);
  }
}

export function expectBlockingStep(label, path, stepBlock, runCommand, allowedCondition = "") {
  const stepCondition = stepTopLevelValue(stepBlock, "if:");
  if (stepCondition && stepCondition !== allowedCondition) {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not be conditional`);
  }
  const continueOnError = stepTopLevelValue(stepBlock, "continue-on-error:");
  if (continueOnError && continueOnError !== "false") {
    fail(label, `${relativePackagePath(path)} ${runCommand} step must not continue on error`);
  }
}

export function expectSinglePublishCommandText(label, path, workflow) {
  const publishCommandCount = countNpmPublishCommands(workflow);
  if (publishCommandCount !== 1) {
    fail(label, `${relativePackagePath(path)} must include exactly one npm publish command`);
  }
}

export function expectSingleActionText(label, path, workflow, action) {
  const actionCount = workflow
    .split("\n")
    .filter((line) => normalizedYamlLine(line) === `uses: ${action}`)
    .length;

  if (actionCount !== 1) {
    fail(label, `${relativePackagePath(path)} must include exactly one uses: ${action}`);
  }
}

export function expectWorkflowJobs(label, path, workflow, expectedJobKeys) {
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

export function expectEventKeys(label, path, onBlock, expectedKeys) {
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

export function expectPackageRootStep(label, path, workflow, jobBlock, stepBlock, runCommand) {
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

export function expectBlock(label, path, text, header, indent) {
  if (!text) return "";

  const lines = text.split("\n");
  const blockIndexes = lines.flatMap((line, index) => (isYamlBlockHeader(line, header, indent) ? [index] : []));
  const start = blockIndexes[0] ?? -1;

  if (start === -1) {
    fail(label, `${relativePackagePath(path)} must include ${header}`);
    return "";
  }
  if (blockIndexes.length > 1) {
    fail(label, `${relativePackagePath(path)} must not repeat ${header}`);
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

export function getOptionalBlock(text, header, indent) {
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

export function expectJobBlock(label, path, workflow, jobName) {
  const jobsBlock = expectBlock(label, path, workflow, "jobs:", 0);
  return expectBlock(label, path, jobsBlock, `${jobName}:`, 2);
}

export function expectJobBlockContainingRun(label, path, workflow, runCommand) {
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

export function expectSingleJobBlockContainingRun(label, path, workflow, runCommand) {
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

export function expectStepWithRun(label, path, jobBlock, runCommand) {
  const stepBlocks = extractStepBlocks(jobBlock);
  const stepBlock = stepBlocks.find((block) => stepRunCommand(block) === runCommand);

  if (!stepBlock) {
    fail(label, `${relativePackagePath(path)} must include exact run: ${runCommand} in a step`);
    return "";
  }

  return stepBlock;
}

export function expectStepWithUses(label, path, jobBlock, usesAction) {
  const stepBlocks = extractStepBlocks(jobBlock);
  const stepBlock = stepBlocks.find((block) => hasTopLevelStepLine(block, `uses: ${usesAction}`));

  if (!stepBlock) {
    fail(label, `${relativePackagePath(path)} must include uses: ${usesAction} in a step`);
    return "";
  }

  return stepBlock;
}

export function expectSingleStepWithUses(label, path, jobBlock, usesAction) {
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

export function expectStepOrder(label, path, jobBlock, beforeStep, afterStep, description) {
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

export function expectExactSteps(label, path, jobBlock, jobName, expectedSteps) {
  if (!jobBlock || expectedSteps.some((stepBlock) => !stepBlock)) return;

  const stepBlocks = extractStepBlocks(jobBlock);
  for (const stepBlock of stepBlocks) {
    if (hasTopLevelStepKey(stepBlock, "uses:") && hasTopLevelStepKey(stepBlock, "run:")) {
      fail(label, `${relativePackagePath(path)} step must not mix uses and run`);
    }
  }

  const stepsMatch =
    stepBlocks.length === expectedSteps.length &&
    expectedSteps.every((stepBlock, index) => stepBlocks[index] === stepBlock);

  if (!stepsMatch) {
    fail(label, `${relativePackagePath(path)} ${jobName} job must contain only audited steps`);
  }
}

export function arraysEqual(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function fail(label, message) {
  const failure = `${label}: ${message}`;
  if (!failures.includes(failure)) {
    failures.push(failure);
  }
}
