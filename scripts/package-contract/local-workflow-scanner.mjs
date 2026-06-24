import { isShellBoundaryToken, isShellRedirectionToken } from "./javascript-string-scanner.mjs";
import { localScriptDependencySpecifiers } from "./local-script-dependencies.mjs";
import { commandBasename, isLocalScriptFileToken, isRelativeLocalPathToken, nodePreloadOptionConsumesValue, nodePreloadOptionValue } from "./local-script-execution.mjs";
import { interpreterEvalArgument, isInterpreterEvalOption, resolveShellVariables, shellEvalArgument, shellTokens, shellVariableAssignment } from "./shell-publish-counter.mjs";
import { shellCommentText } from "./shell-script-syntax.mjs";
import { packagesRoot, repoDir } from "./state.mjs";
import { stepTopLevelLine, unquoteYamlKey, workflowScalarValues, yamlKey, yamlScalarValue, yamlValue } from "./workflow-action-config.mjs";
import { getOptionalBlock } from "./workflow-assertions.mjs";
import { inlineMappingEntries, jobDefaultsWorkingDirectoryValue, stepTopLevelValue, workflowDefaultsWorkingDirectoryValue } from "./yaml-inline-queries.mjs";
import { extractNestedBlocks, extractStepBlocks, hasMultilinePlainYamlScalar, shellContinuationText, startsMultilineQuotedYamlScalar, workflowRunCommandTexts, yamlMultilinePlainScalarText, yamlMultilineQuotedScalarText, yamlRunBlockCommandText } from "./yaml-workflow-parser.mjs";

export function hasLocalWorkflowExecution(workflow) {
  const lines = workflow.split("\n");
  if (workflowScalarValues(workflow, "uses:").some((action) => isLocalPathToken(action))) {
    return true;
  }

  for (const runCommand of workflowRunCommandTexts(lines)) {
    if (shellTextInvokesLocalCode(runCommand)) {
      return true;
    }
  }

  return workflowInvokesLocalCodeFromWorkingDirectory(workflow);
}

export function workflowInvokesLocalCodeFromWorkingDirectory(workflow) {
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

export function stepRunCommandTexts(stepBlock) {
  const lines = stepBlock.split("\n");
  const commandTexts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const topLevelLine = stepTopLevelLine(stepBlock, line);
    if (topLevelLine.startsWith("{")) {
      const runValue = inlineMappingEntries(topLevelLine).find((entry) => entry.key === "run")?.value;
      if (runValue) {
        commandTexts.push(runValue);
      }
      continue;
    }
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

export function shellTextInvokesLocalCode(text) {
  const state = { localPathLookup: false, shellVariables: new Map() };
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => shellLineInvokesLocalCode(line, state));
}

export function shellTextInvokesBareLocalCode(text) {
  return shellContinuationText(text)
    .split("\n")
    .some((line) => shellLineInvokesBareLocalCode(line));
}

export function shellLineInvokesBareLocalCode(line) {
  const tokens = shellTokens(line).map((token) => shellWordValue(token));
  return tokens.some((token, index) => {
    if (isShellBoundaryToken(token) || isShellRedirectionToken(token)) return false;
    if (isBareLocalScriptToken(token)) return true;
    if (interpreterInvokesLocalModule(tokens, index)) return true;
    if (interpreterPreloadInvokesLocalCode(tokens, index)) return true;
    if (interpreterEvalInvokesLocalCode(tokens, index)) return true;
    if (shellEvalInvokesLocalCode(tokens, index)) return true;
    if (interpreterUsesLocalTestDiscovery(tokens, index)) return true;
    const scriptToken = interpreterFileArgumentToken(tokens, index + 1);
    return isFileArgumentInterpreterToken(token) && Boolean(scriptToken) && isBareInterpreterScriptToken(scriptToken);
  });
}

export function isBareLocalScriptToken(token) {
  return /^[A-Za-z0-9_.-]+\.(?:cjs|js|mjs|sh|ts|tsx|py|rb|pl|php)$/u.test(token);
}

export function isBareInterpreterScriptToken(token) {
  return /^[A-Za-z0-9_.-]+(?:\.(?:cjs|js|mjs|sh|ts|tsx|py|rb|pl|php))?$/u.test(token) && !token.startsWith("-");
}

export function isNonRootWorkingDirectory(value) {
  const workingDirectory = yamlScalarValue(value).replace(/\/+$/u, "");
  return workingDirectory !== "" && workingDirectory !== "." && workingDirectory !== "./";
}

export function shellLineInvokesLocalCode(line, state = { localPathLookup: false, shellVariables: new Map() }) {
  if (lineReferencesWorkspaceLocalPath(line)) {
    return true;
  }
  if (shellLineInvokesMake(line)) {
    return true;
  }

  const rawTokens = shellTokens(line).map((token) => shellWordValue(token));
  if (shellLineInvokesPathResolvedLocalCode(rawTokens, state)) {
    return true;
  }
  const tokens = rawTokens.map((token) => resolveShellVariables(token, state.shellVariables));
  return tokens.some((token, index) => {
    if (isShellBoundaryToken(token) || isShellRedirectionToken(token)) return false;
    if (shellSourceCommandInvokesLocalFile(tokens, index)) return true;
    if (isLocalPathToken(token)) return true;
    if (interpreterInvokesLocalModule(tokens, index)) return true;
    if (interpreterPreloadInvokesLocalCode(tokens, index)) return true;
    if (interpreterEvalInvokesLocalCode(tokens, index)) return true;
    if (shellEvalInvokesLocalCode(tokens, index, state.shellVariables)) return true;
    if (interpreterUsesLocalTestDiscovery(tokens, index)) return true;
    const scriptToken = interpreterFileArgumentToken(tokens, index + 1);
    return (
      isFileArgumentInterpreterToken(token) &&
      Boolean(scriptToken) &&
      (isLocalPathToken(scriptToken) || isBareInterpreterScriptToken(scriptToken))
    );
  });
}

export function shellEvalInvokesLocalCode(tokens, index, shellVariables = new Map()) {
  if (tokens[index] !== "eval") return false;

  const scriptText = shellEvalArgument(tokens, index + 1, shellVariables);
  return Boolean(scriptText) && shellTextInvokesLocalCode(scriptText);
}

export function shellSourceCommandInvokesLocalFile(tokens, index) {
  if (tokens[index] !== "source" && tokens[index] !== ".") return false;

  for (let tokenIndex = index + 1; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      tokenIndex += 1;
      continue;
    }
    return isLocalPathToken(token) || isBareInterpreterScriptToken(token);
  }

  return false;
}

