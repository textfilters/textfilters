import { decodeJavaScriptString, javascriptConcatenatedStringTexts, javascriptStringTexts, readJavaScriptStringConcatAt, skipJavaScriptWhitespace } from "./javascript-string-scanner.mjs";
import { countIndent } from "./local-workflow-scanner.mjs";
import { EXECUTED_CONFIG_LOCAL_PATH_KEYS } from "./state.mjs";
import { normalizedYamlLine, yamlKey, yamlScalarValue, yamlValue } from "./workflow-action-config.mjs";
import { join } from "node:path";

export function localScriptDependencySpecifiers(text) {
  const specifiers = [];
  const callPattern =
    /\b(?:import|require)\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])(\.[^"'`$]+)\1/gu;
  const shellSourcePattern =
    /^\s*(?:\.|source)\s+((?:\.{1,2}\/|[A-Za-z0-9_.-]+\/)[^\s;&|]+|[A-Za-z0-9_.-]+\.(?:bash|sh))\b/u;

  specifiers.push(...localStaticImportExportSpecifiers(text));
  for (const rawLine of text.split("\n")) {
    const shellSource = shellSourcePattern.exec(rawLine);
    if (shellSource) specifiers.push(shellSource[1]);
  }
  for (const match of text.matchAll(callPattern)) {
    specifiers.push(decodeJavaScriptString(match[2]));
  }
  specifiers.push(...localJavaScriptStaticTemplateCallSpecifiers(text));
  specifiers.push(...localJavaScriptCreateRequireDependencySpecifiers(text));
  specifiers.push(...localJavaScriptVariableDependencySpecifiers(text));
  specifiers.push(...localJavaScriptNewUrlDependencySpecifiers(text));
  specifiers.push(...localJavaScriptWorkerDependencySpecifiers(text));
  if (textHasExecutedConfigLocalPathKey(text) || textHasLocalConfigPathList(text)) {
    specifiers.push(...localConfigDependencySpecifiers(text));
  }

  return [...new Set(specifiers)];
}

export function localJavaScriptVariableDependencySpecifiers(text) {
  const variables = localJavaScriptStringVariables(text);
  if (variables.size === 0) return [];

  const specifiers = [];
  const variableCallPattern =
    /\b(?:import|require)\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/gu;
  for (const match of text.matchAll(variableCallPattern)) {
    const specifier = variables.get(match[1]);
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function localJavaScriptStaticTemplateCallSpecifiers(text) {
  const specifiers = [];
  const templateCallPattern =
    /\b(?:import|require)\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*`([^`]+)`/gu;
  for (const match of text.matchAll(templateCallPattern)) {
    const specifier = staticJavaScriptTemplateValue(match[1]);
    if (specifier && isLocalConfigDependencySpecifier(specifier)) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function localJavaScriptCreateRequireDependencySpecifiers(text) {
  const specifiers = [];
  const aliases = localJavaScriptCreateRequireAliases(text);
  if (aliases.size === 0) return specifiers;

  const variables = localJavaScriptStringVariables(text);
  const aliasPattern = new RegExp(
    `\\b(?:${[...aliases].map((alias) => alias.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")).join("|")})\\s*\\(\\s*(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)*(?:(["'\`])(\\.[^"'\`$]+)\\1|([A-Za-z_$][A-Za-z0-9_$]*))`,
    "gu",
  );

  for (const match of text.matchAll(aliasPattern)) {
    if (match[2]) {
      specifiers.push(decodeJavaScriptString(match[2]));
      continue;
    }
    const specifier = variables.get(match[3]);
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function localJavaScriptCreateRequireAliases(text) {
  const aliases = new Set();
  const aliasPattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*createRequire\s*\(\s*import\.meta\.url\s*\)/gu;
  for (const match of text.matchAll(aliasPattern)) {
    aliases.add(match[1]);
  }

  return aliases;
}

export function localJavaScriptNewUrlDependencySpecifiers(text) {
  const specifiers = [];
  const directNewUrlPattern =
    /\bnew\s+URL\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])(\.[^"'`$]+)\1\s*,\s*(?:\/\*[\s\S]*?\*\/\s*)*import\.meta\.url\s*\)/gu;
  for (const match of text.matchAll(directNewUrlPattern)) {
    specifiers.push(decodeJavaScriptString(match[2]));
  }

  const variables = localJavaScriptStringVariables(text);
  if (variables.size === 0) return specifiers;

  const variableNewUrlPattern =
    /\bnew\s+URL\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*(?:\/\*[\s\S]*?\*\/\s*)*import\.meta\.url\s*\)/gu;
  for (const match of text.matchAll(variableNewUrlPattern)) {
    const specifier = variables.get(match[1]);
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function localJavaScriptWorkerDependencySpecifiers(text) {
  const specifiers = [];
  const directWorkerPattern =
    /\bnew\s+Worker\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])(\.[^"'`$]+)\1/gu;
  for (const match of text.matchAll(directWorkerPattern)) {
    specifiers.push(decodeJavaScriptString(match[2]));
  }

  const variables = localJavaScriptStringVariables(text);
  if (variables.size === 0) return specifiers;

  const variableWorkerPattern =
    /\bnew\s+Worker\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*([A-Za-z_$][A-Za-z0-9_$]*)\b/gu;
  for (const match of text.matchAll(variableWorkerPattern)) {
    const specifier = variables.get(match[1]);
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function localJavaScriptStringVariables(text) {
  const variables = new Map();
  const assignmentPattern = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/gu;

  for (const match of text.matchAll(assignmentPattern)) {
    const string = readJavaScriptStringConcatAt(text, match.index + match[0].length);
    if (string.closed && isLocalConfigDependencySpecifier(string.value)) {
      variables.set(match[1], string.value);
    }
  }

  return variables;
}

export function staticJavaScriptTemplateValue(rawValue) {
  let value = "";
  for (let index = 0; index < rawValue.length; index += 1) {
    if (rawValue[index] !== "$" || rawValue[index + 1] !== "{") {
      value += rawValue[index];
      continue;
    }

    const endIndex = rawValue.indexOf("}", index + 2);
    if (endIndex === -1) return "";

    const expression = rawValue.slice(index + 2, endIndex);
    const string = readJavaScriptStringConcatAt(expression, 0);
    if (!string.closed || skipJavaScriptWhitespace(expression, string.endIndex + 1) < expression.length) return "";

    value += string.value;
    index = endIndex;
  }

  return decodeJavaScriptString(value);
}

export function textHasExecutedConfigLocalPathKey(text) {
  return [...EXECUTED_CONFIG_LOCAL_PATH_KEYS].some((key) => new RegExp(`\\b${key}\\b`, "u").test(text));
}

export function textHasLocalConfigPathList(text) {
  return /\bdefineWorkspace\s*\(|^\s*export\s+default\s*\[/mu.test(text);
}

export function localConfigDependencySpecifiers(text) {
  return [
    ...javascriptStringTexts(text).filter((specifier) => isLocalConfigDependencySpecifier(specifier)),
    ...javascriptConcatenatedStringTexts(text).filter((specifier) => isLocalConfigDependencySpecifier(specifier)),
    ...yamlConfigDependencySpecifiers(text),
  ];
}

export function yamlConfigDependencySpecifiers(text) {
  const specifiers = [];
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalizedYamlLine(lines[index]);
    const key = yamlKey(normalizedLine).replace(/:$/u, "");
    if (!EXECUTED_CONFIG_LOCAL_PATH_KEYS.has(key)) continue;

    specifiers.push(...localConfigValueSpecifiers(yamlValue(normalizedLine)));

    const keyIndent = countIndent(lines[index]) + (lines[index].trimStart().startsWith("- ") ? 2 : 0);
    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const line = lines[childIndex];
      if (line.trim() !== "" && countIndent(line) <= keyIndent) break;

      const childLine = line.trimStart();
      if (!childLine.startsWith("- ")) continue;
      specifiers.push(...localConfigValueSpecifiers(childLine.slice(2)));
    }
  }

  return specifiers;
}

export function localConfigValueSpecifiers(value) {
  const scalar = yamlScalarValue(value);
  const values = [
    scalar,
    ...javascriptStringTexts(scalar),
    ...scalar
      .replace(/^\[/u, "")
      .replace(/\]$/u, "")
      .split(",")
      .map((entry) => yamlScalarValue(entry)),
  ];
  return values.filter((specifier) => isLocalConfigDependencySpecifier(specifier));
}

export function isLocalConfigDependencySpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

export function localStaticImportExportSpecifiers(text) {
  const specifiers = [];
  let statement = "";
  let statementLineCount = 0;

  const flushStatement = () => {
    if (!statement) return;
    const localSpecifier = staticImportExportLocalSpecifier(statement);
    if (localSpecifier) {
      specifiers.push(localSpecifier);
    }
    statement = "";
    statementLineCount = 0;
  };

  for (const line of text.split("\n")) {
    if (!statement && !/^\s*(?:import|export)\b/u.test(line)) continue;
    if (!statement && /^\s*import\s*\(/u.test(line)) continue;

    statement = statement ? `${statement}\n${line}` : line;
    statementLineCount += 1;

    if (staticImportExportLocalSpecifier(statement) || /;\s*(?:\/\/.*)?$/u.test(line) || statementLineCount >= 40) {
      flushStatement();
    }
  }
  flushStatement();

  return specifiers;
}

export function staticImportExportLocalSpecifier(statement) {
  const fromMatch = /\bfrom\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])(\.[^"'`$]+)\1/u.exec(statement);
  if (fromMatch) return decodeJavaScriptString(fromMatch[2]);

  const sideEffectImport = /^\s*import\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])(\.[^"'`$]+)\1/u.exec(statement);
  return sideEffectImport ? decodeJavaScriptString(sideEffectImport[2]) : "";
}
