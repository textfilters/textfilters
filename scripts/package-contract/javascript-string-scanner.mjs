import { shellWordValue } from "./local-workflow-scanner.mjs";
import { countNpmPublishCommandsInShellText } from "./shell-publish-counter.mjs";
import { CHILD_PROCESS_EXECUTION_METHOD_PATTERN, NPM_PUBLISH_SUBCOMMANDS, UNKNOWN_GITHUB_ACTIONS_EXPRESSION } from "./state.mjs";

export function countJavaScriptEmbeddedPublishCommands(text) {
  if (!CHILD_PROCESS_EXECUTION_METHOD_PATTERN.test(text)) {
    return 0;
  }

  return countJavaScriptStringPublishCommands(text);
}

export function countJavaScriptStringPublishCommands(text) {
  return javascriptStringTexts(text).reduce(
    (count, stringText) => count + countNpmPublishCommandsInShellText(stringText),
    0,
  );
}

export function javascriptStringTexts(text) {
  const strings = [];
  for (let index = 0; index < text.length; index += 1) {
    const quote = text[index];
    if (quote !== "'" && quote !== "\"" && quote !== "`") continue;

    const string = readJavaScriptString(text, index + 1, quote);
    if (string.closed) {
      strings.push(string.value);
      index = string.endIndex;
    }
  }

  return strings;
}

export function javascriptConcatenatedStringTexts(text) {
  const strings = [];
  for (let index = 0; index < text.length; index += 1) {
    const string = readJavaScriptStringConcatAt(text, index);
    if (!string.closed || string.parts < 2) continue;

    strings.push(string.value);
    index = string.endIndex;
  }

  return strings;
}

export function javascriptJoinedStringTexts(text) {
  const values = [];
  const joinPattern = /\[\s*([\s\S]{0,240}?)\]\s*\.join\s*\(\s*([`"'])([\s\S]*?)\2\s*\)/gu;
  for (const match of text.matchAll(joinPattern)) {
    const parts = javascriptStringTexts(match[1]);
    if (parts.length > 0) {
      values.push(parts.join(match[3]));
    }
  }

  return values;
}

export function javascriptStaticTemplateTexts(text) {
  const strings = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "`") continue;

    const template = readJavaScriptRawTemplateAt(text, index + 1);
    if (!template.closed) continue;
    if (template.value.includes("${")) {
      const value = staticJavaScriptTemplateValue(template.value);
      if (value) strings.push(value);
    }
    index = template.endIndex;
  }

  return strings;
}

export function readJavaScriptStaticStringAt(text, startIndex) {
  const index = skipJavaScriptWhitespace(text, startIndex);
  if (text[index] === "`") {
    const template = readJavaScriptRawTemplateAt(text, index + 1);
    if (template.closed && template.value.includes("${")) {
      const value = staticJavaScriptTemplateValue(template.value);
      return { value, endIndex: template.endIndex, parts: value ? 1 : 0, closed: Boolean(value) };
    }
  }

  return readJavaScriptStringConcatAt(text, startIndex);
}

export function readJavaScriptRawTemplateAt(text, startIndex) {
  let rawValue = "";
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      rawValue += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "`") {
      return { value: rawValue, endIndex: index, closed: true };
    }
    rawValue += char;
  }

  return { value: rawValue, endIndex: text.length - 1, closed: false };
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
    if (!string.closed || skipJavaScriptWhitespace(expression, string.endIndex + 1) < expression.length) {
      return "";
    }

    value += string.value;
    index = endIndex;
  }

  return decodeJavaScriptString(value);
}

export function readJavaScriptStringConcatAt(text, startIndex) {
  let index = skipJavaScriptWhitespace(text, startIndex);
  let value = "";
  let endIndex = index;
  let parts = 0;

  while (index < text.length) {
    const quote = text[index];
    if (quote !== "'" && quote !== "\"" && quote !== "`") {
      return { value, endIndex, parts, closed: parts > 0 };
    }

    const string = readJavaScriptString(text, index + 1, quote);
    if (!string.closed) {
      return { value, endIndex: string.endIndex, parts, closed: false };
    }

    value += string.value;
    parts += 1;
    endIndex = string.endIndex;
    index = skipJavaScriptWhitespace(text, string.endIndex + 1);
    if (text[index] !== "+") {
      return { value, endIndex, parts, closed: true };
    }
    index = skipJavaScriptWhitespace(text, index + 1);
  }

  return { value, endIndex, parts, closed: parts > 0 };
}