export function shellLineInvokesPathResolvedLocalCode(tokens, state = { localPathLookup: false, shellVariables: new Map() }) {
  let segment = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) {
      if (shellSegmentInvokesPathResolvedLocalCode(segment, state)) {
        return true;
      }
      segment = [];
      continue;
    }
    segment.push(token);
  }

  return shellSegmentInvokesPathResolvedLocalCode(segment, state);
}

export function shellSegmentInvokesPathResolvedLocalCode(tokens, state) {
  let localPathLookup = state.localPathLookup;
  const shellVariables = new Map(state.shellVariables);
  let commandSeen = false;
  let envPrefix = false;
  let sawShellCommand = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    const assignment = shellVariableAssignment(token);
    if (assignment && (!commandSeen || envPrefix)) {
      const value = resolveShellVariables(assignment.value, shellVariables);
      if (assignment.name === "PATH" && pathValueEnablesLocalLookup(value)) {
        localPathLookup = true;
      }
      shellVariables.set(assignment.name, value);
      continue;
    }
    if (!commandSeen && token === "env") {
      envPrefix = true;
      sawShellCommand = true;
      continue;
    }
    if (envPrefix && (token === "--" || token.startsWith("-"))) {
      continue;
    }
    if (
      localPathLookup &&
      !commandSeen &&
      isBarePathLookupCommandToken(resolveShellVariables(token, shellVariables))
    ) {
      return true;
    }
    commandSeen = true;
    sawShellCommand = true;
  }

  if (!sawShellCommand) {
    state.localPathLookup = localPathLookup;
    state.shellVariables = shellVariables;
  }
  return false;
}

export function isBarePathLookupCommandToken(token) {
  return /^[A-Za-z0-9_.-]+$/u.test(token) && !token.startsWith("-");
}

export function pathValueEnablesLocalLookup(value) {
  return value
    .split(":")
    .some(
      (entry) =>
        entry === "." ||
        entry === "" ||
        pathEntryIsRelativeLocalLookup(entry) ||
        entry === "$GITHUB_WORKSPACE" ||
        entry === "${GITHUB_WORKSPACE}" ||
        /^\$\{\{\s*github\.workspace\s*\}\}$/u.test(entry),
    );
}

export function pathEntryIsRelativeLocalLookup(entry) {
  return entry !== "" && !entry.startsWith("/") && !entry.startsWith("$") && !entry.startsWith("~");
}

