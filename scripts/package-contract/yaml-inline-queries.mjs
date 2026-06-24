import { countIndent, isNpmConfigEnvKey, normalizeEnvKeyName } from "./local-workflow-scanner.mjs";
import { BLOCKED_WORKFLOW_STARTUP_ENV_KEYS } from "./state.mjs";
import { getStepChildBlock, isBlockedNpmConfigKey, normalizedYamlLine, stepBaseIndent, stepTopLevelLine, unquoteYamlKey, yamlKey, yamlScalarValue, yamlValue } from "./workflow-action-config.mjs";
import { getOptionalBlock } from "./workflow-assertions.mjs";
import { hasLineAtIndent } from "./yaml-workflow-parser.mjs";
import { join } from "node:path";

export function blockEntriesAtIndent(text, indent) {
  return text
    .split("\n")
    .filter((line) => countIndent(line) === indent)
    .map((line) => normalizedYamlLine(line))
    .filter((line) => line.includes(":"));
}

export function topLevelChildKeys(block, indent) {
  return block
    .split("\n")
    .filter((line) => countIndent(line) === indent)
    .map((line) => normalizedYamlLine(line))
    .map((line) => yamlKey(line))
    .filter(Boolean);
}

export function hasEnvLine(text, envLine, indent) {
  const envBlock = getOptionalBlock(text, "env:", indent);
  return envBlock ? hasLineAtIndent(envBlock, envLine, indent + 2) : false;
}

export function hasEnvKey(text, envName, indent) {
  const envBlock = getOptionalBlock(text, "env:", indent);
  return (
    (envBlock ? hasEnvKeyAtIndent(envBlock, envName, indent + 2) : false) ||
    inlineMappingHasEnvKey(topLevelValue(text, "env:", indent), envName)
  );
}

export function hasStepEnvKey(stepBlock, envName) {
  const envBlock = getStepChildBlock(stepBlock, "env:");
  return (
    (envBlock ? hasEnvKeyAtIndent(envBlock, envName, stepBaseIndent(stepBlock) + 4) : false) ||
    stepInlineEnvHasKey(stepBlock, envName)
  );
}

export function stepInlineEnvHasKey(stepBlock, envName) {
  return inlineMappingHasEnvKey(stepTopLevelValue(stepBlock, "env:"), envName);
}

export function stepRunCommand(stepBlock) {
  const lines = stepBlock.split("\n");
  const lineIndex = lines.findIndex((entry) => stepTopLevelLine(stepBlock, entry).startsWith("run: "));
  if (lineIndex === -1) return "";

  const commandParts = [stepTopLevelLine(stepBlock, lines[lineIndex]).slice("run: ".length)];
  const runIndent = countIndent(lines[lineIndex]);
  for (let index = lineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    if (countIndent(line) <= runIndent) break;
    commandParts.push(line.trim());
  }

  return commandParts.join(" ");
}

export function stepTopLevelValue(stepBlock, key) {
  const entry = stepBlock
    .split("\n")
    .map((entry) => stepTopLevelLine(stepBlock, entry))
    .find((entry) => yamlKey(entry) === key);

  return entry ? yamlValue(entry) : "";
}

export function stepTopLevelKeyCount(stepBlock, key) {
  return stepBlock
    .split("\n")
    .map((entry) => stepTopLevelLine(stepBlock, entry))
    .filter((entry) => yamlKey(entry) === key).length;
}

export function workflowDefaultsWorkingDirectory(workflow) {
  return Boolean(workflowDefaultsWorkingDirectoryValue(workflow));
}

export function jobDefaultsWorkingDirectory(jobBlock) {
  return Boolean(jobDefaultsWorkingDirectoryValue(jobBlock));
}

export function workflowDefaultsWorkingDirectoryValue(workflow) {
  const defaultsBlock = getOptionalBlock(workflow, "defaults:", 0);
  return (
    defaultsWorkingDirectoryValue(defaultsBlock, 2) ||
    inlineMappingValue(topLevelValue(workflow, "defaults:", 0), "working-directory")
  );
}

export function jobDefaultsWorkingDirectoryValue(jobBlock) {
  const defaultsBlock = getOptionalBlock(jobBlock, "defaults:", 4);
  return (
    defaultsWorkingDirectoryValue(defaultsBlock, 6) ||
    inlineMappingValue(topLevelValue(jobBlock, "defaults:", 4), "working-directory")
  );
}

export function defaultsWorkingDirectory(defaultsBlock, runIndent) {
  return Boolean(defaultsWorkingDirectoryValue(defaultsBlock, runIndent));
}

export function defaultsWorkingDirectoryValue(defaultsBlock, runIndent) {
  const runBlock = getOptionalBlock(defaultsBlock, "run:", runIndent);
  const inlineDefaults = topLevelValue(defaultsBlock, "run:", runIndent);
  return (
    topLevelValue(runBlock, "working-directory:", runIndent + 2) ||
    inlineMappingValue(inlineDefaults, "working-directory") ||
    inlineRunMappingValue(topLevelValue(defaultsBlock, "defaults:", runIndent - 2), "working-directory")
  );
}

export function workflowDefaultsShell(workflow) {
  const defaultsBlock = getOptionalBlock(workflow, "defaults:", 0);
  return defaultsShell(defaultsBlock, 2) || inlineMappingHasKey(topLevelValue(workflow, "defaults:", 0), "shell:");
}