export function skipJavaScriptWhitespace(text, index) {
  let currentIndex = index;
  while (/\s/u.test(text[currentIndex] ?? "")) {
    currentIndex += 1;
  }
  return currentIndex;
}

export function readJavaScriptString(text, startIndex, quote) {
  let rawValue = "";
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      rawValue += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return { value: decodeJavaScriptString(rawValue), endIndex: index, closed: true };
    }
    rawValue += char;
  }

  return { value: rawValue, endIndex: text.length - 1, closed: false };
}

export function decodeJavaScriptString(value) {
  let decoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      decoded += char;
      continue;
    }

    const escaped = value[index + 1] ?? "";
    if (escaped === "x" && /^[0-9a-fA-F]{2}$/u.test(value.slice(index + 2, index + 4))) {
      decoded += String.fromCodePoint(Number.parseInt(value.slice(index + 2, index + 4), 16));
      index += 3;
      continue;
    }
    if (escaped === "u" && value[index + 2] === "{") {
      const endIndex = value.indexOf("}", index + 3);
      const codePoint = endIndex === -1 ? "" : value.slice(index + 3, endIndex);
      if (/^[0-9a-fA-F]+$/u.test(codePoint)) {
        decoded += String.fromCodePoint(Number.parseInt(codePoint, 16));
        index = endIndex;
        continue;
      }
    }
    if (escaped === "u" && /^[0-9a-fA-F]{4}$/u.test(value.slice(index + 2, index + 6))) {
      decoded += String.fromCodePoint(Number.parseInt(value.slice(index + 2, index + 6), 16));
      index += 5;
      continue;
    }

    const escapes = {
      "0": "\0",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
    };
    decoded += escapes[escaped] ?? escaped;
    index += 1;
  }

  return decoded;
}

export function isShellBoundaryToken(token) {
  return token === ";" || token === "&" || token === "|";
}

export function isShellRedirectionToken(token) {
  return /^\d*(?:<|>|<<|>>)$/u.test(token);
}

export function isShellInputRedirectionToken(token) {
  return /^\d*<$/u.test(token);
}

export function isShellOutputRedirectionToken(token) {
  return /^\d*(?:>|>>)$/u.test(token);
}

export function isNpmCommandToken(token, npmVariables = new Set()) {
  const normalizedToken = token.replace(/\\/gu, "/");
  return (
    /(?:^|\/)(?:npm|pnpm)$/u.test(normalizedToken) ||
    npmVariables.has(shellVariableReferenceName(token))
  );
}

export function isPackagePublishCommandToken(token, packagePublishCommandVariables = new Set()) {
  const normalizedToken = token.replace(/\\/gu, "/");
  return (
    /(?:^|\/)(?:npm|pnpm|yarn)$/u.test(normalizedToken) ||
    packagePublishCommandVariables.has(shellVariableReferenceName(token))
  );
}

export function isPotentialPackagePublishCommandToken(rawToken, resolvedWord, shellVariables) {
  if (resolvedWord.includes(UNKNOWN_GITHUB_ACTIONS_EXPRESSION)) return true;

  const variableName = shellVariableReferenceName(shellWordValue(rawToken));
  if (!variableName) return false;

  return !shellVariables.has(variableName) || resolvedWord === "";
}

export function isPotentialNpmPublishSubcommandToken(rawToken, resolvedWord, shellVariables) {
  if (resolvedWord.includes(UNKNOWN_GITHUB_ACTIONS_EXPRESSION)) return true;

  const variableName = shellVariableReferenceName(shellWordValue(rawToken));
  if (!variableName) return false;

  return !shellVariables.has(variableName) || resolvedWord === "";
}

export function isNpxCommandToken(token, npxVariables = new Set()) {
  return (
    /(?:^|\/)npx$/u.test(token.replace(/\\/gu, "/")) ||
    npxVariables.has(shellVariableReferenceName(token))
  );
}

export function isNpmPublishSubcommandToken(token, publishSubcommandVariables = new Set()) {
  return (
    NPM_PUBLISH_SUBCOMMANDS.has(token) ||
    publishSubcommandVariables.has(shellVariableReferenceName(token))
  );
}

export function shellVariableReferenceName(token) {
  const braced = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/u.exec(token);
  if (braced) return braced[1];

  const plain = /^\$([A-Za-z_][A-Za-z0-9_]*)$/u.exec(token);
  return plain ? plain[1] : "";
}
