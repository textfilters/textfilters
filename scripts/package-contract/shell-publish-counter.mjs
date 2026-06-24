import { countJavaScriptEmbeddedPublishCommands, countJavaScriptStringPublishCommands, isNpmCommandToken, isNpmPublishSubcommandToken, isNpxCommandToken, isPackagePublishCommandToken, isPotentialPackagePublishCommandToken, isShellBoundaryToken, isShellRedirectionToken } from "./javascript-string-scanner.mjs";
import { envSplitStringCommandText, isEnvCommandToken } from "./local-script-execution.mjs";
import { interpreterFileOptionConsumesValue, isFileArgumentInterpreterToken, shellWordValue } from "./local-workflow-scanner.mjs";
import { shellCommentText } from "./shell-script-syntax.mjs";
import { shellContinuationText, shellScanTexts } from "./yaml-workflow-parser.mjs";
import { join } from "node:path";

export function lineHasNpmPublishCommand(line) {
  return countNpmPublishCommandsInLine(line) > 0;
}

export function countNpmPublishCommandsInShellText(text) {
  const shellVariables = new Map();
  const packagePublishCommandVariables = new Set();
  const publishSubcommandVariables = new Set();
  const npmFunctionNames = new Set();
  return text
    .split("\n")
    .reduce(
      (lineCount, line) =>
        lineCount +
        countNpmPublishCommandsInLine(
          line,
          shellVariables,
          packagePublishCommandVariables,
          publishSubcommandVariables,
          npmFunctionNames,
        ),
      0,
    );
}

export function countNpmPublishCommandsInLine(
  line,
  shellVariables = new Map(),
  packagePublishCommandVariables = new Set(),
  publishSubcommandVariables = new Set(),
  npmFunctionNames = new Set(),
) {
  const tokens = shellTokens(line);
  let publishCommandCount =
    shellCommandSubstitutionTexts(line).reduce(
      (count, commandText) => count + countNpmPublishCommandsInShellText(commandText),
      0,
    ) + countJavaScriptEmbeddedPublishCommands(line);

  for (let index = 0; index < tokens.length; index += 1) {
    const word = shellWordValue(tokens[index]);
    recordShellForLoopVariable(tokens, index, shellVariables);
    const forLoop = countShellForLoopPublishCommands(tokens, index, shellVariables);
    if (forLoop) {
      publishCommandCount += forLoop.count;
      index = forLoop.endIndex;
      continue;
    }
    recordShellVariable(word, shellVariables);
    const resolvedWord = resolveShellVariables(word, shellVariables);
    const expandedCommandCount = countExpandedVariableCommandPublishCommands(
      tokens,
      index,
      resolvedWord,
      shellVariables,
    );
    if (expandedCommandCount > 0) {
      publishCommandCount += expandedCommandCount;
      continue;
    }
    recordPackagePublishCommandVariable(resolvedWord, packagePublishCommandVariables);
    recordNpmPublishSubcommandVariable(resolvedWord, publishSubcommandVariables);
    const functionDefinition = recordNpmFunctionWrapper(
      tokens,
      index,
      shellVariables,
      packagePublishCommandVariables,
      npmFunctionNames,
      isPackagePublishCommandToken,
    );
    if (functionDefinition) {
      index = functionDefinition.endIndex;
      continue;
    }
    publishCommandCount += countEnvSplitStringPublishCommands(tokens, index, shellVariables);
    publishCommandCount += countEvalWrappedPublishCommands(tokens, index, shellVariables);
    publishCommandCount += countInterpreterWrappedPublishCommands(tokens, index, shellVariables);
    const mayBePackagePublishCommand =
      isPackagePublishCommandToken(resolvedWord, packagePublishCommandVariables) ||
      isPotentialPackagePublishCommandToken(tokens[index], resolvedWord, shellVariables);
    if (!mayBePackagePublishCommand && !npmFunctionNames.has(resolvedWord)) {
      continue;
    }

    for (let commandIndex = index + 1; commandIndex < tokens.length; commandIndex += 1) {
      const token = resolveShellVariables(shellWordValue(tokens[commandIndex]), shellVariables);
      if (isShellRedirectionToken(token)) {
        commandIndex += 1;
        continue;
      }
      if (isShellBoundaryToken(token)) {
        break;
      }
      if (isNpmPublishSubcommandToken(token, publishSubcommandVariables)) {
        publishCommandCount += 1;
        break;
      }
    }
  }

  return publishCommandCount;
}

