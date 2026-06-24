import { isShellBoundaryToken, isShellRedirectionToken } from "./javascript-string-scanner.mjs";
import { localScriptDependencySpecifiers } from "./local-script-dependencies.mjs";
import { interpreterFileArgumentToken, isBareInterpreterScriptToken, isFileArgumentInterpreterToken, relativePackagePath, shellWordValue } from "./local-workflow-scanner.mjs";
import { readJson } from "./package-json-policy.mjs";
import { recordShellVariable, resolveShellVariables, shellTokens, shellVariableAssignment } from "./shell-publish-counter.mjs";
import { splitScriptCommands } from "./shell-script-syntax.mjs";
import { expectNoPublishEnvMutationInScriptText, isExecutedToolingScriptFile, scriptMutatesPackageManifest, scriptUsesChildProcessExecution, scriptUsesNpmExec } from "./tooling-mutations.mjs";
import { fail } from "./workflow-assertions.mjs";
import { hasNpmPublishCommand } from "./yaml-workflow-parser.mjs";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

export function expectNoPublishInScripts(label, packageDir, scripts) {
  const localScriptTextCache = new Map();
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script === "string" && hasNpmPublishCommand(script)) {
      fail(label, `script ${scriptName} must not include npm publish`);
    }
    for (const scriptPath of localFilesInvokedByScript(packageDir, script)) {
      const scriptText = readExistingLocalScriptFile(scriptPath, packageDir, new Set(), localScriptTextCache);
      if (scriptText && hasNpmPublishCommand(scriptText)) {
        fail(label, `script ${scriptName} referenced file ${relativePackagePath(scriptPath)} must not include npm publish`);
      }
      expectNoUnsupportedLocalScriptText(
        label,
        `script ${scriptName} referenced file ${relativePackagePath(scriptPath)}`,
        scriptText,
      );
      expectNoPublishEnvMutationInScriptText(
        label,
        `script ${scriptName} referenced file ${relativePackagePath(scriptPath)}`,
        scriptText,
      );
    }
  }
}

export function expectNoUnsupportedLocalScriptText(label, subject, script) {
  if (!script) return;
  if (scriptUsesChildProcessExecution(script)) {
    fail(label, `${subject} must not use child_process command execution`);
  }
  if (scriptUsesNpmExec(script)) {
    fail(label, `${subject} must not use npm exec`);
  }
  if (scriptMutatesPackageManifest(script)) {
    fail(label, `${subject} must not mutate package.json`);
  }
}

export function localFilesInvokedByScript(packageDir, script) {
  if (typeof script !== "string") return [];

  const localFiles = new Set();
  const shellVariables = new Map();
  for (const command of splitScriptCommands(script)) {
    const tokens = shellTokens(command).map((token) => shellWordValue(token));
    let resolvedTokens;
    const commandResolvedTokens = () => {
      resolvedTokens ??= tokens.map((candidate) => resolveShellVariables(candidate, shellVariables));
      return resolvedTokens;
    };
    for (let index = 0; index < tokens.length; index += 1) {
      const word = tokens[index];
      recordShellVariable(word, shellVariables);
      const token = resolveShellVariables(word, shellVariables);
      for (const scriptToken of nodeOptionsLocalScriptTokens(token)) {
        localFiles.add(resolve(packageDir, scriptToken));
      }
      if (isLocalScriptFileToken(token)) {
        localFiles.add(resolve(packageDir, token));
      }
      if (isShellOrNodeInterpreterToken(token)) {
        for (const scriptToken of interpreterLocalScriptTokens(token, commandResolvedTokens(), index + 1)) {
          localFiles.add(resolve(packageDir, scriptToken));
        }
      } else if (isFileArgumentInterpreterToken(token)) {
        const scriptToken = interpreterFileArgumentToken(commandResolvedTokens(), index + 1);
        if (scriptToken && (isLocalScriptFileToken(scriptToken) || isBareInterpreterScriptToken(scriptToken))) {
          localFiles.add(resolve(packageDir, scriptToken));
        }
      } else if (isEnvCommandToken(token)) {
        for (const scriptToken of envCommandLocalScriptTokens(commandResolvedTokens(), index + 1)) {
          localFiles.add(resolve(packageDir, scriptToken));
        }
      }
    }
  }

  return [...localFiles].filter((path) => isPathInsidePackageDir(path, packageDir));
}

