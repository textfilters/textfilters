import { isNpmCommandToken, isShellBoundaryToken, isShellRedirectionToken, javascriptStringTexts } from "./javascript-string-scanner.mjs";
import { envSplitStringCommandText, isEnvCommandToken } from "./local-script-execution.mjs";
import { countIndent, isLocalPathToken, shellWordValue } from "./local-workflow-scanner.mjs";
import { checkWorkflow } from "./package-checks.mjs";
import { interpreterEvalArgument, isInterpreterEvalOption, isShellInterpreterCommand, recordNpmCommandVariable, recordNpmFunctionWrapper, recordShellVariable, resolveShellVariables, shellCommandSubstitutionTexts, shellEvalArgument, shellTokens } from "./shell-publish-counter.mjs";
import { BLOCKED_NPM_CONFIG_KEYS, CHILD_PROCESS_EXECUTION_METHOD_PATTERN, NPM_CONFIG_SET_OPTIONS_WITH_VALUE, contract } from "./state.mjs";
import { getOptionalBlock } from "./workflow-assertions.mjs";
import { inlineMappingEntries } from "./yaml-inline-queries.mjs";
import { hasMultilinePlainYamlScalar, shellContinuationText, startsMultilineQuotedYamlScalar, yamlMultilinePlainScalarText, yamlMultilineQuotedScalarText, yamlRunBlockCommandText } from "./yaml-workflow-parser.mjs";

