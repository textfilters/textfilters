import type { TextFilter, TextMatch, TextRange } from "./contracts.js";
import { maskTextRanges } from "./mask.js";

export function combineFilters(...filters: readonly TextFilter[]): TextFilter {
  const children = Object.freeze([...filters]);

  const collectMatches = (text: string): readonly TextMatch[] =>
    children.flatMap((filter) => [...filter.find(text)]).sort(compareMatches);

  const combined: TextFilter = {
    name: "combined",

    check(text) {
      const source = requireText(text);
      return children.some((filter) => filter.check(source));
    },

    find(text) {
      return collectMatches(requireText(text));
    },

    censor(text, mask) {
      const source = requireText(text);
      return maskTextRanges(source, toRanges(collectMatches(source)), mask);
    },

    process(text, mask) {
      const source = requireText(text);
      const matches = collectMatches(source);
      return {
        censored: maskTextRanges(source, toRanges(matches), mask),
        matches,
      };
    },
  };

  return Object.freeze(combined);
}

function toRanges(matches: readonly TextMatch[]): readonly TextRange[] {
  return matches.map(({ start, end }) => [start, end]);
}

function compareMatches(left: TextMatch, right: TextMatch): number {
  return (
    left.start - right.start ||
    left.end - right.end ||
    compareStrings(left.filter, right.filter)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireText(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  return text;
}
