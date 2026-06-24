import { isShellBoundaryToken, isShellRedirectionToken } from "./javascript-string-scanner.mjs";
import { shellWordValue } from "./local-workflow-scanner.mjs";

export function recordPrintfShellVariable(tokens, index, shellVariables, resolveShellVariables, shellCommandBasename) {
  if (shellCommandBasename(resolveShellVariables(shellWordValue(tokens[index]), shellVariables)) !== "printf") return;

  let variableName = "";
  for (let argumentIndex = index + 1; argumentIndex < tokens.length; argumentIndex += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[argumentIndex]), shellVariables);
    if (isShellBoundaryToken(token)) return;
    if (isShellRedirectionToken(token)) {
      argumentIndex += 1;
      continue;
    }
    if (token === "-v") {
      variableName = resolveShellVariables(shellWordValue(tokens[argumentIndex + 1] ?? ""), shellVariables);
      argumentIndex += 1;
      continue;
    }
    if (token.startsWith("-v") && token.length > 2) {
      variableName = token.slice(2);
      continue;
    }
    if (variableName) {
      shellVariables.set(variableName, token);
      return;
    }
  }
}

export function countGitShellAliasPublishCommands(
  tokens,
  index,
  shellVariables,
  resolveShellVariables,
  shellCommandBasename,
  countShellText,
) {
  const command = shellCommandBasename(resolveShellVariables(shellWordValue(tokens[index]), shellVariables));
  if (command !== "git") return 0;

  let publishCommandCount = 0;
  for (let argumentIndex = index + 1; argumentIndex < tokens.length; argumentIndex += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[argumentIndex]), shellVariables);
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      argumentIndex += 1;
      continue;
    }
    if (token === "-c") {
      publishCommandCount += countGitConfigAliasPublishCommands(
        resolveShellVariables(shellWordValue(tokens[argumentIndex + 1] ?? ""), shellVariables),
        countShellText,
      );
      argumentIndex += 1;
    }
  }

  return publishCommandCount;
}

export function countGitConfigAliasPublishCommands(config, countShellText) {
  const marker = "=!";
  if (!/^alias\.[A-Za-z0-9_.-]+=!/u.test(config)) return 0;

  const scriptText = config.slice(config.indexOf(marker) + marker.length);
  return scriptText ? countShellText(scriptText) : 0;
}