export function countShellForLoopPublishCommands(tokens, index, shellVariables) {
  if (shellWordValue(tokens[index]) !== "for") return null;

  const name = shellWordValue(tokens[index + 1] ?? "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) return null;
  if (shellWordValue(tokens[index + 2] ?? "") !== "in") return null;

  const doIndex = tokens.findIndex((token, tokenIndex) => tokenIndex > index + 2 && shellWordValue(token) === "do");
  if (doIndex === -1) return null;
  const doneIndex = tokens.findIndex((token, tokenIndex) => tokenIndex > doIndex && shellWordValue(token) === "done");
  if (doneIndex === -1) return null;

  const values = tokens
    .slice(index + 3, doIndex)
    .map((token) => shellWordValue(token))
    .filter((token) => !isShellBoundaryToken(token))
    .map((token) => resolveShellVariables(token, shellVariables));
  const body = tokens.slice(doIndex + 1, doneIndex).join(" ");
  const count = values.reduce((total, value) => {
    const loopVariables = new Map(shellVariables);
    loopVariables.set(name, value);
    return total + countNpmPublishCommandsInLine(body, loopVariables, new Set(), new Set(), new Set());
  }, 0);

  return { count, endIndex: doneIndex };
}

export function recordShellForLoopVariable(tokens, index, shellVariables) {
  if (shellWordValue(tokens[index]) !== "for") return;

  const name = shellWordValue(tokens[index + 1] ?? "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) return;
  if (shellWordValue(tokens[index + 2] ?? "") !== "in") return;

  const values = [];
  for (let valueIndex = index + 3; valueIndex < tokens.length; valueIndex += 1) {
    const value = shellWordValue(tokens[valueIndex]);
    if (isShellBoundaryToken(value) || value === "do") break;
    values.push(resolveShellVariables(value, shellVariables));
  }
  if (values.length === 0) return;

  const publishCommandValue = values.find((value) => isPackagePublishCommandToken(value));
  const publishSubcommandValue = values.find((value) => isNpmPublishSubcommandToken(value));
  shellVariables.set(name, publishCommandValue ?? publishSubcommandValue ?? values[0]);
}

export function countExpandedVariableCommandPublishCommands(tokens, index, resolvedWord, shellVariables) {
  if (!isUnquotedShellVariableReferenceToken(tokens[index])) return 0;
  if (!/\s/u.test(resolvedWord)) return 0;
  if (!shellTokenStartsCommand(tokens, index)) return 0;

  const expandedWords = shellTokens(resolvedWord).map((token) => shellWordValue(token));
  if (expandedWords.length < 2) return 0;

  const trailingWords = [];
  for (let trailingIndex = index + 1; trailingIndex < tokens.length; trailingIndex += 1) {
    const word = shellWordValue(tokens[trailingIndex]);
    trailingWords.push(resolveShellVariables(word, shellVariables));
    if (isShellBoundaryToken(word)) break;
  }

  return countNpmPublishCommandsInShellText([...expandedWords, ...trailingWords].join(" "));
}

export function isUnquotedShellVariableReferenceToken(token) {
  return /^\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})$/u.test(token);
}

export function shellTokenStartsCommand(tokens, index) {
  let startIndex = 0;
  for (let currentIndex = index - 1; currentIndex >= 0; currentIndex -= 1) {
    if (isShellBoundaryToken(shellWordValue(tokens[currentIndex]))) {
      startIndex = currentIndex + 1;
      break;
    }
  }

  let sawEnvCommand = false;
  for (let currentIndex = startIndex; currentIndex < index; currentIndex += 1) {
    const word = shellWordValue(tokens[currentIndex]);
    if (isShellRedirectionToken(word)) {
      currentIndex += 1;
      continue;
    }
    if (shellVariableAssignment(word)) continue;
    if (isEnvCommandToken(word)) {
      sawEnvCommand = true;
      continue;
    }
    if (sawEnvCommand && (word === "--" || word.startsWith("-"))) continue;
    return false;
  }

  return true;
}

export function countEnvSplitStringPublishCommands(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isEnvCommandToken(command)) return 0;

  const scriptText = envSplitStringCommandText(tokens, index + 1, shellVariables);
  return scriptText ? countNpmPublishCommandsInShellText(scriptText) : 0;
}

