import { decodeJavaScriptString, javascriptConcatenatedStringTexts, javascriptJoinedStringTexts, javascriptPathJoinStringTexts, javascriptStaticTemplateTexts, javascriptStringTexts, readJavaScriptStaticStringAt, staticJavaScriptTemplateValue } from "./javascript-string-scanner.mjs";
import { countIndent } from "./local-workflow-scanner.mjs";
import { EXECUTED_CONFIG_LOCAL_PATH_KEYS } from "./state.mjs";
import { normalizedYamlLine, yamlKey, yamlScalarValue, yamlValue } from "./workflow-action-config.mjs";
import { join } from "node:path";

export function localScriptDependencySpecifiers(text) {
  const specifiers = [];
  const callPattern =
    /\b(?:import|require)\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])([^"'`$]+)\1/gu;
  const shellSourcePattern =
    /^\s*(?:\.|source)\s+((?:\.{1,2}\/|[A-Za-z0-9_.-]+\/)[^\s;&|]+|[A-Za-z0-9_.-]+\.(?:bash|sh))\b/u;

  specifiers.push(...localStaticImportExportSpecifiers(text));
  for (const rawLine of text.split("\n")) {
    const shellSource = shellSourcePattern.exec(rawLine);
    if (shellSource) specifiers.push(shellSource[1]);
  }
  for (const match of text.matchAll(callPattern)) {
    const specifier = decodeJavaScriptString(match[2]);
    if (isRelativeLocalDependencySpecifier(specifier)) specifiers.push(specifier);
  }
  specifiers.push(...localJavaScriptConcatenatedCallSpecifiers(text));
  specifiers.push(...localJavaScriptJoinedCallSpecifiers(text));
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

export function localJavaScriptConcatenatedCallSpecifiers(text) {
  const specifiers = [];
  const callPattern =
    /\b(?:import|require)\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*/gu;

  for (const match of text.matchAll(callPattern)) {
    const specifier = readJavaScriptStaticStringAt(text, match.index + match[0].length);
    if (specifier.closed && isRelativeLocalDependencySpecifier(specifier.value)) {
      specifiers.push(specifier.value);
    }
  }

  return specifiers;
}

export function localJavaScriptJoinedCallSpecifiers(text) {
  const specifiers = [];
  const callPattern =
    /\b(?:import|require)\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*/gu;

  for (const match of text.matchAll(callPattern)) {
    const argumentText = text.slice(match.index + match[0].length, match.index + match[0].length + 280);
    for (const specifier of javascriptJoinedStringTexts(argumentText)) {
      if (isRelativeLocalDependencySpecifier(specifier)) {
        specifiers.push(specifier);
      }
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
    if (specifier && isRelativeLocalDependencySpecifier(specifier)) {
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
    `\\b(?:${[...aliases].map((alias) => alias.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")).join("|")})\\s*\\(\\s*(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)*(?:(["'\`])([^"'\`$]+)\\1|([A-Za-z_$][A-Za-z0-9_$]*))`,
    "gu",
  );

  for (const match of text.matchAll(aliasPattern)) {
    if (match[2]) {
      const specifier = decodeJavaScriptString(match[2]);
      if (isRelativeLocalDependencySpecifier(specifier)) specifiers.push(specifier);
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
  const createRequireNames = [...localJavaScriptCreateRequireNames(text)]
    .map((name) => name.replace(/[\^$.*+?()[\]{}|]/gu, "\\$&"))
    .join("|");
  const aliasPattern = new RegExp(
    `\\b(?:const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*(?:${createRequireNames})\\s*\\(\\s*import\\.meta\\.url\\s*\\)`,
    "gu",
  );
  for (const match of text.matchAll(aliasPattern)) {
    aliases.add(match[1]);
  }

  return aliases;
}

export function localJavaScriptCreateRequireNames(text) {
  const names = new Set(["createRequire"]);
  const moduleImportPattern =
    /\bimport\s*\{([\s\S]*?)\}\s*from\s*(["'])(?:node:)?module\2/gu;
  const moduleRequirePattern =
    /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*(["'])(?:node:)?module\2\s*\)/gu;

  for (const match of [...text.matchAll(moduleImportPattern), ...text.matchAll(moduleRequirePattern)]) {
    for (const specifier of match[1].split(",")) {
      const alias = /^createRequire(?:\s+as\s+|\s*:\s*)?([A-Za-z_$][A-Za-z0-9_$]*)?$/u.exec(
        specifier.trim(),
      );
      if (alias) names.add(alias[1] ?? "createRequire");
    }
  }

  return names;
}

export function localJavaScriptNewUrlDependencySpecifiers(text) {
  const specifiers = [];
  const directNewUrlPattern =
    /\bnew\s+URL\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])([^"'`$]+)\1\s*,\s*(?:\/\*[\s\S]*?\*\/\s*)*import\.meta\.url\s*\)/gu;
  for (const match of text.matchAll(directNewUrlPattern)) {
    const specifier = decodeJavaScriptString(match[2]);
    if (isRelativeLocalDependencySpecifier(specifier)) specifiers.push(specifier);
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
    /\bnew\s+Worker\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])([^"'`$]+)\1/gu;
  for (const match of text.matchAll(directWorkerPattern)) {
    const specifier = decodeJavaScriptString(match[2]);
    if (isRelativeLocalDependencySpecifier(specifier)) specifiers.push(specifier);
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
    const string = readJavaScriptStaticStringAt(text, match.index + match[0].length);
    if (string.closed && isRelativeLocalDependencySpecifier(string.value)) {
      variables.set(match[1], string.value);
      continue;
    }

    const initializerText = text.slice(match.index + match[0].length, match.index + match[0].length + 280);
    const joinedSpecifier = javascriptJoinedStringTexts(initializerText).find((specifier) =>
      isRelativeLocalDependencySpecifier(specifier),
    );
    if (joinedSpecifier) {
      variables.set(match[1], joinedSpecifier);
      continue;
    }

    const resolvedSpecifier = localJavaScriptRequireResolveSpecifier(initializerText);
    if (resolvedSpecifier) {
      variables.set(match[1], resolvedSpecifier);
    }
  }

  return variables;
}

export function localJavaScriptRequireResolveSpecifier(text) {
  const call = /^\s*require\s*\.\s*resolve\s*\(\s*/u.exec(text);
  if (!call) return "";

  const string = readJavaScriptStaticStringAt(text, call[0].length);
  if (string.closed && isRelativeLocalDependencySpecifier(string.value)) {
    return string.value;
  }

  return javascriptJoinedStringTexts(text.slice(call[0].length, call[0].length + 240)).find((specifier) =>
    isRelativeLocalDependencySpecifier(specifier),
  ) ?? "";
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
    ...javascriptJoinedStringTexts(text).filter((specifier) => isLocalConfigDependencySpecifier(specifier)),
    ...javascriptPathJoinStringTexts(text).filter((specifier) => isLocalConfigDependencySpecifier(specifier)),
    ...javascriptStaticTemplateTexts(text).filter((specifier) => isLocalConfigDependencySpecifier(specifier)),
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
  return isRelativeLocalDependencySpecifier(specifier) || isPackageRootLocalConfigSpecifier(specifier);
}

export function isRelativeLocalDependencySpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

export function isPackageRootLocalConfigSpecifier(specifier) {
  return (
    !specifier.startsWith("/") &&
    !specifier.startsWith("@") &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(specifier) &&
    /(?:^|\/)[A-Za-z0-9_.-]+\.(?:[cm]?[jt]sx?|json|ya?ml|toml|sh)$/u.test(specifier)
  );
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
  const fromMatch = /\bfrom\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])([^"'`$]+)\1/u.exec(statement);
  if (fromMatch) {
    const specifier = decodeJavaScriptString(fromMatch[2]);
    return isRelativeLocalDependencySpecifier(specifier) ? specifier : "";
  }

  const sideEffectImport = /^\s*import\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'`])([^"'`$]+)\1/u.exec(statement);
  if (!sideEffectImport) return "";

  const specifier = decodeJavaScriptString(sideEffectImport[2]);
  return isRelativeLocalDependencySpecifier(specifier) ? specifier : "";
}