export function interpreterInvokesLocalModule(tokens, index) {
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

export function interpreterPreloadInvokesLocalCode(tokens, index) {
  const command = tokens[index];
  if (commandBasename(command) !== "node") return false;

  for (let tokenIndex = index + 1; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      tokenIndex += 1;
      continue;
    }
    const inlinePreloadValue = nodePreloadOptionValue(command, token);
    if (inlinePreloadValue) {
      return isLocalScriptFileToken(inlinePreloadValue) || isBareInterpreterScriptToken(inlinePreloadValue);
    }
    if (nodePreloadOptionConsumesValue(command, token)) {
      const preloadToken = tokens[tokenIndex + 1] ?? "";
      return isLocalScriptFileToken(preloadToken) || isBareInterpreterScriptToken(preloadToken);
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

export function interpreterEvalInvokesLocalCode(tokens, index) {
  const command = tokens[index];
  if (!isFileArgumentInterpreterToken(command)) return false;

  for (let tokenIndex = index + 1; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      tokenIndex += 1;
      continue;
    }
    const inlineEvalValue = interpreterEvalOptionValue(command, token);
    if (inlineEvalValue) {
      return scriptTextInvokesLocalCodeForInterpreter(command, inlineEvalValue);
    }
    if (isInterpreterEvalOption(command, token)) {
      const scriptText = interpreterEvalArgument(tokens, tokenIndex + 1, new Map());
      return scriptTextInvokesLocalCodeForInterpreter(command, scriptText);
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

export function interpreterEvalOptionValue(command, token) {
  const basename = commandBasename(command);
  if ((basename === "node" || basename === "bun") && token.startsWith("--eval=")) {
    return token.slice("--eval=".length);
  }
  if (basename === "node" && token.startsWith("--print=")) {
    return token.slice("--print=".length);
  }

  return "";
}

export function scriptTextInvokesLocalCodeForInterpreter(command, scriptText) {
  if (!scriptText) return false;

  const basename = commandBasename(command);
  if (basename === "node" || basename === "bun" || basename === "deno") {
    return localScriptDependencySpecifiers(scriptText).length > 0;
  }
  if (basename === "bash" || basename === "sh") {
    return shellTextInvokesLocalCode(scriptText);
  }

  return false;
}

export function interpreterUsesLocalTestDiscovery(tokens, index) {
  if (commandBasename(tokens[index]) !== "node") return false;

  for (let tokenIndex = index + 1; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      tokenIndex += 1;
      continue;
    }
    if (token === "--test") return true;
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

export function shellLineInvokesMake(line) {
  const tokens = shellTokens(line).map((token) => shellWordValue(token));
  return tokens.some((token) => commandBasename(token) === "make" || commandBasename(token) === "gmake");
}

export function interpreterFileArgumentToken(tokens, startIndex) {
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

export function interpreterFileOptionConsumesValue(token) {
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

export function isFileArgumentInterpreterToken(token) {
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

export function isLocalPathToken(token) {
  return (
    token.startsWith("./") ||
    token.startsWith("../") ||
    isRelativeLocalPathToken(token) ||
    token.startsWith("$GITHUB_WORKSPACE/") ||
    token.startsWith("${GITHUB_WORKSPACE}/") ||
    /^\$\{\{\s*github\.workspace\s*\}\}\//u.test(token)
  );
}

export function lineReferencesWorkspaceLocalPath(line) {
  return /(?:\$GITHUB_WORKSPACE|\$\{GITHUB_WORKSPACE\}|\$\{\{\s*github\.workspace\s*\}\})\//u.test(line);
}

export function shellWordValue(token) {
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

export function readBashAnsiCString(token, startIndex) {
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

export function decodeBashAnsiEscape(token, index) {
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

export function decodeFixedBashAnsiHexEscape(token, startIndex, maxLength, fallbackIndex) {
  const pattern = new RegExp(`^[0-9a-fA-F]{1,${maxLength}}`, "u");
  const match = pattern.exec(token.slice(startIndex));
  if (!match) {
    return { value: token[fallbackIndex] ?? "", endIndex: fallbackIndex };
  }

  const hex = match[0];
  return { value: String.fromCodePoint(Number.parseInt(hex, 16)), endIndex: startIndex + hex.length - 1 };
}

export function isNpmConfigEnvKey(key) {
  return normalizeEnvKeyName(key).startsWith("npm_config_");
}

export function normalizeEnvKeyName(key) {
  return unquoteYamlKey(key.replace(/:$/u, "").trim()).toLowerCase().replace(/-/gu, "_");
}

export function countIndent(line) {
  return line.length - line.trimStart().length;
}

export function relativePackagePath(path) {
  return path.startsWith(packagesRoot)
    ? path.slice(packagesRoot.length + 1)
    : path.slice(repoDir.length + 1);
}