export function recordNpmFunctionWrapper(
  tokens,
  index,
  shellVariables,
  commandVariables,
  npmFunctionNames,
  isCommandToken = isNpmCommandToken,
) {
  const definition = shellFunctionDefinition(tokens, index);
  if (!definition) return null;

  if (shellFunctionBodyDelegatesToNpm(definition.bodyTokens, shellVariables, commandVariables, isCommandToken)) {
    npmFunctionNames.add(definition.name);
  } else {
    npmFunctionNames.delete(definition.name);
  }

  return { endIndex: definition.endIndex };
}

export function shellFunctionDefinition(tokens, index) {
  const name = shellWordValue(tokens[index]);
  if (
    isShellFunctionName(name) &&
    tokens[index + 1] === "(" &&
    tokens[index + 2] === ")" &&
    tokens[index + 3] === "{"
  ) {
    return readShellFunctionDefinition(tokens, name, index + 4);
  }
  if (
    name === "function" &&
    isShellFunctionName(shellWordValue(tokens[index + 1] ?? "")) &&
    tokens[index + 2] === "{"
  ) {
    return readShellFunctionDefinition(tokens, shellWordValue(tokens[index + 1]), index + 3);
  }

  return null;
}

export function readShellFunctionDefinition(tokens, name, bodyStartIndex) {
  let depth = 1;
  for (let index = bodyStartIndex; index < tokens.length; index += 1) {
    if (tokens[index] === "{") {
      depth += 1;
    } else if (tokens[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { name, bodyTokens: tokens.slice(bodyStartIndex, index), endIndex: index };
      }
    }
  }

  return null;
}

export function isShellFunctionName(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}

export function shellFunctionBodyDelegatesToNpm(bodyTokens, shellVariables, commandVariables, isCommandToken) {
  for (let index = 0; index < bodyTokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(bodyTokens[index]), shellVariables);
    if (!isCommandToken(token, commandVariables)) continue;

    for (let commandIndex = index + 1; commandIndex < bodyTokens.length; commandIndex += 1) {
      const argument = resolveShellVariables(shellWordValue(bodyTokens[commandIndex]), shellVariables);
      if (isShellBoundaryToken(argument)) break;
      if (isShellRedirectionToken(argument)) {
        commandIndex += 1;
        continue;
      }
      if (isShellArgumentForwardingToken(argument)) {
        return true;
      }
    }
  }

  return false;
}

export function isShellArgumentForwardingToken(token) {
  return token === "$@" || token === "${@}" || token === "$*" || token === "${*}";
}

export function recordNpmCommandVariable(word, npmVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isNpmCommandToken(value, npmVariables)) {
    npmVariables.add(name);
  } else {
    npmVariables.delete(name);
  }
}

export function recordPackagePublishCommandVariable(word, packagePublishCommandVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isPackagePublishCommandToken(value, packagePublishCommandVariables)) {
    packagePublishCommandVariables.add(name);
  } else {
    packagePublishCommandVariables.delete(name);
  }
}

export function recordNpxCommandVariable(word, npxVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isNpxCommandToken(value, npxVariables)) {
    npxVariables.add(name);
  } else {
    npxVariables.delete(name);
  }
}

export function recordNpmPublishSubcommandVariable(word, publishSubcommandVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  const { name, value } = assignment;
  if (isNpmPublishSubcommandToken(value, publishSubcommandVariables)) {
    publishSubcommandVariables.add(name);
  } else {
    publishSubcommandVariables.delete(name);
  }
}

export function shellVariableAssignment(word) {
  const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(word);
  return assignment ? { name: assignment[1], value: assignment[2] } : null;
}

export function recordShellVariable(word, shellVariables) {
  const assignment = shellVariableAssignment(word);
  if (!assignment) return;

  shellVariables.set(assignment.name, resolveShellVariables(assignment.value, shellVariables));
}

export function resolveShellVariables(word, shellVariables) {
  let resolved = word;
  for (let depth = 0; depth < 5; depth += 1) {
    const next = resolved
      .replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-+=?]|##?|%%?)([^}]*))?\}/gu,
        (match, name, operator = "", fallback = "") =>
          resolveShellParameterExpansion(match, name, operator, fallback, shellVariables),
      )
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/gu, (match, name) =>
        shellVariables.has(name) ? shellVariables.get(name) : match,
      );
    if (next === resolved) {
      return resolved;
    }
    resolved = next;
  }

  return resolved;
}

