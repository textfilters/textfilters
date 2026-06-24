import { isShellBoundaryToken, isShellRedirectionToken, readJavaScriptStaticStringAt } from "./javascript-string-scanner.mjs";
import { relativePackagePath, shellWordValue } from "./local-workflow-scanner.mjs";
import { shellTokens } from "./shell-publish-counter.mjs";
import { splitScriptCommandParts, splitScriptCommands } from "./shell-script-syntax.mjs";
import { ALLOWED_PACKAGE_SCRIPT_NAMES, ALLOWED_PRETTIER_PATHS, BUILD_SCRIPT_COMMAND, CHECK_SCRIPT_WITH_BUILD, CHECK_SCRIPT_WITH_SMOKE_BUILD, NOOP_SCRIPT_COMMANDS, PROFANITY_DIST_SMOKE_SCRIPT, SEMVER_PATTERN, contract } from "./state.mjs";
import { arraysEqual, fail } from "./workflow-assertions.mjs";
import { stripYamlComments } from "./yaml-workflow-parser.mjs";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readText(label, path) {
  if (!existsSync(path)) {
    fail(label, `missing ${relativePackagePath(path)}`);
    return "";
  }
  return stripYamlComments(readFileSync(path, "utf8"));
}

export function expectEqual(label, name, actual, expected) {
  if (actual !== expected) {
    fail(label, `${name} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function expectString(label, name, actual) {
  if (typeof actual !== "string" || actual.length === 0) {
    fail(label, `${name} must be a non-empty string`);
  }
}

export function expectSemver(label, name, actual) {
  expectString(label, name, actual);
  if (typeof actual === "string" && !SEMVER_PATTERN.test(actual)) {
    fail(label, `${name} must be a valid semver version`);
  }
}

export function expectAbsentPrivate(label, actual) {
  if (actual === true) {
    fail(label, "package must not be private");
  }
}

export function expectNoPackageFileExclusions(label, packageDir, files) {
  for (const file of files ?? []) {
    if (typeof file === "string" && file.startsWith("!")) {
      fail(label, `package files must not include exclusion ${file}`);
    }
  }

  for (const ignoreFile of findDistIgnoreFiles(join(packageDir, "dist"))) {
    fail(label, `dist must not include ${ignoreFile}`);
  }
}

export function findDistIgnoreFiles(distDir) {
  if (!existsSync(distDir)) return [];

  const ignoreFiles = [];
  for (const entry of readdirSync(distDir, { withFileTypes: true })) {
    const entryPath = join(distDir, entry.name);
    if (entry.isDirectory()) {
      ignoreFiles.push(...findDistIgnoreFiles(entryPath));
    } else if (entry.name === ".npmignore" || entry.name === ".gitignore") {
      ignoreFiles.push(entry.name);
    }
  }
  return ignoreFiles;
}

export function expectOnlyPackageConfig(label, config) {
  const packageKeys = Object.keys(config.packages ?? {});
  if (packageKeys.length !== 1 || packageKeys[0] !== ".") {
    fail(label, 'release-please packages must include only "."');
  }
}

export function expectReleasePleaseConfigKeys(label, config) {
  expectOnlyJsonObjectKeys(label, "release-please config", config, [
    "$schema",
    "include-component-in-tag",
    "packages",
  ]);

  for (const packageConfig of Object.values(config.packages ?? {})) {
    expectOnlyJsonObjectKeys(label, "release-please package config", packageConfig, [
      "include-component-in-tag",
      "package-name",
      "release-type",
    ]);
  }
}

export function expectOnlyJsonObjectKeys(label, name, value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      fail(label, `${name} must not include ${key}`);
    }
  }
}

export function expectScriptCommand(label, scriptName, script, command) {
  const commands = splitScriptCommands(script);
  if (!commands.includes(command)) {
    fail(label, `script ${scriptName} must include command ${command}`);
  }
}

export function expectScriptCommandOrder(label, scriptName, script, expectedCommands) {
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

export function expectCheckScriptOnlyAuditedCommands(label, script) {
  const commandParts = splitScriptCommandParts(script);
  const commands = commandParts.map((part) => part.command);
  const expectedDelegated = contract.manifest.checkScriptMustInclude;
  const smokeIndex = expectedDelegated.indexOf("npm run smoke:dist");
  const expectedDirect =
    smokeIndex === -1
      ? expectedDelegated
      : [
          ...expectedDelegated.slice(0, smokeIndex),
          BUILD_SCRIPT_COMMAND,
          ...expectedDelegated.slice(smokeIndex),
        ];

  if (!arraysEqual(commands, expectedDelegated) && !arraysEqual(commands, expectedDirect)) {
    fail(label, "script check must contain only audited commands");
    return;
  }

  if (commandParts.slice(1).some((part) => part.separator !== "&&")) {
    fail(label, "script check must join audited commands with &&");
  }
}

export function expectBuildBeforeDistSmoke(label, scripts) {
  const checkCommands = splitScriptCommands(scripts?.check);
  const smokeCommandParts = splitScriptCommandParts(scripts?.["smoke:dist"]);
  const smokeCommands = smokeCommandParts.map((part) => part.command);
  const checkBuildIndex = checkCommands.indexOf("npm run build");
  const checkSmokeIndex = checkCommands.indexOf("npm run smoke:dist");

  expectDistSmokeWork(label, smokeCommandParts);

  if (checkBuildIndex !== -1 && checkSmokeIndex !== -1 && checkBuildIndex < checkSmokeIndex) {
    return;
  }

  if (
    checkSmokeIndex !== -1 &&
    smokeCommands.indexOf("npm run build") === 0 &&
    smokeCommands.length > 1 &&
    smokeCommandParts[1]?.separator === "&&"
  ) {
    return;
  }

  fail(label, "check script must run or delegate npm run build before smoke:dist");
}

export function expectDistSmokeWork(label, smokeCommandParts) {
  const smokeCommands = smokeCommandParts.map((part) => part.command);
  if (smokeCommands.length === 0) return;
  if (smokeCommandParts.slice(1).some((part) => part.separator === "||")) {
    fail(label, "smoke:dist script must not short-circuit dist smoke work");
  }
  if (smokeCommandParts.some((part) => part.separator === "&")) {
    fail(label, "smoke:dist script must not background dist smoke work");
  }
  if (smokeCommands.some((command) => isSuccessfulExitCommand(command))) {
    fail(label, "smoke:dist script must not exit before dist smoke work");
    return;
  }
  if (smokeCommands.some((command) => NOOP_SCRIPT_COMMANDS.has(command))) {
    fail(label, "smoke:dist script must not be a no-op");
    return;
  }
  if (smokeCommands.every((command) => command === "npm run build")) {
    fail(label, "smoke:dist script must do more than build");
  }
}

export function expectDelegatedScriptWork(label, scriptName, script) {
  const commandParts = splitScriptCommandParts(script);
  const commands = commandParts.map((part) => part.command);
  if (commands.length === 0) return;

  if (commandParts.slice(1).some((part) => part.separator === "||")) {
    fail(label, `script ${scriptName} must not short-circuit delegated work`);
  }
  if (commands.some((command) => isSuccessfulExitCommand(command))) {
    fail(label, `script ${scriptName} must not exit before work`);
    return;
  }
  if (commands.some((command) => NOOP_SCRIPT_COMMANDS.has(command))) {
    fail(label, `script ${scriptName} must not be a no-op`);
  }
}

export function expectAuditedPackageScriptTemplates(label, scripts) {
  for (const scriptName of Object.keys(scripts ?? {})) {
    if (!ALLOWED_PACKAGE_SCRIPT_NAMES.has(scriptName)) {
      fail(label, `script ${scriptName} must be one of the audited package scripts`);
    }
  }

  expectPrettierScriptTemplate(label, "lint", scripts?.lint, "--check");
  if (typeof scripts?.format === "string") {
    expectPrettierScriptTemplate(label, "format", scripts.format, "--write");
  }
  expectVitestScriptTemplate(label, scripts?.test);
  expectCheckScriptTemplate(label, scripts?.check);
  expectDistSmokeScriptTemplate(label, scripts?.["smoke:dist"]);
}

export function expectPrettierScriptTemplate(label, scriptName, script, mode) {
  const tokens = auditedSimpleScriptTokens(script);
  if (!tokens) {
    fail(label, `script ${scriptName} must match the audited prettier ${mode} template`);
    return;
  }
  if (tokens.length === 0) return;

  const paths = tokens.slice(1, -1);
  if (
    tokens[0] !== "prettier" ||
    tokens.at(-1) !== mode ||
    paths.length === 0 ||
    paths.some((path) => !ALLOWED_PRETTIER_PATHS.has(path))
  ) {
    fail(label, `script ${scriptName} must match the audited prettier ${mode} template`);
  }
}

export function expectVitestScriptTemplate(label, script) {
  const tokens = auditedSimpleScriptTokens(script);
  if (!tokens) {
    fail(label, "script test must match the audited vitest template");
    return;
  }
  if (tokens.length === 0) return;

  if (tokens[0] !== "vitest" || tokens[1] !== "run") {
    fail(label, "script test must match the audited vitest template");
    return;
  }

  let index = 2;
  if (tokens[index] === "tests") {
    index += 1;
  }
  if (tokens[index] === "--maxWorkers" && tokens[index + 1] === "4") {
    index += 2;
  }
  if (tokens[index] === "--testTimeout" && tokens[index + 1] === "15000") {
    index += 2;
  }
  if (index !== tokens.length) {
    fail(label, "script test must match the audited vitest template");
  }
}

export function expectCheckScriptTemplate(label, script) {
  if (typeof script !== "string") return;
  if (script !== CHECK_SCRIPT_WITH_BUILD && script !== CHECK_SCRIPT_WITH_SMOKE_BUILD) {
    fail(label, "script check must match an audited check template");
  }
}

export function expectDistSmokeScriptTemplate(label, script) {
  if (typeof script !== "string" || script.trim() === "") return;
  if (script === PROFANITY_DIST_SMOKE_SCRIPT) return;

  const tokens = auditedSimpleScriptTokens(script);
  if (!tokens) {
    fail(label, "script smoke:dist must match an audited dist smoke template");
    return;
  }
  const evalText = tokens[3] ?? "";
  if (
    tokens.length === 4 &&
    tokens[0] === "node" &&
    tokens[1] === "--input-type=module" &&
    tokens[2] === "--eval" &&
    nodeEvalUsesOnlyBuiltDistEntrypoint(evalText)
  ) {
    return;
  }

  fail(label, "script smoke:dist must match an audited dist smoke template");
}

export function auditedSimpleScriptTokens(script) {
  if (typeof script !== "string" || script.trim() === "") return [];
  const parts = splitScriptCommandParts(script);
  if (parts.length !== 1 || parts[0]?.separator) return null;
  const tokens = shellTokens(parts[0].command).map((token) => shellWordValue(token));
  return tokens.some((token) => isShellBoundaryToken(token) || isShellRedirectionToken(token) || token === "!")
    ? null
    : tokens;
}

export function nodeEvalUsesOnlyBuiltDistEntrypoint(scriptText) {
  const importSpecifiers = javascriptImportSpecifiers(scriptText);
  return arraysEqual(importSpecifiers, ["./dist/index.js"]);
}

export function javascriptImportSpecifiers(scriptText) {
  const specifiers = [];
  const importPattern = /\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*/gu;

  for (const match of scriptText.matchAll(importPattern)) {
    const specifier = readJavaScriptStaticStringAt(scriptText, match.index + match[0].length);
    if (specifier.closed) {
      specifiers.push(specifier.value);
    }
  }

  return specifiers;
}

export function isSuccessfulExitCommand(command) {
  return command === "exit" || command === "exit 0";
}
