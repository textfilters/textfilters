import { isNpmCommandToken, isNpxCommandToken, isShellBoundaryToken, isShellOutputRedirectionToken, isShellRedirectionToken, javascriptConcatenatedStringTexts, javascriptJoinedStringTexts, javascriptStaticTemplateTexts, javascriptStringTexts, readJavaScriptStaticStringAt } from "./javascript-string-scanner.mjs";
import { commandBasename, expectNoUnsupportedLocalScriptText, isPathInsidePackageDir, listPackageScriptFiles, localScriptDependencyPaths } from "./local-script-execution.mjs";
import { relativePackagePath, shellWordValue } from "./local-workflow-scanner.mjs";
import { checkWorkflow } from "./package-checks.mjs";
import { readJson } from "./package-json-policy.mjs";
import { recordNpmCommandVariable, recordNpxCommandVariable, recordShellVariable, resolveShellVariables, shellTokens } from "./shell-publish-counter.mjs";
import { shellCommentText } from "./shell-script-syntax.mjs";
import { AUDITED_RUNNER_CPU, AUDITED_RUNNER_LIBC, AUDITED_RUNNER_OS, CHILD_PROCESS_EXECUTION_METHODS, CHILD_PROCESS_EXECUTION_METHOD_PATTERN, DEPENDENCY_GROUPS, DEPENDENCY_INSTALL_LIFECYCLE_SCRIPTS, EXECUTED_TOOLING_CONFIG_FILES, EXECUTED_TOOLING_SCRIPT_EXTENSIONS, NPM_MANIFEST_MUTATION_SUBCOMMANDS, contract } from "./state.mjs";
import { isBlockedNpmConfigKey, npmConfigEntries, npmConfigEntry, npmConfigOptionConsumesValue, npmOptionName, scriptHasBlockedNpmConfigCommand } from "./workflow-action-config.mjs";
import { fail } from "./workflow-assertions.mjs";
import { textHasBlockedNpmConfigEnvKey } from "./yaml-inline-queries.mjs";
import { hasNpmPublishCommand, shellContinuationText, shellScanTexts } from "./yaml-workflow-parser.mjs";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";

export function expectNoPublishEnvMutationInScripts(label, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script !== "string") continue;
    expectNoPublishEnvMutationInScriptText(label, `script ${scriptName}`, script);
  }
}

export function expectNoExecutedPackageToolingMutations(label, packageDir) {
  const toolingTextCache = new Map();
  for (const scriptPath of executedPackageToolingScriptPaths(packageDir)) {
    const scriptText = readExecutedToolingScriptText(scriptPath, packageDir, new Set(), toolingTextCache);
    if (!scriptText) continue;

    const subject = `tooling file ${relativePackagePath(scriptPath)}`;
    if (hasNpmPublishCommand(scriptText)) {
      fail(label, `${subject} must not include npm publish`);
    }
    expectNoUnsupportedLocalScriptText(label, subject, scriptText);
    expectNoPublishEnvMutationInScriptText(label, subject, scriptText);
  }
}

export function executedPackageToolingScriptPaths(packageDir) {
  const scriptPaths = new Set();

  for (const configFile of EXECUTED_TOOLING_CONFIG_FILES) {
    const configPath = join(packageDir, configFile);
    if (existsSync(configPath)) {
      scriptPaths.add(configPath);
    }
  }

  collectExecutedToolingScriptPaths(join(packageDir, "tests"), scriptPaths);
  collectVitestDefaultTestScriptPaths(packageDir, scriptPaths);
  return [...scriptPaths].filter((scriptPath) => isPathInsidePackageDir(scriptPath, packageDir));
}

export function collectVitestDefaultTestScriptPaths(packageDir, scriptPaths) {
  for (const scriptPath of listPackageScriptFiles(packageDir)) {
    if (isVitestDefaultTestFilePath(scriptPath)) {
      scriptPaths.add(scriptPath);
    }
  }
}

