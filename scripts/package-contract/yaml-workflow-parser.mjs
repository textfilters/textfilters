import { countIndent, readBashAnsiCString } from "./local-workflow-scanner.mjs";
import { countNpmPublishCommandsInShellText, resolveShellVariables } from "./shell-publish-counter.mjs";
import { UNKNOWN_GITHUB_ACTIONS_EXPRESSION } from "./state.mjs";
import { decodeDoubleQuotedYamlKey, isYamlBlockHeader, isYamlChildBlockHeader, normalizedYamlLine, stepTopLevelLine, unquoteYamlKey, yamlKey, yamlScalarValue, yamlValue } from "./workflow-action-config.mjs";
import { inlineMappingEntries } from "./yaml-inline-queries.mjs";
import { join } from "node:path";

export function stripYamlComments(text) {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .map((line) => stripInlineYamlComment(line))
    .join("\n");
}

export function stripInlineYamlComment(line) {
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

export function extractNestedBlocks(text, indent) {
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

export function extractStepBlocks(text) {
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

export function hasLine(text, expected) {
  return text.split("\n").some((line) => normalizedYamlLine(line) === expected);
}

export function hasTopLevelStepLine(stepBlock, expected) {
  return stepBlock
    .split("\n")
    .some((line) => stepTopLevelLine(stepBlock, line) === expected);
}

export function hasTopLevelStepKey(stepBlock, key) {
  return stepBlock
    .split("\n")
    .some((line) => yamlKey(stepTopLevelLine(stepBlock, line)) === key);
}

export function jobTopLevelValue(jobBlock, key, indent) {
  return jobTopLevelEntry(jobBlock, key, indent).value;
}

export function jobTopLevelEntry(jobBlock, key, indent) {
  const entry = jobBlock
    .split("\n")
    .map((entry) => (countIndent(entry) === indent ? normalizedYamlLine(entry) : ""))
    .find((entry) => yamlKey(entry) === key);

  return entry ? { present: true, value: yamlValue(entry) } : { present: false, value: "" };
}

export function blockHasChildLines(block) {
  const lines = block.split("\n").filter((line) => line.trim() !== "");
  const header = lines[0] ?? "";
  const headerIndent = countIndent(header);

  return lines.slice(1).some((line) => countIndent(line) > headerIndent);
}

export function hasLineAtIndent(text, expected, indent) {
  const prefix = " ".repeat(indent);
  return text.split("\n").some((line) => line === `${prefix}${expected}`);
}

export function hasNpmPublishCommand(text) {
  if (!hasNpmPublishCommandMarker(text) && !hasDecodedYamlNpmPublishCommandMarker(text)) return false;
  return countNpmPublishCommands(text) > 0;
}

export function hasNpmPublishCommandMarker(text) {
  const markerPattern = /\b(?:npm|npx|pnpm|yarn|publish|pu|pub|publ|publi|publis)\b/u;
  return (
    markerPattern.test(text) ||
    (text.includes("$'") && markerPattern.test(decodeShellAnsiCStrings(text))) ||
    (text.includes("\\") && markerPattern.test(decodeShellBackslashEscapesForMarker(text))) ||
    ((text.includes("\"") || text.includes("'")) && markerPattern.test(decodeShellQuoteFragmentsForMarker(text)))
  );
}

export function hasDecodedYamlNpmPublishCommandMarker(text) {
  if (!text.includes("run:") && !text.includes(" run:")) return false;
  if (!/\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/u.test(text)) return false;

  return shellScanTexts(text).some((commandText) => hasNpmPublishCommandMarker(commandText));
}

export function decodeShellAnsiCStrings(text) {
  let decoded = "";

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "$" && text[index + 1] === "'") {
      const ansiString = readBashAnsiCString(text, index + 2);
      decoded += ansiString.value;
      index = ansiString.endIndex;
      continue;
    }
    decoded += text[index];
  }

  return decoded;
}

export function decodeShellBackslashEscapesForMarker(text) {
  let decoded = "";
  let quote = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      decoded += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      decoded += char;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      decoded += text[index + 1] ?? "";
      index += 1;
      continue;
    }
    decoded += char;
  }

  return decoded;
}

export function decodeShellQuoteFragmentsForMarker(text) {
  let decoded = "";
  let quote = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "$" && text[index + 1] === "'" && quote === "") {
      const ansiString = readBashAnsiCString(text, index + 2);
      decoded += ansiString.value;
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
      decoded += text[index + 1] ?? "";
      index += 1;
      continue;
    }
    decoded += char;
  }

  return decoded;
}

export function countNpmPublishCommands(text) {
  return shellScanTexts(text).reduce(
    (count, commandText) =>
      count +
      countNpmPublishCommandsInShellText(shellContinuationText(commandText)),
    0,
  );
}

export function shellContinuationText(text) {
  return text.replace(/\\[ \t]*\n/gu, "");
}

