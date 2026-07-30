import { type TextCodePointRange } from "@textfilters/core";

import { type EmailTextMeta } from "../../normalization.js";
import { isBareAtProsePhrase } from "../context/bare-at-policy.js";
import { TOKEN_TYPE, type ScannerOptions } from "../core/types.js";
import { isValidLocal } from "../rules/validators.js";
import { tokenize } from "../tokenization/tokenizer.js";
import { isCandidateExcluded, isCandidateMatchable } from "./candidate.js";

export interface EmailRangeCursor {
  next(): TextCodePointRange | null;
}

export const collectObfuscatedEmailRanges = (
  meta: EmailTextMeta,
  options: ScannerOptions,
): readonly TextCodePointRange[] => {
  const ranges: TextCodePointRange[] = [];

  collectObfuscatedEmailRangeMatches(meta, options, (range) => {
    ranges.push(range);
  });

  return ranges;
};

export const collectObfuscatedEmailRangeMatches = (
  meta: EmailTextMeta,
  options: ScannerOptions,
  visit: (range: TextCodePointRange) => boolean | void,
): boolean => {
  const cursor = createObfuscatedEmailRangeCursor(meta, options);

  for (let range = cursor.next(); range !== null; range = cursor.next()) {
    if (visit(range) === false) return false;
  }

  return true;
};

export const createObfuscatedEmailRangeCursor = (
  meta: EmailTextMeta,
  options: ScannerOptions,
): EmailRangeCursor => {
  const tokens = tokenize(meta);
  const acceptedListLocalIndexes = new Set<number>();
  let index = 0;

  return {
    next() {
      for (; index < tokens.length - 2; index++) {
        const localIndex = index;
        const local = tokens[localIndex];
        const at = tokens[localIndex + 1];
        if (local.type !== TOKEN_TYPE.word || at.type !== TOKEN_TYPE.at) {
          continue;
        }
        if (local.value.length < 3) continue;
        if (!isValidLocal(local.value)) continue;

        const labels: string[] = [];
        let cursor = localIndex + 2;
        if (tokens[cursor]?.type !== TOKEN_TYPE.word) continue;
        labels.push(tokens[cursor].value);
        cursor++;

        while (
          tokens[cursor]?.type === TOKEN_TYPE.dot &&
          tokens[cursor + 1]?.type === TOKEN_TYPE.word
        ) {
          labels.push(tokens[cursor + 1].value);
          cursor += 2;
        }

        if (
          isBareAtProsePhrase(
            meta,
            tokens,
            localIndex,
            local,
            at,
            options,
            acceptedListLocalIndexes,
          )
        ) {
          continue;
        }

        const endToken = tokens[cursor - 1];
        const candidate = {
          kind: "obfuscated",
          local: local.value,
          labels,
          start: local.start,
          end: endToken.end,
        } as const;
        if (!isCandidateMatchable(meta, candidate, options)) continue;

        acceptedListLocalIndexes.add(localIndex);
        if (isCandidateExcluded(candidate, options)) {
          index = cursor - 1;
          continue;
        }

        index = cursor;
        return [candidate.start, candidate.end];
      }

      return null;
    },
  };
};