export function isVitestDefaultTestFilePath(path) {
  const fileName = path.replace(/\\/gu, "/").split("/").pop() ?? "";
  return /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u.test(fileName);
}

export function collectExecutedToolingScriptPaths(directory, scriptPaths) {
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

export function isExecutedToolingScriptFile(path) {
  if (path.endsWith(".d.ts")) return false;
  return EXECUTED_TOOLING_SCRIPT_EXTENSIONS.has(extname(path));
}

export function readExecutedToolingScriptText(scriptPath, packageDir, visited = new Set(), textCache = new Map()) {
  if (!existsSync(scriptPath)) return "";
  if (!isPathInsidePackageDir(scriptPath, packageDir)) return "";
  if (visited.has(scriptPath)) return "";
  if (textCache.has(scriptPath)) return textCache.get(scriptPath);
  visited.add(scriptPath);

  let scriptText = "";
  try {
    scriptText = readFileSync(scriptPath, "utf8");
  } catch {
    return "";
  }

  const dependencyTexts = localScriptDependencyPaths(scriptText, dirname(scriptPath), packageDir)
    .filter((dependencyPath) => shouldScanExecutedToolingDependency(dependencyPath, packageDir))
    .map((dependencyPath) => readExecutedToolingScriptText(dependencyPath, packageDir, visited, textCache));
  const combinedText = [scriptText, ...dependencyTexts].filter(Boolean).join("\n");
  textCache.set(scriptPath, combinedText);
  return combinedText;
}

export function shouldScanExecutedToolingDependency(dependencyPath, packageDir) {
  const relativePath = dependencyPath.slice(packageDir.length + 1);
  return (
    relativePath !== "package.json" &&
    relativePath !== "package-lock.json"
  );
}

export function expectNoPublishEnvMutationInScriptText(label, subject, script) {
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

export function scriptWritesGitHubActionsEnvironmentFile(script) {
  if (/\bGITHUB_(ENV|PATH)\b/u.test(script)) {
    return true;
  }
  if (
    [
      ...javascriptConcatenatedStringTexts(script),
      ...javascriptJoinedStringTexts(script),
      ...javascriptStaticTemplateTexts(script),
    ].some((value) => value === "GITHUB_ENV" || value === "GITHUB_PATH")
  ) {
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

export function scriptWritesNpmConfigFile(script) {
  const npmConfigWriteApiPattern =
    /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\([\s\S]{0,240}\.npmrc/u;
  if (
    npmConfigWriteApiPattern.test(script) ||
    scriptWritesTargetFileThroughJavaScriptLiteral(script, isNpmConfigPathToken) ||
    scriptWritesTargetFileThroughJavaScriptVariable(script, isNpmConfigPathToken) ||
    scriptCopiesTargetFileThroughJavaScriptArgument(script, isNpmConfigPathToken) ||
    scriptComputesTargetPathNearWriteOperation(script, isNpmConfigPathToken) ||
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

export function scriptUsesChildProcessExecution(script) {
  return (
    scriptReferencesChildProcessModule(script) &&
    scriptReferencesChildProcessExecutionMethod(script)
  );
}

export function scriptReferencesChildProcessExecutionMethod(script) {
  return (
    CHILD_PROCESS_EXECUTION_METHOD_PATTERN.test(script) ||
    javascriptStringTexts(script).some((value) => CHILD_PROCESS_EXECUTION_METHODS.has(value)) ||
    javascriptConcatenatedStringTexts(script).some((value) => CHILD_PROCESS_EXECUTION_METHODS.has(value))
  );
}

export function scriptReferencesChildProcessModule(script) {
  return (
    /\b(?:node:)?child_process\b/u.test(script) ||
    javascriptStringTexts(script).some((value) => value === "child_process" || value === "node:child_process") ||
    javascriptConcatenatedStringTexts(script).some(
      (value) => value === "child_process" || value === "node:child_process",
    )
  );
}

export function scriptUsesNpmExec(script) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  const npxVariables = new Set();
  return shellContinuationText(shellCommentText(script))
    .split("\n")
    .some((line) => lineUsesNpmExec(line, shellVariables, npmVariables, npxVariables));
}

export function scriptUsesXargs(script) {
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

export function scriptUsesFindExec(script) {
  return shellScanTexts(script).some((commandText) =>
    shellContinuationText(shellCommentText(commandText))
      .split("\n")
      .some((line) =>
        shellTokens(line).some((token) => {
          const word = commandBasename(shellWordValue(token));
          return word === "find" && /\s-exec(?:dir)?\s/u.test(` ${line} `);
        }),
      ),
  );
}

export function lineUsesNpmExec(line, shellVariables, npmVariables, npxVariables) {
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

export function scriptMutatesPackageManifest(script) {
  return scriptHasNpmPackageCommand(script) || scriptWritesPackageManifestFile(script);
}

export function scriptHasNpmPackageCommand(script) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  return shellContinuationText(shellCommentText(script))
    .split("\n")
    .some((line) => lineHasNpmPackageCommand(line, shellVariables, npmVariables));
}

export function lineHasNpmPackageCommand(line, shellVariables, npmVariables) {
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

export function scriptWritesPackageManifestFile(script) {
  const packageWriteApiPattern =
    /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\([\s\S]{0,240}package\.json/u;
  if (
    packageWriteApiPattern.test(script) ||
    scriptWritesTargetFileThroughJavaScriptLiteral(script, isPackageManifestPathToken) ||
    scriptWritesTargetFileThroughJavaScriptVariable(script, isPackageManifestPathToken) ||
    scriptCopiesTargetFileThroughJavaScriptArgument(script, isPackageManifestPathToken) ||
    scriptComputesTargetPathNearWriteOperation(script, isPackageManifestPathToken) ||
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

export function scriptWritesTargetFileThroughJavaScriptLiteral(script, isTargetPathToken) {
  const writeCallPattern = /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\(/gu;
  for (const match of script.matchAll(writeCallPattern)) {
    const string = readJavaScriptStaticStringAt(script, match.index + match[0].length);
    if (string.closed && isTargetPathToken(string.value)) {
      return true;
    }
  }

  return false;
}

export function scriptWritesTargetFileThroughJavaScriptVariable(script, isTargetPathToken) {
  const targetVariables = new Set();
  const assignmentPattern = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/gu;

  for (const match of script.matchAll(assignmentPattern)) {
    const string = readJavaScriptStaticStringAt(script, match.index + match[0].length);
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

export function scriptCopiesTargetFileThroughJavaScriptArgument(script, isTargetPathToken) {
  const copyCallPattern = /\bcopyFile(?:Sync)?\s*\([\s\S]{0,160}?,\s*/gu;
  for (const match of script.matchAll(copyCallPattern)) {
    const target = readJavaScriptStaticStringAt(script, match.index + match[0].length);
    if (target.closed && isTargetPathToken(target.value)) {
      return true;
    }
  }

  return false;
}

export function scriptComputesTargetPathNearWriteOperation(script, isTargetPathToken) {
  if (!scriptUsesJavaScriptWriteApi(script)) return false;

  return javascriptJoinedStringTexts(script).some((value) => isTargetPathToken(value));
}

export function scriptUsesJavaScriptWriteApi(script) {
  return /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|openSync)\s*\(/u.test(script);
}

export function scriptMentionsTargetPathWithWriteOperation(script, isTargetPathToken) {
  if (
    !/\b(?:append(?:File(?:Sync)?)?|copy(?:File(?:Sync)?)?|cp(?:Sync)?|create(?:WriteStream)?|link(?:Sync)?|open(?:Sync)?|rename|replace|symlink(?:Sync)?|touch|truncate|write(?:File(?:Sync)?)?)(?:\b|_)/u.test(script)
  ) {
    return false;
  }

  return [
    ...javascriptStringTexts(script),
    ...javascriptConcatenatedStringTexts(script),
    ...javascriptStaticTemplateTexts(script),
  ].some((value) => isTargetPathToken(value));
}

export function shellTokensWritePackageManifestFile(tokens) {
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

export function shellTokensWriteNpmConfigFile(tokens) {
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

export function teeCommandTargetsNpmConfig(tokens, startIndex) {
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

export function teeCommandTargetsPackageManifest(tokens, startIndex) {
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

export function copyCommandTargetsFile(tokens, startIndex, isTargetPathToken) {
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

export function isTeeCommandToken(token) {
  return /(?:^|\/)tee$/u.test(token.replace(/\\/gu, "/"));
}

export function isCopyCommandToken(token) {
  return /(?:^|\/)cp$/u.test(token.replace(/\\/gu, "/"));
}

export function isInPlaceEditCommandToken(token) {
  return /(?:^|\/)(?:perl|sed)$/u.test(token.replace(/\\/gu, "/"));
}

export function inPlaceEditTargetsFile(tokens, startIndex, isTargetPathToken) {
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

export function isInPlaceEditOption(token) {
  return token === "-i" || /^-i\S*/u.test(token) || /^-[A-Za-z]*i[A-Za-z]*$/u.test(token);
}

export function isNpmConfigPathToken(token) {
  return (
    token === ".npmrc" ||
    token.endsWith("/.npmrc") ||
    token === "~/.npmrc" ||
    token === "$HOME/.npmrc" ||
    token === "${HOME}/.npmrc"
  );
}

export function isPackageManifestPathToken(token) {
  return token === "package.json" || token === "./package.json" || token.endsWith("/package.json");
}

export function expectNoPublishLifecycleScripts(label, scripts) {
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

export function expectNoWorkspaces(label, pkg) {
  if (pkg.workspaces !== undefined) {
    fail(label, "package workspaces must not be defined");
  }
}

export function expectAuditableNpmCiLockfile(label, lockfilePath) {
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

export function expectNoNpmBinaryShadowing(label, pkg, lockfilePath) {
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

export function expectNoLocalDependencySpecs(label, pkg, lockfilePath) {
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

export function isLocalDependencySpec(spec) {
  return typeof spec === "string" && /^(?:file|link):/iu.test(spec.trim());
}

export function expectNoDependencyInstallLifecycleScripts(label, lockfilePath) {
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

export function lockfilePackageCanInstallOnAuditedRunner(entry) {
  return (
    packagePlatformAllows(entry.os, AUDITED_RUNNER_OS) &&
    packagePlatformAllows(entry.cpu, AUDITED_RUNNER_CPU) &&
    packagePlatformAllows(entry.libc, AUDITED_RUNNER_LIBC)
  );
}

export function packagePlatformAllows(values, currentValue) {
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

export function packageDeclaresNpmBin(pkg, packagePath = "") {
  if (!pkg || typeof pkg !== "object") return false;
  if (typeof pkg.bin === "string") {
    return packageBinName(pkg.name || packagePath) === "npm";
  }
  return Boolean(pkg.bin && typeof pkg.bin === "object" && Object.hasOwn(pkg.bin, "npm"));
}

export function packageBinName(packageName) {
  if (typeof packageName !== "string") return "";
  return packageName.split("/").pop() ?? "";
}

export function expectSafeNpmConfig(label, npmrcPath) {
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

export function npmCiLockfilePath(packageDir) {
  const shrinkwrapPath = join(packageDir, "npm-shrinkwrap.json");
  if (existsSync(shrinkwrapPath)) {
    return shrinkwrapPath;
  }

  const packageLockPath = join(packageDir, "package-lock.json");
  return existsSync(packageLockPath) ? packageLockPath : "";
}