export function workflowHasPackageWritePermission(workflow) {
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

export function inlineMappingHasPackageWrite(value) {
  return inlineMappingEntries(value).some((entry) => entry.key === "packages" && entry.value === "write");
}

export function workflowUsesPublishAction(workflow) {
  return workflowScalarValues(workflow, "uses:").some((action) =>
    !isLocalPathToken(action) && action.toLowerCase().includes("publish"),
  );
}

export function workflowUsesReleasePleaseAction(workflow) {
  const releaseActionName = actionName(contract.releaseWorkflow.releaseAction);
  return workflowScalarValues(workflow, "uses:").some((action) => actionName(action) === releaseActionName);
}

export function actionName(action) {
  return action.toLowerCase().split("@")[0];
}

export function workflowScalarValues(workflow, keyName) {
  const lines = workflow.split("\n");
  const values = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);
    if (normalizedLine.startsWith("{")) {
      for (const entry of inlineMappingEntries(normalizedLine)) {
        if (`${entry.key}:` === keyName) {
          values.push(entry.value);
        }
      }
      continue;
    }
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

export function scriptHasBlockedNpmConfigCommand(script) {
  const shellVariables = new Map();
  const npmVariables = new Set();
  const npmFunctionNames = new Set();
  return shellContinuationText(script)
    .split("\n")
    .some((line) => lineHasBlockedNpmConfigCommand(line, shellVariables, npmVariables, npmFunctionNames));
}

export function lineHasBlockedNpmConfigCommand(
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

export function envSplitStringHasBlockedNpmConfigCommand(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isEnvCommandToken(command)) return false;

  const scriptText = envSplitStringCommandText(tokens, index + 1, shellVariables);
  return scriptText ? scriptHasBlockedNpmConfigCommand(scriptText) : false;
}

export function evalWrappedHasBlockedNpmConfigCommand(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (command !== "eval") return false;

  const scriptText = shellEvalArgument(tokens, index + 1, shellVariables);
  return scriptText ? scriptHasBlockedNpmConfigCommand(scriptText) : false;
}

export function interpreterWrappedHasBlockedNpmConfigCommand(tokens, index, shellVariables) {
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

export function interpreterEvalHasBlockedNpmConfigCommand(command, scriptText) {
  const basename = command.replace(/\\/gu, "/").split("/").pop() ?? "";
  if (basename === "node") {
    return javascriptStringTexts(scriptText).some((stringText) => scriptHasBlockedNpmConfigCommand(stringText));
  }

  return scriptHasBlockedNpmConfigCommand(scriptText);
}

export function javascriptEmbeddedHasBlockedNpmConfigCommand(text) {
  if (!CHILD_PROCESS_EXECUTION_METHOD_PATTERN.test(text)) {
    return false;
  }

  return javascriptStringTexts(text).some((stringText) => scriptHasBlockedNpmConfigCommand(stringText));
}

export function npmCommandWritesBlockedConfig(commandTokens) {
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

export function commandHasBlockedNpmConfigKey(tokens) {
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

export function npmOptionName(token) {
  return token.replace(/^-+/u, "").split("=")[0];
}

export function npmConfigOptionConsumesValue(optionName) {
  return NPM_CONFIG_SET_OPTIONS_WITH_VALUE.has(optionName);
}

export function hasNpmConfigKey(text, key) {
  return npmConfigEntry(text, key).present;
}

export function isBlockedNpmConfigKey(key, options = {}) {
  const { blockScopedRegistry = true } = options;
  const normalizedKey = normalizeNpmConfigKey(key);
  return (
    BLOCKED_NPM_CONFIG_KEYS.includes(normalizedKey) ||
    (blockScopedRegistry && normalizedKey === normalizeNpmConfigKey(`${contract.checkWorkflow.scope}:registry`)) ||
    isBlockedNpmAuthConfigKey(normalizedKey)
  );
}

export function isBlockedNpmAuthConfigKey(normalizedKey) {
  return /(?:^|:)(?:-auth|-authtoken|-password|username|email|always-auth)$/u.test(normalizedKey);
}

export function npmConfigValue(text, key) {
  return npmConfigEntry(text, key).value;
}

export function npmConfigEntry(text, key) {
  const normalizedKey = normalizeNpmConfigKey(key);
  for (const { key: entryKey, value } of npmConfigEntries(text)) {
    if (normalizeNpmConfigKey(entryKey) === normalizedKey) {
      return { present: true, value };
    }
  }

  return { present: false, value: "" };
}

export function npmConfigEntries(text) {
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

export function normalizeNpmConfigKey(key) {
  return key.toLowerCase().replace(/\[\]$/u, "").replace(/_/gu, "-");
}

export function getStepChildBlock(stepBlock, header) {
  const indent = stepBaseIndent(stepBlock) + 2;
  return getOptionalBlock(stepBlock, header, indent);
}

export function stepTopLevelLine(stepBlock, line) {
  const topLevelIndent = stepBaseIndent(stepBlock) + 2;
  if (countIndent(line) === stepBaseIndent(stepBlock) && line.trimStart().startsWith("- ")) {
    return normalizedYamlLine(line);
  }
  if (countIndent(line) !== topLevelIndent) {
    return "";
  }
  return normalizedYamlLine(line);
}

export function stepBaseIndent(stepBlock) {
  const firstLine = stepBlock.split("\n").find((line) => line.trim() !== "");
  return firstLine ? countIndent(firstLine) : 0;
}

export function normalizedYamlLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("- ") ? trimmed.slice(2) : trimmed;
}

export function isYamlBlockHeader(line, header, indent) {
  return countIndent(line) === indent && yamlKey(normalizedYamlLine(line)) === header;
}

export function isYamlChildBlockHeader(line, indent) {
  return countIndent(line) === indent && yamlKey(normalizedYamlLine(line)) !== "";
}

export function yamlKey(line) {
  const quotedMatch = /^(['"])((?:\\.|(?!\1).)+)\1\s*:(?:\s|$)/u.exec(line);
  if (quotedMatch) {
    return `${unquoteYamlKey(`${quotedMatch[1]}${quotedMatch[2]}${quotedMatch[1]}`)}:`;
  }

  const match = /^((?:[^:[\]{}#]|:(?!\s|$))+?)\s*:(?:\s|$)/u.exec(line);
  return match ? `${unquoteYamlKey(match[1].trim())}:` : "";
}

export function yamlValue(line) {
  if (!yamlKey(line)) return "";

  const quotedMatch = /^(['"])(?:\\.|(?!\1).)+\1\s*:/u.exec(line);
  if (quotedMatch) {
    return line.slice(quotedMatch[0].length).trim();
  }

  const match = /^((?:[^:[\]{}#]|:(?!\s|$))+?)\s*:(?:\s|$)/u.exec(line);
  return match ? line.slice(match[0].length).trim() : "";
}

export function yamlScalarValue(value) {
  const trimmed = value.trim().replace(/^&[^ \t,[\]{}]+(?:[ \t]+|$)/u, "").trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return decodeDoubleQuotedYamlKey(trimmed.slice(1, -1));
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/gu, "'");
  }
  return trimmed;
}

export function unquoteYamlKey(key) {
  if (key.startsWith('"') && key.endsWith('"')) {
    return decodeDoubleQuotedYamlKey(key.slice(1, -1));
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    return key.slice(1, -1).replace(/''/gu, "'");
  }
  return key;
}

export function decodeDoubleQuotedYamlKey(key) {
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
