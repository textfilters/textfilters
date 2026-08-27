import { maskUtf16Ranges, type TextRange } from "@textfilters/core";

import { compileDictionaries } from "./compile.js";
import {
  findDictionaryMatches,
  hasAcceptedDeny,
  type InternalProfanityMatch,
} from "./match.js";
import { normalizeSource } from "./normalize.js";
import {
  PROFANITY_FILTER_NAME,
  type ProfanityDictionary,
  type ProfanityFilter,
  type ProfanityMatch,
} from "./types.js";

export function createProfanityFilter(
  ...dictionaries: readonly ProfanityDictionary[]
): ProfanityFilter {
  const compiled = compileDictionaries(dictionaries);

  const filter: ProfanityFilter = {
    name: PROFANITY_FILTER_NAME,

    check(text) {
      const source = requireText(text);
      if (source === "") return false;

      const normalized = normalizeSource(source);
      return compiled.some((dictionary) =>
        hasAcceptedDeny(normalized, dictionary),
      );
    },

    find(text) {
      const source = requireText(text);
      if (source === "") return [];
      return toPublicMatches(source, scan(source));
    },

    censor(text, mask) {
      const source = requireText(text);
      if (source === "") return source;
      return maskUtf16Ranges(source, toRanges(scan(source)), mask);
    },

    process(text, mask) {
      const source = requireText(text);
      const internal = source === "" ? [] : scan(source);
      const matches = toPublicMatches(source, internal);
      return {
        censored: maskUtf16Ranges(source, toRanges(internal), mask),
        matches,
      };
    },
  };

  function scan(source: string): readonly InternalProfanityMatch[] {
    const normalized = normalizeSource(source);
    const candidates = compiled.flatMap((dictionary) =>
      findDictionaryMatches(normalized, dictionary),
    );
    candidates.sort(compareInternalMatches);

    const selected: InternalProfanityMatch[] = [];
    let coveredUntil = -1;
    for (const candidate of candidates) {
      if (candidate.start < coveredUntil) continue;
      selected.push(candidate);
      coveredUntil = candidate.end;
    }
    return selected;
  }

  return Object.freeze(filter);
}

function requireText(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  return text;
}

function toPublicMatches(
  source: string,
  matches: readonly InternalProfanityMatch[],
): readonly ProfanityMatch[] {
  return matches.map(({ start, end, dictionary, term }) => ({
    start,
    end,
    value: source.slice(start, end),
    filter: PROFANITY_FILTER_NAME,
    data: Object.freeze({ dictionary, term }),
  }));
}

function toRanges(
  matches: readonly Pick<InternalProfanityMatch, "start" | "end">[],
): readonly TextRange[] {
  return matches.map(({ start, end }) => [start, end]);
}

function compareInternalMatches(
  left: InternalProfanityMatch,
  right: InternalProfanityMatch,
): number {
  return (
    left.start - right.start ||
    right.end - left.end ||
    left.dictionaryOrder - right.dictionaryOrder ||
    compareStrings(left.term, right.term)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
