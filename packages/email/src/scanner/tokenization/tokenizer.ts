import {
  isAsciiLetter,
  isWhitespace,
  type EmailTextMeta,
} from "../../normalization.js";
import { TOKEN_TYPE, TOKEN_VALUE, type Token } from "../core/types.js";
import { isWordChar } from "../rules/validators.js";

const readWrappedSeparator = (
  meta: EmailTextMeta,
  start: number,
): Token | null => {
  const open = meta.normalized[start];
  const close =
    open === "[" ? "]" : open === "(" ? ")" : open === "{" ? "}" : "";
  if (!close) return null;

  let cursor = start + 1;
  while (
    cursor < meta.normalized.length &&
    isWhitespace(meta.normalized[cursor])
  ) {
    cursor++;
  }

  const tokenStart = cursor;
  while (
    cursor < meta.normalized.length &&
    (isAsciiLetter(meta.normalized[cursor]) ||
      meta.normalized[cursor] === TOKEN_VALUE.atSymbol ||
      meta.normalized[cursor] === TOKEN_VALUE.dotSymbol)
  ) {
    cursor++;
  }
  const value = meta.normalized.slice(tokenStart, cursor).join("");

  while (
    cursor < meta.normalized.length &&
    isWhitespace(meta.normalized[cursor])
  ) {
    cursor++;
  }

  if (meta.normalized[cursor] !== close) return null;
  if (value === TOKEN_VALUE.atWord || value === TOKEN_VALUE.atSymbol) {
    return {
      type: TOKEN_TYPE.at,
      value,
      start,
      end: cursor + 1,
      wrapped: true,
    };
  }
  if (value === TOKEN_VALUE.dotWord || value === TOKEN_VALUE.dotSymbol) {
    return {
      type: TOKEN_TYPE.dot,
      value,
      start,
      end: cursor + 1,
      wrapped: true,
    };
  }
  return null;
};

export const tokenize = (meta: EmailTextMeta): readonly Token[] => {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < meta.normalized.length) {
    const current = meta.normalized[cursor];
    if (meta.zeroWidth[cursor] || isWhitespace(current)) {
      cursor++;
      continue;
    }

    // Bracketed spellings like "[at]" and "( dot )" should participate in
    // the same token stream as plain "at"/"dot" without keeping the brackets
    // as local/domain content.
    const wrapped = readWrappedSeparator(meta, cursor);
    if (wrapped) {
      tokens.push(wrapped);
      cursor = wrapped.end;
      continue;
    }

    if (current === TOKEN_VALUE.atSymbol) {
      tokens.push({
        type: TOKEN_TYPE.at,
        value: current,
        start: cursor,
        end: cursor + 1,
        wrapped: false,
      });
      cursor++;
      continue;
    }
    if (current === TOKEN_VALUE.dotSymbol) {
      tokens.push({
        type: TOKEN_TYPE.dot,
        value: current,
        start: cursor,
        end: cursor + 1,
        wrapped: false,
      });
      cursor++;
      continue;
    }

    if (isWordChar(current)) {
      const start = cursor;
      let value = "";
      while (
        cursor < meta.normalized.length &&
        isWordChar(meta.normalized[cursor])
      ) {
        value += meta.normalized[cursor];
        cursor++;
      }
      const type =
        value === TOKEN_VALUE.atWord
          ? TOKEN_TYPE.at
          : value === TOKEN_VALUE.dotWord
            ? TOKEN_TYPE.dot
            : TOKEN_TYPE.word;
      tokens.push({ type, value, start, end: cursor, wrapped: false });
      continue;
    }

    cursor++;
  }

  return tokens;
};