export function nodeOptionsLocalScriptTokens(word) {
  const assignment = shellVariableAssignment(word);
  if (assignment?.name !== "NODE_OPTIONS") return [];

  const tokens = shellTokens(assignment.value).map((token) => shellWordValue(token));
  return interpreterLocalScriptTokens("node", tokens, 0);
}

export function isShellOrNodeInterpreterToken(token) {
  return ["bash", "sh", "node"].includes(commandBasename(token));
}

export function isEnvCommandToken(token) {
  return commandBasename(token) === "env";
}

export function envCommandLocalScriptTokens(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) return [];
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    if (shellVariableAssignment(token)) {
      continue;
    }
    if (token.startsWith("-")) {
      if (["-S", "--split-string"].includes(token)) {
        return envSplitStringLocalScriptTokens(tokens[index + 1] ?? "");
      }
      const splitString = envSplitStringOptionValue(token);
      if (splitString) return envSplitStringLocalScriptTokens(splitString);
      continue;
    }
    if (!isShellOrNodeInterpreterToken(token)) return [];
    return interpreterLocalScriptTokens(token, tokens, index + 1);
  }

  return [];
}

export function envSplitStringOptionValue(token) {
  for (const option of ["-S", "--split-string"]) {
    if (token.startsWith(`${option}=`)) {
      return token.slice(option.length + 1);
    }
  }

  return "";
}

export function envSplitStringCommandText(tokens, startIndex, shellVariables = new Map()) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) return "";
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (token === "--") {
      continue;
    }
    const splitString = envSplitStringOptionValue(token);
    if (splitString) {
      return splitString;
    }
    if (token === "-S" || token === "--split-string") {
      return resolveShellVariables(shellWordValue(tokens[index + 1] ?? ""), shellVariables);
    }
    if (shellVariableAssignment(token)) {
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    return "";
  }

  return "";
}

export function envSplitStringLocalScriptTokens(scriptText) {
  const tokens = shellTokens(scriptText).map((token) => shellWordValue(token));
  const shellVariables = new Map();
  const scriptTokens = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const word = tokens[index];
    recordShellVariable(word, shellVariables);
    const token = resolveShellVariables(word, shellVariables);
    const resolvedTokens = tokens.map((candidate) => resolveShellVariables(candidate, shellVariables));
    for (const scriptToken of nodeOptionsLocalScriptTokens(token)) {
      scriptTokens.push(scriptToken);
    }
    if (isShellBoundaryToken(token)) return scriptTokens;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (shellVariableAssignment(token)) continue;
    if (!isShellOrNodeInterpreterToken(token)) continue;
    return [...scriptTokens, ...interpreterLocalScriptTokens(token, resolvedTokens, index + 1)];
  }

  return scriptTokens;
}

export function interpreterLocalScriptTokens(command, tokens, startIndex) {
  const scriptTokens = [];
  const basename = commandBasename(command);

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
    const inlinePreloadValue = nodePreloadOptionValue(basename, token);
    if (inlinePreloadValue) {
      if (isLocalScriptFileToken(inlinePreloadValue) || isBareInterpreterScriptToken(inlinePreloadValue)) {
        scriptTokens.push(inlinePreloadValue);
      }
      continue;
    }
    if (token.startsWith("-")) {
      const evalScriptToken = nodeEvalOptionConsumesValue(basename, token) ? tokens[index + 1] ?? "" : "";
      if (evalScriptToken) {
        scriptTokens.push(...nodeEvalLocalScriptTokens(evalScriptToken));
        index += 1;
        continue;
      }
      if (nodePreloadOptionConsumesValue(basename, token)) {
        const preloadToken = tokens[index + 1] ?? "";
        if (isLocalScriptFileToken(preloadToken) || isBareInterpreterScriptToken(preloadToken)) {
          scriptTokens.push(preloadToken);
        }
        index += 1;
      } else if (interpreterOptionConsumesValue(token)) {
        index += 1;
      }
      continue;
    }
    if (isLocalScriptFileToken(token) || isBareInterpreterScriptToken(token)) {
      scriptTokens.push(token);
    }
  }

  return scriptTokens;
}

export function nodeEvalLocalScriptTokens(scriptText) {
  return localScriptDependencySpecifiers(scriptText).filter((specifier) => specifier !== "./dist/index.js");
}

