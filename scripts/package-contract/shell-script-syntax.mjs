import { isShellBoundaryToken, isShellInputRedirectionToken, isShellRedirectionToken } from "./javascript-string-scanner.mjs";
import { isBareInterpreterScriptToken, isFileArgumentInterpreterToken, isLocalPathToken, shellWordValue } from "./local-workflow-scanner.mjs";
import { isSuccessfulExitCommand } from "./package-json-policy.mjs";
import { shellTokens, textUsesNonShellInterpreterEval } from "./shell-publish-counter.mjs";
import { scriptMutatesPackageManifest, scriptUsesChildProcessExecution, scriptUsesNpmExec, scriptUsesXargs } from "./tooling-mutations.mjs";
import { fail } from "./workflow-assertions.mjs";
import { shellContinuationText, shellScanTexts, workflowRunCommandTexts } from "./yaml-workflow-parser.mjs";
import { join } from "node:path";

export function splitScriptCommands(script) {
  return splitScriptCommandParts(script).map((part) => part.command);
}

export function splitScriptCommandParts(script) {
  if (typeof script !== "string") return [];

  const text = shellContinuationText(shellCommentText(script));
  const parts = [];
  let command = "";
  let quote = "";
  let escaped = false;
  let separator = "";

  const pushCommand = (nextSeparator) => {
    const trimmed = command.trim();
    if (trimmed) {
      parts.push({ command: trimmed, separator });
    }
    command = "";
    separator = nextSeparator;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      command += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      command += char;
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      command += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      command += char;
      continue;
    }
    if (quote === "" && (char === "&" || char === "|") && text[index + 1] === char) {
      pushCommand(`${char}${char}`);
      index += 1;
      continue;
    }
    if (quote === "" && (char === ";" || char === "|" || char === "&")) {
      pushCommand(char);
      continue;
    }
    if (quote === "" && char === "\n") {
      while (text[index + 1] === "\n") {
        index += 1;
      }
      pushCommand("\n");
      continue;
    }
    command += char;
  }

  pushCommand("");
  return parts;
}

export function shellCommentText(text) {
  return text
    .split("\n")
    .map((line) => stripShellLineComment(line))
    .join("\n");
}