export function shellScanTexts(text) {
  const lines = text.split("\n");
  const runCommands = new Map(workflowRunCommandEntries(lines).map((entry) => [entry.startIndex, entry]));
  const commandTexts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const runCommand = runCommands.get(index);
    if (runCommand) {
      commandTexts.push(runCommand.commandText);
      index = runCommand.endIndex;
      continue;
    }

    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);

    if (yamlKey(normalizedLine) === "run:") {
      continue;
    }

    commandTexts.push(line);
  }

  return commandTexts;
}

export function workflowRunCommandTexts(lines) {
  return workflowRunCommandEntries(lines).map((entry) => entry.commandText);
}

export function workflowRunCommandEntries(lines) {
  const commandEntries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizedYamlLine(line);

    if (normalizedLine.startsWith("{")) {
      const runValue = inlineMappingEntries(normalizedLine).find((entry) => entry.key === "run")?.value;
      if (runValue) {
        commandEntries.push({
          commandText: normalizeWorkflowRunCommandText(runValue, workflowRunEnvValueMap(lines, index)),
          startIndex: index,
          endIndex: index,
        });
      }
      continue;
    }

    if (yamlKey(normalizedLine) !== "run:") continue;

    const workflowEnvValues = workflowRunEnvValueMap(lines, index);
    const rawRunValue = yamlValue(normalizedLine);
    const runValue = yamlScalarValue(rawRunValue);
    if (/^[|>]/u.test(runValue)) {
      const block = yamlRunBlockCommandText(lines, index, countIndent(line), runValue);
      commandEntries.push({
        commandText: normalizeWorkflowRunCommandText(block.commandText, workflowEnvValues),
        startIndex: index,
        endIndex: block.endIndex,
      });
      index = block.endIndex;
    } else if (startsMultilineQuotedYamlScalar(rawRunValue)) {
      const scalar = yamlMultilineQuotedScalarText(lines, index, countIndent(line), rawRunValue);
      commandEntries.push({
        commandText: normalizeWorkflowRunCommandText(scalar.commandText, workflowEnvValues),
        startIndex: index,
        endIndex: scalar.endIndex,
      });
      index = scalar.endIndex;
    } else if (hasMultilinePlainYamlScalar(lines, index, countIndent(line))) {
      const scalar = yamlMultilinePlainScalarText(lines, index, countIndent(line), runValue);
      commandEntries.push({
        commandText: normalizeWorkflowRunCommandText(scalar.commandText, workflowEnvValues),
        startIndex: index,
        endIndex: scalar.endIndex,
      });
      index = scalar.endIndex;
    } else {
      commandEntries.push({
        commandText: normalizeWorkflowRunCommandText(runValue, workflowEnvValues),
        startIndex: index,
        endIndex: index,
      });
    }
  }

  return commandEntries;
}

export function normalizeWorkflowRunCommandText(text, workflowEnvValues) {
  return resolveShellVariables(normalizeGitHubActionsExpressions(text), workflowEnvValues);
}

export function normalizeGitHubActionsExpressions(text) {
  return text.replace(/\$\{\{\s*([^}]*)\s*\}\}/gu, (_match, expression) => {
    return evaluatedGitHubActionsExpressionString(expression.trim());
  });
}

export function evaluatedGitHubActionsExpressionString(expression) {
  const literal = githubActionsExpressionStringLiteral(expression);
  if (literal !== null) return literal;

  if (expression === "github.workspace") return "$GITHUB_WORKSPACE";

  const formatCall = /^format\(([\s\S]*)\)$/u.exec(expression);
  if (formatCall) {
    return evaluatedGitHubActionsFormatCall(formatCall[1]);
  }

  return UNKNOWN_GITHUB_ACTIONS_EXPRESSION;
}

export function evaluatedGitHubActionsFormatCall(argumentsText) {
  const args = githubActionsExpressionArguments(argumentsText);
  if (args.length === 0) return UNKNOWN_GITHUB_ACTIONS_EXPRESSION;

  const template = githubActionsExpressionStringLiteral(args[0]);
  if (template === null) return UNKNOWN_GITHUB_ACTIONS_EXPRESSION;

  const values = args.slice(1).map((argument) => githubActionsExpressionStringLiteral(argument));
  if (values.some((value) => value === null)) return UNKNOWN_GITHUB_ACTIONS_EXPRESSION;
  return template.replace(/\{\{|\}\}|\{(\d+)\}/gu, (match, index) => {
    if (match === "{{") return "{";
    if (match === "}}") return "}";
    return values[Number(index)] ?? "";
  });
}

export function githubActionsExpressionArguments(text) {
  const args = [];
  let argument = "";
  let quote = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && quote === "'") {
      if (text[index + 1] === "'") {
        argument += "''";
        index += 1;
        continue;
      }
      quote = "";
      argument += char;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      argument += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      argument += char;
      continue;
    }
    if (char === "," && quote === "") {
      args.push(argument.trim());
      argument = "";
      continue;
    }
    argument += char;
  }

  if (argument.trim() !== "") {
    args.push(argument.trim());
  }

  return args;
}