export function hasUnsupportedShellParameterExpansion(text) {
  const parameterPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)([^}]*)\}/gu;
  for (const match of text.matchAll(parameterPattern)) {
    if (!isSupportedShellParameterExpansionSuffix(match[2])) {
      return true;
    }
  }

  return false;
}

export function isSupportedShellParameterExpansionSuffix(suffix) {
  return suffix === "" || /^(?::?[-+=?]|##?|%%?)/u.test(suffix);
}

export function resolveShellParameterExpansion(match, name, operator, fallback, shellVariables) {
  const hasValue = shellVariables.has(name);
  const value = hasValue ? shellVariables.get(name) : "";
  const isSetAndNonEmpty = hasValue && value !== "";

  if (!operator) {
    return hasValue ? value : match;
  }
  if (operator === "-") {
    return hasValue ? value : fallback;
  }
  if (operator === ":-" || operator === ":=" || operator === ":?") {
    return isSetAndNonEmpty ? value : fallback;
  }
  if (operator === "=" || operator === "?") {
    return hasValue ? value : fallback;
  }
  if (operator === "+") {
    return hasValue ? fallback : "";
  }
  if (operator === ":+") {
    return isSetAndNonEmpty ? fallback : "";
  }
  if (operator === "#" || operator === "##") {
    return hasValue ? removeShellLiteralPrefix(value, fallback) : match;
  }
  if (operator === "%" || operator === "%%") {
    return hasValue ? removeShellLiteralSuffix(value, fallback) : match;
  }

  return match;
}

export function removeShellLiteralPrefix(value, prefix) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export function removeShellLiteralSuffix(value, suffix) {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

export function shellTokens(line) {
  const tokens = [];
  let token = "";
  let quote = "";
  let escaped = false;

  const pushToken = () => {
    if (token) {
      tokens.push(token);
      token = "";
    }
  };

  const expandedLine = shellExpansionText(line);
  for (let index = 0; index < expandedLine.length; index += 1) {
    const char = expandedLine[index];

    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      token += char;
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      token += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      token += char;
      continue;
    }
    if (quote === "" && /\s/u.test(char)) {
      pushToken();
      continue;
    }
    if (quote === "" && /[;&|()]/u.test(char)) {
      pushToken();
      tokens.push(char);
      continue;
    }
    if (quote === "" && /[<>]/u.test(char)) {
      const repeated = expandedLine[index + 1] === char ? `${char}${char}` : char;
      if (repeated.length === 2) {
        index += 1;
      }
      if (/^\d+$/u.test(token)) {
        tokens.push(`${token}${repeated}`);
        token = "";
      } else {
        pushToken();
        tokens.push(repeated);
      }
      continue;
    }

    token += char;
  }

  pushToken();
  return tokens;
}

export function shellExpansionText(line) {
  return line.replace(/\$(?:\{IFS\}|IFS)\b/gu, " ");
}

export function shellCommandSubstitutionTexts(line) {
  const texts = [];
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
    if (char === "$" && line[index + 1] === "(" && quote !== "'") {
      const command = readDollarCommandSubstitution(line, index + 2);
      if (command.closed) {
        texts.push(command.value);
        index = command.endIndex;
      }
      continue;
    }
    if (char !== "`" || quote === "'") {
      continue;
    }

    const command = readBacktickCommandSubstitution(line, index + 1);
    if (command.closed) {
      texts.push(command.value);
      index = command.endIndex;
    }
  }

  return texts;
}

export function readDollarCommandSubstitution(line, startIndex) {
  let value = "";
  let quote = "";
  let escaped = false;
  let depth = 1;

  for (let index = startIndex; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      value += char;
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === "") {
      quote = char;
      value += char;
      continue;
    }
    if (char === quote) {
      quote = "";
      value += char;
      continue;
    }
    if (quote === "" && char === "$" && line[index + 1] === "(") {
      depth += 1;
      value += "$(";
      index += 1;
      continue;
    }
    if (quote === "" && char === ")") {
      depth -= 1;
      if (depth === 0) {
        return { value, endIndex: index, closed: true };
      }
    }
    value += char;
  }

  return { value, endIndex: line.length - 1, closed: false };
}

export function readBacktickCommandSubstitution(line, startIndex) {
  let value = "";
  let escaped = false;

  for (let index = startIndex; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "`") {
      return { value, endIndex: index, closed: true };
    }
    value += char;
  }

  return { value, endIndex: line.length - 1, closed: false };
}