export function stripShellLineComment(line) {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
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
    if (char === "#" && quote === "" && (index === 0 || /\s/u.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }

  return line;
}

export function expectNoScriptCommandBefore(label, scriptName, script, anchorCommand, blockedCommand) {
  const commands = splitScriptCommands(script);
  const anchorIndex = commands.indexOf(anchorCommand);
  if (anchorIndex === -1) return;

  if (commands.slice(0, anchorIndex).some((command) => isBlockedScriptCommand(command, blockedCommand))) {
    fail(label, `script ${scriptName} must not run ${blockedCommand} before ${anchorCommand}`);
  }
}

export function isBlockedScriptCommand(command, blockedCommand) {
  if (blockedCommand === "exit 0") {
    return isSuccessfulExitCommand(command);
  }
  return command === blockedCommand;
}

export function expectNoExitBeforeScriptCommands(label, scriptName, script, anchorCommands) {
  for (const anchorCommand of anchorCommands) {
    expectNoScriptCommandBefore(label, scriptName, script, anchorCommand, "exit 0");
  }
}

export function expectNoUnsupportedPackageScriptSyntax(label, scripts) {
  for (const [scriptName, script] of Object.entries(scripts ?? {})) {
    if (typeof script !== "string") continue;

    if (hasShellCommandSubstitution(script)) {
      fail(label, `script ${scriptName} must not use shell command substitution`);
    }
    if (hasShellProcessSubstitution(script)) {
      fail(label, `script ${scriptName} must not use shell process substitution`);
    }
    if (hasShellFunctionDefinition(script)) {
      fail(label, `script ${scriptName} must not define shell functions`);
    }
    if (hasShellAliasDefinition(script)) {
      fail(label, `script ${scriptName} must not define shell aliases`);
    }
    if (textFeedsShellInterpreterOnStdin(script)) {
      fail(label, `script ${scriptName} must not feed scripts to shell interpreters on stdin`);
    }
    if (textUsesShellGlobs(script)) {
      fail(label, `script ${scriptName} must not use shell globs`);
    }
    if (splitScriptCommandParts(script).some((part) => part.separator === "|")) {
      fail(label, `script ${scriptName} must not use shell pipelines`);
    }
    if (hasShellCommandNegation(script)) {
      fail(label, `script ${scriptName} must not use shell command negation`);
    }
    if (scriptUsesChildProcessExecution(script)) {
      fail(label, `script ${scriptName} must not use child_process command execution`);
    }
    if (textUsesNonShellInterpreterEval(script)) {
      fail(label, `script ${scriptName} must not use non-shell interpreter eval snippets`);
    }
    if (scriptUsesNpmExec(script)) {
      fail(label, `script ${scriptName} must not use npm exec`);
    }
    if (scriptUsesXargs(script)) {
      fail(label, `script ${scriptName} must not use xargs command execution`);
    }
    if (scriptMutatesPackageManifest(script)) {
      fail(label, `script ${scriptName} must not mutate package.json`);
    }
  }
}

export function hasShellCommandSubstitution(text) {
  return /`|\$\(/u.test(text);
}

export function hasShellProcessSubstitution(text) {
  return shellScanTexts(text).some((commandText) =>
    shellContinuationText(shellCommentText(commandText))
      .split("\n")
      .some((line) => shellLineHasProcessSubstitution(line)),
  );
}

export function shellLineHasProcessSubstitution(line) {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index];
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
    if (quote === "" && (char === "<" || char === ">") && line[index + 1] === "(") {
      return true;
    }
  }

  return false;
}

export function hasShellFunctionDefinition(text) {
  return /(?:^|[;&|({}\n]\s*)(?:function\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?:\(\s*\))?\s*\{/u.test(text);
}

export function hasShellAliasDefinition(text) {
  return shellScanTexts(text).some((commandText) =>
    /(?:^|[;&|\n]\s*)alias\s+[A-Za-z_][A-Za-z0-9_]*=/u.test(shellContinuationText(commandText)),
  );
}

export function hasShellCommandNegation(text) {
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => shellTokens(line).some((token) => shellWordValue(token) === "!"));
}

export function textFeedsShellInterpreterOnStdin(text) {
  return shellScanTexts(text).some((commandText) => shellTextFeedsShellInterpreterOnStdin(commandText));
}

export function workflowRunCommandsUseShellGlobs(workflow) {
  const lines = workflow.split("\n");
  return workflowRunCommandTexts(lines).some((commandText) => textUsesShellGlobs(commandText));
}

export function textUsesShellGlobs(text) {
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => shellTokens(line).some((token) => shellTokenContainsUnquotedGlob(token)));
}

export function shellTokenContainsUnquotedGlob(token) {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
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
    if (quote === "" && (char === "*" || char === "?" || char === "[")) {
      return true;
    }
    if (quote === "" && char === "{" && token[index - 1] !== "$" && tokenHasBraceExpansion(token, index)) {
      return true;
    }
  }

  return false;
}

export function tokenHasBraceExpansion(token, startIndex) {
  let quote = "";
  let escaped = false;
  let hasSeparator = false;

  for (let index = startIndex + 1; index < token.length; index += 1) {
    const char = token[index];
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
    if (char === "," || (char === "." && token[index + 1] === ".")) {
      hasSeparator = true;
      if (char === ".") index += 1;
      continue;
    }
    if (char === "}") {
      return hasSeparator;
    }
  }

  return false;
}

export function shellTextFeedsShellInterpreterOnStdin(text) {
  const strippedText = shellContinuationText(shellCommentText(text));
  return strippedText
    .split("\n")
    .some((line) => {
      if (
        /(?:^|[;&]\s*)(?:bash|bun|deno|node|perl|php|python|python3|ruby|sh|tsx)\b[^;&|]*(?:<<<|<<)/u.test(line) ||
        /\|\s*(?:bash|bun|deno|node|perl|php|python|python3|ruby|sh|tsx)\b/u.test(line)
      ) {
        return true;
      }

      const tokens = shellTokens(line).map((token) => shellWordValue(token));
      for (let index = 0; index < tokens.length; index += 1) {
        if (!isFileArgumentInterpreterToken(tokens[index])) continue;
        if (interpreterReadsLocalFileFromStdin(tokens, index + 1)) {
          return true;
        }
      }

      return false;
    });
}

export function interpreterReadsLocalFileFromStdin(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isShellBoundaryToken(token)) return false;
    if (isShellInputRedirectionToken(token)) {
      const scriptToken = tokens[index + 1] ?? "";
      return isLocalPathToken(scriptToken) || isBareInterpreterScriptToken(scriptToken);
    }
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
  }

  return false;
}