export function nodePreloadOptionValue(command, token) {
  if (commandBasename(command) !== "node") return "";

  for (const option of ["--require", "--import", "--loader", "--experimental-loader"]) {
    if (token.startsWith(`${option}=`)) {
      return token.slice(option.length + 1);
    }
  }

  return "";
}

export function nodePreloadOptionConsumesValue(command, token) {
  return (
    commandBasename(command) === "node" &&
    ["-r", "--require", "--import", "--loader", "--experimental-loader"].includes(token)
  );
}

export function nodeEvalOptionConsumesValue(command, token) {
  return commandBasename(command) === "node" && ["-e", "--eval", "-p", "--print"].includes(token);
}

export function interpreterOptionConsumesValue(token) {
  return [
    "-r",
    "--require",
    "--import",
    "--loader",
    "--experimental-loader",
    "-e",
    "--eval",
    "-p",
    "--print",
    "-c",
  ].includes(token);
}

export function commandBasename(command) {
  return command.replace(/\\/gu, "/").split("/").pop() ?? "";
}

export function isPathInsidePackageDir(path, packageDir) {
  return path === packageDir || path.startsWith(`${packageDir}/`);
}

export function isLocalScriptFileToken(token) {
  return token.startsWith("./") || token.startsWith("../") || isRelativeLocalPathToken(token);
}

export function isRelativeLocalPathToken(token) {
  return /^[A-Za-z0-9_.-]+\/(?:[A-Za-z0-9_.-]+\/?)*$/u.test(token);
}

export function readExistingLocalScriptFile(path, packageDir, visited = new Set(), textCache = new Map()) {
  const scriptPath = existingLocalScriptPath(path);
  if (!scriptPath) return "";
  if (!isPathInsidePackageDir(scriptPath, packageDir)) return "";
  if (visited.has(scriptPath)) return "";
  if (textCache.has(scriptPath)) return textCache.get(scriptPath);
  visited.add(scriptPath);

  try {
    if (statSync(scriptPath).isDirectory()) {
      const directoryText = localScriptDirectoryEntrypointText(scriptPath, packageDir, visited, textCache);
      textCache.set(scriptPath, directoryText);
      return directoryText;
    }
    const scriptText = readFileSync(scriptPath, "utf8");
    const dependencyTexts = localScriptDependencyPaths(scriptText, dirname(scriptPath), packageDir).map(
      (dependencyPath) => readExistingLocalScriptFile(dependencyPath, packageDir, visited, textCache),
    );
    const combinedText = [scriptText, ...dependencyTexts].filter(Boolean).join("\n");
    textCache.set(scriptPath, combinedText);
    return combinedText;
  } catch {
    return "";
  }
}