export function countEvalWrappedPublishCommands(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (command !== "eval") return 0;

  const scriptText = shellEvalArgument(tokens, index + 1, shellVariables);
  return scriptText ? countNpmPublishCommandsInShellText(scriptText) : 0;
}

export function shellEvalArgument(tokens, startIndex, shellVariables) {
  const parts = [];
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    parts.push(token);
  }

  return parts.join(" ").trim();
}

export function countInterpreterWrappedPublishCommands(tokens, index, shellVariables) {
  const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
  if (!isShellInterpreterCommand(command)) return 0;

  let publishCommandCount = 0;
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
    publishCommandCount += countInterpreterEvalPublishCommands(command, scriptText);
    break;
  }

  return publishCommandCount;
}

export function textUsesNonShellInterpreterEval(text) {
  return shellScanTexts(text).some((commandText) => shellTextUsesNonShellInterpreterEval(commandText));
}

export function textUsesAwkSystemExecution(text) {
  return shellScanTexts(text).some((commandText) => shellTextUsesAwkSystemExecution(commandText));
}

export function shellTextUsesAwkSystemExecution(text) {
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => {
      const tokens = shellTokens(line);
      for (let index = 0; index < tokens.length; index += 1) {
        const command = shellCommandBasename(shellWordValue(tokens[index]));
        if (!["awk", "gawk", "mawk", "nawk"].includes(command)) continue;

        for (let argumentIndex = index + 1; argumentIndex < tokens.length; argumentIndex += 1) {
          const token = shellWordValue(tokens[argumentIndex]);
          if (isShellBoundaryToken(token)) break;
          if (isShellRedirectionToken(token)) {
            argumentIndex += 1;
            continue;
          }
          if (/\bsystem\s*\(/u.test(token)) {
            return true;
          }
        }
      }

      return false;
    });
}

export function shellCommandBasename(command) {
  return command.replace(/\\/gu, "/").split("/").pop() ?? "";
}

export function shellTextUsesNonShellInterpreterEval(text) {
  const shellVariables = new Map();
  return shellContinuationText(shellCommentText(text))
    .split("\n")
    .some((line) => {
      const tokens = shellTokens(line);
      for (let index = 0; index < tokens.length; index += 1) {
        const command = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
        recordShellVariable(command, shellVariables);
        if (!isFileArgumentInterpreterToken(command) || isShellInterpreterCommand(command)) continue;
        if (interpreterCommandHasEvalSnippet(command, tokens, index + 1, shellVariables)) {
          return true;
        }
      }

      return false;
    });
}

export function interpreterCommandHasEvalSnippet(command, tokens, startIndex, shellVariables) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) return false;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    if (isInterpreterEvalOption(command, token)) {
      return true;
    }
    if (token === "--") {
      continue;
    }
    if (token.startsWith("-")) {
      if (interpreterFileOptionConsumesValue(token)) {
        index += 1;
      }
      continue;
    }
    return false;
  }

  return false;
}

export function isShellInterpreterCommand(command) {
  return ["node", "bash", "sh"].includes(command.replace(/\\/gu, "/").split("/").pop() ?? "");
}

export function isInterpreterEvalOption(command, option) {
  const basename = command.replace(/\\/gu, "/").split("/").pop() ?? "";
  if (basename === "node") {
    return option === "-e" || option === "--eval" || option === "-p" || option === "--print";
  }
  if (basename === "bash" || basename === "sh" || basename === "python" || basename === "python3") {
    return option === "-c";
  }
  if (basename === "perl" || basename === "ruby") {
    return option === "-e";
  }
  if (basename === "php") {
    return option === "-r";
  }
  if (basename === "bun") {
    return option === "-e" || option === "--eval";
  }

  return false;
}

export function interpreterEvalArgument(tokens, startIndex, shellVariables) {
  const parts = [];
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = resolveShellVariables(shellWordValue(tokens[index]), shellVariables);
    if (isShellBoundaryToken(token)) break;
    if (isShellRedirectionToken(token)) {
      index += 1;
      continue;
    }
    parts.push(token);
  }

  return parts.join(" ").trim();
}

export function countInterpreterEvalPublishCommands(command, scriptText) {
  const basename = command.replace(/\\/gu, "/").split("/").pop() ?? "";
  if (basename === "node") {
    return countJavaScriptStringPublishCommands(scriptText);
  }

  return countNpmPublishCommandsInShellText(scriptText);
}