export function githubActionsExpressionStringLiteral(expression) {
  const singleQuoted = /^'((?:''|[^'])*)'$/u.exec(expression);
  if (singleQuoted) return singleQuoted[1].replace(/''/gu, "'");

  const doubleQuoted = /^"((?:\\.|[^"])*)"$/u.exec(expression);
  if (doubleQuoted) return decodeDoubleQuotedYamlKey(doubleQuoted[1]);

  return null;
}

export function workflowEnvValueMap(text) {
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
      const rawValue = yamlValue(entry);
      const scalarValue = yamlScalarValue(rawValue);
      if (/^[|>]/u.test(scalarValue)) {
        const block = yamlRunBlockCommandText(lines, entryIndex, countIndent(entryLine), scalarValue);
        recordWorkflowEnvValue(envValues, key.slice(0, -1), block.commandText.trim());
        entryIndex = block.endIndex;
        continue;
      }
      recordWorkflowEnvValue(envValues, key.slice(0, -1), yamlScalarValue(rawValue));
    }
  }

  return envValues;
}

export function workflowRunEnvValueMap(lines, runIndex) {
  const envValues = workflowEnvValueMap(getTopLevelWorkflowEnvText(lines));
  const jobBlock = workflowJobBlockContainingLine(lines, runIndex);
  recordWorkflowBlockEnvValues(envValues, jobBlock, countIndent(jobBlock[0] ?? "") + 2);
  const stepBlock = workflowStepBlockContainingLine(lines, runIndex);
  recordWorkflowBlockEnvValues(envValues, stepBlock, countIndent(stepBlock[0] ?? ""));
  recordWorkflowBlockEnvValues(envValues, stepBlock, countIndent(stepBlock[0] ?? "") + 2);

  return envValues;
}

export function getTopLevelWorkflowEnvText(lines) {
  return yamlBlockContainingHeader(lines, "env:", 0).join("\n");
}

export function workflowJobBlockContainingLine(lines, lineIndex) {
  let startIndex = -1;

  for (let index = lineIndex; index >= 0; index -= 1) {
    const line = lines[index];
    if (countIndent(line) === 2 && yamlKey(normalizedYamlLine(line))) {
      startIndex = index;
      break;
    }
  }
  if (startIndex === -1) return [];

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== "" && countIndent(lines[index]) <= 2) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex);
}

export function workflowStepBlockContainingLine(lines, lineIndex) {
  let startIndex = -1;

  for (let index = lineIndex; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.trim() !== "" && normalizedYamlLine(line).startsWith("run:")) continue;
    if (line.trimStart().startsWith("- ") && countIndent(line) <= countIndent(lines[lineIndex])) {
      startIndex = index;
      break;
    }
  }
  if (startIndex === -1) return [];

  const stepIndent = countIndent(lines[startIndex]);
  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== "" && countIndent(lines[index]) <= stepIndent) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex);
}

export function recordWorkflowBlockEnvValues(envValues, blockLines, envIndent) {
  if (blockLines.length === 0) return;
  const envText = yamlBlockContainingHeader(blockLines, "env:", envIndent).join("\n");
  for (const [key, value] of workflowEnvValueMap(envText)) {
    envValues.set(key, value);
  }
}

export function yamlBlockContainingHeader(lines, header, indent) {
  const startIndex = lines.findIndex((line) => isYamlBlockHeader(line, header, indent));
  if (startIndex === -1) return [];

  const headerIndent =
    countIndent(lines[startIndex]) + (lines[startIndex].trimStart().startsWith("- ") ? 2 : 0);
  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== "" && countIndent(lines[index]) <= headerIndent) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex);
}

export function recordWorkflowEnvValue(envValues, key, value) {
  const name = unquoteYamlKey(key).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) return;
  if (typeof value !== "string") return;
  envValues.set(name, normalizeGitHubActionsExpressions(value));
}

export function startsMultilineQuotedYamlScalar(value) {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('"') || trimmed.startsWith("'")) &&
    !yamlQuotedScalarClosed(trimmed)
  );
}

export function yamlQuotedScalarClosed(value) {
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

export function yamlMultilineQuotedScalarText(lines, startIndex, runIndent, firstValue) {
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

export function hasMultilinePlainYamlScalar(lines, startIndex, runIndent) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    return countIndent(line) > runIndent;
  }

  return false;
}

export function yamlMultilinePlainScalarText(lines, startIndex, runIndent, firstValue) {
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

export function foldYamlPlainScalarLines(lines) {
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

export function yamlRunBlockCommandText(lines, startIndex, runIndent, runValue) {
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

export function yamlBlockScalarContentIndent(lines) {
  const indents = lines.filter((line) => line.trim() !== "").map((line) => countIndent(line));
  return indents.length === 0 ? 0 : Math.min(...indents);
}

export function foldYamlBlockScalarLines(lines) {
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