export function jobDefaultsShell(jobBlock) {
  const defaultsBlock = getOptionalBlock(jobBlock, "defaults:", 4);
  return defaultsShell(defaultsBlock, 6) || inlineMappingHasKey(topLevelValue(jobBlock, "defaults:", 4), "shell:");
}

export function defaultsShell(defaultsBlock, runIndent) {
  const runBlock = getOptionalBlock(defaultsBlock, "run:", runIndent);
  const inlineDefaults = topLevelValue(defaultsBlock, "run:", runIndent);
  return (
    hasKeyAtIndent(runBlock, "shell:", runIndent + 2) ||
    inlineMappingHasKey(inlineDefaults, "shell:") ||
    inlineRunMappingHasKey(topLevelValue(defaultsBlock, "defaults:", runIndent - 2), "shell:")
  );
}

export function hasKeyAtIndent(text, key, indent) {
  return text
    .split("\n")
    .some((line) => countIndent(line) === indent && yamlKey(normalizedYamlLine(line)) === key);
}

export function hasEnvKeyAtIndent(text, key, indent) {
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

export function topLevelValue(text, key, indent) {
  const entry = text
    .split("\n")
    .map((line) => (countIndent(line) === indent ? normalizedYamlLine(line) : ""))
    .find((line) => yamlKey(line) === key);

  return entry ? yamlValue(entry) : "";
}

export function inlineMappingHasKey(value, key) {
  const expectedKey = key.slice(0, -1);
  return (
    inlineMappingKeys(value).some((keyName) => keyName === expectedKey) ||
    inlineMappingHasRawKey(value, expectedKey)
  );
}

export function inlineMappingHasEnvKey(value, key) {
  if (!isNpmConfigEnvKey(key)) {
    return inlineMappingHasKey(value, key);
  }

  const normalizedKey = normalizeEnvKeyName(key);
  return inlineMappingKeys(value).some((keyName) => normalizeEnvKeyName(`${keyName}:`) === normalizedKey);
}

export function inlineMappingKeys(value) {
  return inlineMappingEntries(value).map((entry) => entry.key);
}

export function inlineMappingHasRawKey(value, key) {
  if (!value || !value.trim().startsWith("{")) return false;

  const keyPattern = new RegExp(`(?:^|[{,]\\s*)(?:"${key}"|'${key}'|${key})\\s*:`, "u");
  return keyPattern.test(value);
}

export function inlineMappingValue(value, key) {
  return inlineMappingEntries(value).find((entry) => entry.key === key)?.value ?? "";
}

export function inlineRunMappingHasKey(value, key) {
  const runMapping = inlineNestedMappingValue(value, "run");
  return runMapping ? inlineMappingHasKey(runMapping, key) : false;
}

export function inlineRunMappingValue(value, key) {
  const runMapping = inlineNestedMappingValue(value, "run");
  return runMapping ? inlineMappingValue(runMapping, key) : "";
}

export function inlineNestedMappingValue(value, key) {
  if (!value || !value.trim().startsWith("{")) return "";

  const entry = inlineMappingEntry(value, key);
  if (!entry) return "";

  const nestedValue = entry.value.trim();
  if (!nestedValue.startsWith("{")) return "";

  const mapping = readBalancedInlineMapping(nestedValue, 0);
  return mapping.closed ? mapping.value : "";
}

export function inlineMappingEntry(value, expectedKey) {
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

export function skipInlineMappingSpace(text, index) {
  while (/[ \t\n\r]/u.test(text[index] ?? "")) {
    index += 1;
  }
  return index;
}

export function readInlineMappingKey(text, startIndex) {
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

export function readInlineQuotedScalar(text, startIndex, quote) {
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

export function readInlineMappingValue(text, startIndex) {
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

export function readBalancedInlineMapping(value, startIndex) {
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

export function inlineMappingEntries(value) {
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

export function inlineMappingScalarValue(doubleQuoted, singleQuoted, plain) {
  if (doubleQuoted !== undefined) return unquoteYamlKey(`"${doubleQuoted}"`);
  if (singleQuoted !== undefined) return unquoteYamlKey(`'${singleQuoted}'`);
  return yamlScalarValue((plain ?? "").trim());
}

export function textHasBlockedNpmConfigEnvKey(text) {
  const keyPattern =
    /(?:^|[\s{,])["']?(npm_config_[^\s:=,'"{}]+(?::[^\s=,'"{}]+)?)["']?\s*[:=]/giu;
  for (const match of text.matchAll(keyPattern)) {
    if (isBlockedNpmConfigEnvKey(match[1])) {
      return true;
    }
  }

  return false;
}

export function textHasBlockedWorkflowStartupEnvKey(text) {
  const keyPattern = new RegExp(
    `(?:^|[\\s{,])["']?(?:${BLOCKED_WORKFLOW_STARTUP_ENV_KEYS.join("|")})["']?\\s*[:=]`,
    "mu",
  );
  return keyPattern.test(text);
}

export function isBlockedNpmConfigEnvKey(envName) {
  const normalizedEnvName = normalizeEnvKeyName(envName);
  if (!normalizedEnvName.startsWith("npm_config_")) return false;

  const npmConfigKey = normalizedEnvName.slice("npm_config_".length);
  return isBlockedNpmConfigKey(npmConfigKey);
}