export function existingLocalScriptPath(path) {
  if (existsSync(path)) return path;
  if (extname(path)) return "";

  for (const extension of [".js", ".mjs", ".cjs", ".ts", ".tsx", ".sh"]) {
    const candidate = `${path}${extension}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function localScriptDirectoryEntrypointText(path, packageDir, visited, textCache) {
  const entrypointTexts = [];
  const packageJsonPath = join(path, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = readJson(packageJsonPath);
      for (const entrypoint of [pkg.main, pkg.module]) {
        if (typeof entrypoint === "string") {
          const entrypointPath = resolve(path, entrypoint);
          if (isPathInsidePackageDir(entrypointPath, packageDir) && existsSync(entrypointPath)) {
            entrypointTexts.push(readExistingLocalScriptFile(entrypointPath, packageDir, visited, textCache));
          }
        }
      }
    } catch {
      // Ignore invalid nested metadata; the package-level audit reports package metadata issues separately.
    }
  }

  for (const entrypoint of ["index.js", "index.mjs", "index.cjs", "index.ts", "index.tsx", "index.sh"]) {
    const entrypointPath = join(path, entrypoint);
    if (existsSync(entrypointPath)) {
      entrypointTexts.push(readExistingLocalScriptFile(entrypointPath, packageDir, visited, textCache));
    }
  }

  return entrypointTexts.join("\n");
}

export function localScriptDependencyPaths(scriptText, baseDir, packageDir) {
  const dependencyPaths = new Set();

  for (const specifier of localScriptDependencySpecifiers(scriptText)) {
    for (const dependencyPath of localScriptDependencyPathsForSpecifier(specifier, baseDir, packageDir)) {
      dependencyPaths.add(dependencyPath);
    }
  }

  return [...dependencyPaths];
}

export function localScriptDependencyPathsForSpecifier(specifier, baseDir, packageDir) {
  if (isLocalGlobSpecifier(specifier)) {
    return expandLocalGlobSpecifier(specifier, baseDir, packageDir);
  }

  const dependencyPath = existingLocalScriptPath(resolve(baseDir, specifier));
  return dependencyPath && isPathInsidePackageDir(dependencyPath, packageDir) ? [dependencyPath] : [];
}

export function isLocalGlobSpecifier(specifier) {
  return /[*?\[{]/u.test(specifier);
}

export function expandLocalGlobSpecifier(specifier, baseDir, packageDir) {
  const patternPath = resolve(baseDir, specifier).replace(/\\/gu, "/");
  const patterns = expandBracePatterns(patternPath).map((pattern) => globPathPatternRegex(pattern));
  return listPackageScriptFiles(packageDir).filter((filePath) => {
    const normalizedPath = filePath.replace(/\\/gu, "/");
    return patterns.some((pattern) => pattern.test(normalizedPath));
  });
}

export function listPackageScriptFiles(directory) {
  const files = [];
  let entries = [];

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "coverage", "dist", "node_modules"].includes(entry.name)) continue;
      files.push(...listPackageScriptFiles(entryPath));
    } else if (entry.isFile() && isExecutedToolingScriptFile(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

export function globPathPatternRegex(pattern) {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const extglob = globExtglobSource(pattern, index);
    if (extglob) {
      source += extglob.source;
      index = extglob.endIndex;
      continue;
    }
    if (char === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
        continue;
      }
      source += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    if (char === "[") {
      const charClass = globCharacterClassSource(pattern, index);
      if (charClass) {
        source += charClass.source;
        index = charClass.endIndex;
        continue;
      }
    }
    source += escapeRegExpChar(char);
  }

  return new RegExp(`${source}$`, "u");
}

export function expandBracePatterns(pattern) {
  const startIndex = pattern.indexOf("{");
  if (startIndex === -1) return [pattern];

  const endIndex = matchingBraceEndIndex(pattern, startIndex);
  if (endIndex === -1) return [pattern];

  const prefix = pattern.slice(0, startIndex);
  const suffix = pattern.slice(endIndex + 1);
  return splitBraceOptions(pattern.slice(startIndex + 1, endIndex)).flatMap((option) =>
    expandBracePatterns(`${prefix}${option}${suffix}`),
  );
}

export function matchingBraceEndIndex(pattern, startIndex) {
  let depth = 0;
  for (let index = startIndex; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

export function splitBraceOptions(value) {
  const options = [];
  let option = "";
  let depth = 0;

  for (const char of value) {
    if (char === "," && depth === 0) {
      options.push(option);
      option = "";
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && depth > 0) depth -= 1;
    option += char;
  }

  options.push(option);
  return options;
}

export function globExtglobSource(pattern, startIndex) {
  const operator = pattern[startIndex];
  if (!["?", "@", "+", "*"].includes(operator) || pattern[startIndex + 1] !== "(") return null;

  const endIndex = matchingParenEndIndex(pattern, startIndex + 1);
  if (endIndex === -1) return null;

  const alternatives = pattern
    .slice(startIndex + 2, endIndex)
    .split("|")
    .map((alternative) => alternative.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&"))
    .join("|");
  const source = `(?:${alternatives})`;
  const quantifier = operator === "?" ? "?" : operator === "@" ? "" : operator;
  return { source: `${source}${quantifier}`, endIndex };
}

export function matchingParenEndIndex(pattern, startIndex) {
  let depth = 0;
  for (let index = startIndex; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

export function globCharacterClassSource(pattern, startIndex) {
  const endIndex = pattern.indexOf("]", startIndex + 1);
  if (endIndex === -1) return null;

  const value = pattern.slice(startIndex + 1, endIndex).replace(/\\/gu, "\\\\");
  return { source: `[${value}]`, endIndex };
}

export function escapeRegExpChar(char) {
  return /[\\^$.*+?()[\]{}|]/u.test(char) ? `\\${char}` : char;
}
