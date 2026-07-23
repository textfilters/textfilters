import { mergeRanges, normalizeTextInput } from "@textfilters/core";
import type {
  ProfanityCategory,
  ProfanityFilter,
  ProfanityMatchOptions,
  ProfanityMatchRange,
  ProfanitySeverity,
  ProfanityTermList,
} from "../../types.js";

import {
  createPreparedProfanityInput,
  createProfanityFilterFromDictionary,
  normalizedTextForPreparedProfanityInput,
  registerProfanityMatchStreamer,
  registerProfanityPreparedAnalyzer,
  streamPreparedProfanityMatches,
  type PreparedProfanityInput,
} from "../../filter.js";
import { normalizeLiteralTerm } from "../../matchers/literals.js";
import { normalizeForMatchSameLenWithoutHomoglyphs } from "../../normalization/text.js";
import { createReviewedEnglishProfanityDictionary } from "./dictionary.js";

const DOMAIN_CHAR_RE = /[\p{L}\p{N}.-]/u;
const DOMAIN_LABEL_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
const EMAIL_LOCAL_PART_CHAR_RE = /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]/u;
const EMAIL_LOCAL_PART_ATOM_RE = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+$/u;
const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}_-]/u;
const URL_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*$/u;
const SEVERITY_RANK: Record<ProfanitySeverity, number> = {
  soft: 0,
  low: 1,
  medium: 2,
  high: 3,
};

interface RuntimeLiteralRecord {
  readonly mode: "strict" | "loose";
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}

const maintainedRuleIds = new Set<string>(
  createReviewedEnglishProfanityDictionary().rules.map((rule) => rule.id),
);

export const createEnglishProfanityFilter = (): ProfanityFilter => {
  const baseFilter = createProfanityFilterFromDictionary(
    createReviewedEnglishProfanityDictionary(),
  );
  const runtimeStrict = new Map<string, RuntimeLiteralRecord>();
  const runtimeLoose = new Map<string, RuntimeLiteralRecord>();

  const streamPreparedMatches = (
    input: PreparedProfanityInput,
    options: ProfanityMatchOptions | undefined,
    visit: (match: ProfanityMatchRange) => boolean | void,
  ): boolean => {
    const strictSnapshot = new Map(runtimeStrict);
    const looseSnapshot = new Map(runtimeLoose);
    const completed = streamPreparedProfanityMatches(
      baseFilter,
      input,
      undefined,
      (match) => {
        const normalized = normalizedTextForPreparedProfanityInput(
          input,
          "latin-preserving",
          normalizeForMatchSameLenWithoutHomoglyphs,
        );
        const selected = selectEnglishMatch(
          normalized,
          match,
          options,
          strictSnapshot,
          looseSnapshot,
        );
        return selected === undefined ? true : visit(selected);
      },
    );

    if (completed === undefined) {
      throw new TypeError(
        "The English profanity filter cannot stream matches.",
      );
    }

    return completed;
  };

  const analyzePrepared = (
    input: PreparedProfanityInput,
    options?: ProfanityMatchOptions,
  ): ProfanityMatchRange[] => {
    const matches: ProfanityMatchRange[] = [];
    streamPreparedMatches(input, options, (match) => {
      matches.push(match);
    });
    return matches;
  };

  const analyze = (
    text: unknown,
    options?: ProfanityMatchOptions,
  ): ProfanityMatchRange[] =>
    analyzePrepared(
      createPreparedProfanityInput(normalizeTextInput(text)),
      options,
    );

  const filter: ProfanityFilter = {
    name: baseFilter.name,
    analyze,
    check: (text, options) => {
      let found = false;
      streamPreparedMatches(
        createPreparedProfanityInput(normalizeTextInput(text)),
        options,
        () => {
          found = true;
          return false;
        },
      );
      return found;
    },
    censor: (text, options) => {
      const source = normalizeTextInput(text);
      const input = createPreparedProfanityInput(source);
      return maskUtf16Ranges(source, analyzePrepared(input, options));
    },
    setStrict: (list) => {
      baseFilter.setStrict(list);
      replaceRuntimeLiterals(runtimeStrict, list, "strict");
    },
    setLoose: (list) => {
      baseFilter.setLoose(list);
      replaceRuntimeLiterals(runtimeLoose, list, "loose");
    },
    addStrict: (term) => {
      baseFilter.addStrict(term);
      addRuntimeLiteral(runtimeStrict, term, "strict");
    },
    addLoose: (term) => {
      baseFilter.addLoose(term);
      addRuntimeLiteral(runtimeLoose, term, "loose");
    },
  };

  registerProfanityMatchStreamer(filter, (input, options, visit) =>
    streamPreparedMatches(input, options, visit),
  );
  registerProfanityPreparedAnalyzer(filter, analyzePrepared);

  return filter;
};

const selectEnglishMatch = (
  normalized: string,
  match: ProfanityMatchRange,
  options: ProfanityMatchOptions | undefined,
  runtimeStrict: ReadonlyMap<string, RuntimeLiteralRecord>,
  runtimeLoose: ReadonlyMap<string, RuntimeLiteralRecord>,
): ProfanityMatchRange | undefined => {
  if (!isMaintainedRuleMatch(match)) {
    return matchesTaxonomy(match, options) ? match : undefined;
  }

  const candidates: ProfanityMatchRange[] = [];
  if (!hasExcludedMaintainedContext(normalized, match)) {
    candidates.push(match);
  }

  const key = normalized.slice(match[0], match[1]).toLowerCase();
  const runtimeRecord = runtimeStrict.get(key) ?? runtimeLoose.get(key);
  if (runtimeRecord !== undefined) {
    candidates.push(runtimeMatchFor(match, runtimeRecord));
  }

  return candidates.find((candidate) => matchesTaxonomy(candidate, options));
};

const replaceRuntimeLiterals = (
  target: Map<string, RuntimeLiteralRecord>,
  terms: ProfanityTermList,
  mode: RuntimeLiteralRecord["mode"],
): void => {
  target.clear();
  if (!Array.isArray(terms)) {
    return;
  }

  for (const term of terms) {
    addRuntimeLiteral(target, term, mode);
  }
};

const addRuntimeLiteral = (
  target: Map<string, RuntimeLiteralRecord>,
  term: unknown,
  mode: RuntimeLiteralRecord["mode"],
): void => {
  const source = runtimeLiteralSource(term);
  if (source === null) {
    return;
  }

  const key = normalizeLiteralTerm(
    source,
    normalizeForMatchSameLenWithoutHomoglyphs,
  ).toLowerCase();
  if (!target.has(key)) {
    target.set(key, runtimeLiteralRecord(term, mode));
  }
};

const runtimeLiteralRecord = (
  term: unknown,
  mode: RuntimeLiteralRecord["mode"],
): RuntimeLiteralRecord => {
  if (
    typeof term !== "object" ||
    term === null ||
    !("source" in term) ||
    typeof term.source !== "string" ||
    term.source.trim().length === 0
  ) {
    return { mode };
  }

  const category =
    "category" in term
      ? (term.category as ProfanityCategory | undefined)
      : undefined;
  const severity =
    "severity" in term
      ? (term.severity as ProfanitySeverity | undefined)
      : undefined;
  return {
    mode,
    ...(category === undefined ? {} : { category }),
    ...(severity === undefined ? {} : { severity }),
  };
};

const runtimeMatchFor = (
  match: ProfanityMatchRange,
  record: RuntimeLiteralRecord,
): ProfanityMatchRange =>
  Object.assign([match[0], match[1]] as [number, number], {
    mode: record.mode,
    ...(record.category === undefined ? {} : { category: record.category }),
    ...(record.severity === undefined ? {} : { severity: record.severity }),
  });

const matchesTaxonomy = (
  match: ProfanityMatchRange,
  options: ProfanityMatchOptions | undefined,
): boolean =>
  (options?.categories === undefined ||
    (match.category !== undefined &&
      options.categories.includes(match.category))) &&
  (options?.severities === undefined ||
    (match.severity !== undefined &&
      options.severities.includes(match.severity))) &&
  (options?.minSeverity === undefined ||
    (match.severity !== undefined &&
      SEVERITY_RANK[match.severity] >= SEVERITY_RANK[options.minSeverity]));

const runtimeLiteralSource = (term: unknown): string | null => {
  const source =
    typeof term === "object" &&
    term !== null &&
    "source" in term &&
    typeof term.source === "string"
      ? term.source
      : String(term ?? "");
  const trimmed = source.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const maskUtf16Ranges = (
  source: string,
  ranges: readonly ProfanityMatchRange[],
): string => {
  let cursor = 0;
  const parts: string[] = [];

  for (const [start, end] of mergeRanges(ranges)) {
    parts.push(source.slice(cursor, start), "*".repeat(end - start));
    cursor = end;
  }

  parts.push(source.slice(cursor));
  return parts.join("");
};

const isMaintainedRuleMatch = (match: ProfanityMatchRange): boolean =>
  match.ruleId !== undefined && maintainedRuleIds.has(match.ruleId);

const hasExcludedMaintainedContext = (
  normalized: string,
  [start, end]: ProfanityMatchRange,
): boolean =>
  isStandaloneMention(normalized, start, end) ||
  isInsideMultiLabelDomain(normalized, start) ||
  isWithinEmailLocalPart(normalized, start, end);

const isStandaloneMention = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  const atIndex = start - 1;
  if (atIndex < 0 || normalized[atIndex] !== "@") {
    return false;
  }

  if (atIndex > 0) {
    const previousStart = previousCodePointStart(normalized, atIndex);
    const previous = normalized.slice(previousStart, atIndex);
    if (previous === "@" || WORD_CHAR_RE.test(previous)) {
      return false;
    }
  }

  let usernameEnd = end;
  while (usernameEnd < normalized.length) {
    const charEnd = nextCodePointEnd(normalized, usernameEnd);
    if (!WORD_CHAR_RE.test(normalized.slice(usernameEnd, charEnd))) {
      break;
    }
    usernameEnd = charEnd;
  }

  return normalized[usernameEnd] !== "@";
};

const isWithinEmailLocalPart = (
  normalized: string,
  matchStart: number,
  matchEnd: number,
): boolean => {
  let start = matchStart;
  while (start > 0) {
    const previousStart = previousCodePointStart(normalized, start);
    if (
      !EMAIL_LOCAL_PART_CHAR_RE.test(normalized.slice(previousStart, start))
    ) {
      break;
    }
    start = previousStart;
  }

  let position = matchEnd;

  while (position < normalized.length) {
    const charEnd = nextCodePointEnd(normalized, position);
    if (!EMAIL_LOCAL_PART_CHAR_RE.test(normalized.slice(position, charEnd))) {
      break;
    }
    position = charEnd;
  }

  if (normalized[position] !== "@") {
    return false;
  }

  const localPart = normalized.slice(start, position);
  return (
    hasEmailLocalPartBoundary(normalized, start) &&
    isValidDotAtomLocalPart(localPart) &&
    isMultiLabelDomainAt(normalized, position + 1)
  );
};

const hasEmailLocalPartBoundary = (
  normalized: string,
  start: number,
): boolean =>
  start === 0 ||
  normalized.slice(previousCodePointStart(normalized, start), start) !== "@";

const isValidDotAtomLocalPart = (candidate: string): boolean =>
  candidate.length <= 64 &&
  candidate
    .split(".")
    .every((atom) => atom.length > 0 && EMAIL_LOCAL_PART_ATOM_RE.test(atom));

const isInsideMultiLabelDomain = (
  normalized: string,
  position: number,
): boolean => {
  let start = position;
  while (start > 0) {
    const previousStart = previousCodePointStart(normalized, start);
    if (!DOMAIN_CHAR_RE.test(normalized.slice(previousStart, start))) {
      break;
    }
    start = previousStart;
  }

  return isMultiLabelDomainAt(normalized, start, true);
};

const isMultiLabelDomainAt = (
  normalized: string,
  start: number,
  trimLeadingPunctuation = false,
): boolean => {
  let end = start;
  while (end < normalized.length) {
    const charEnd = nextCodePointEnd(normalized, end);
    if (!DOMAIN_CHAR_RE.test(normalized.slice(end, charEnd))) {
      break;
    }
    end = charEnd;
  }

  if (
    start === end ||
    normalized[end] === "@" ||
    !hasValidDomainStartContext(normalized, start) ||
    hasWordContinuation(normalized, start, end) ||
    !isValidMultiLabelDomain(
      normalized.slice(start, end),
      trimLeadingPunctuation,
    )
  ) {
    return false;
  }

  return true;
};

const hasValidDomainStartContext = (
  normalized: string,
  start: number,
): boolean => {
  if (start === 0) {
    return true;
  }

  const previousStart = previousCodePointStart(normalized, start);
  const previous = normalized.slice(previousStart, start);
  if (previous === "/") {
    return normalized[start] !== "." && isUrlAuthorityStart(normalized, start);
  }
  if (previous === "\\") {
    return false;
  }
  if (previous !== "@") {
    return !hasPathSeparatorInCurrentToken(normalized, start);
  }

  if (normalized[start] === ".") {
    return false;
  }

  let localStart = previousStart;
  while (localStart > 0) {
    const charStart = previousCodePointStart(normalized, localStart);
    if (
      !EMAIL_LOCAL_PART_CHAR_RE.test(normalized.slice(charStart, localStart))
    ) {
      break;
    }
    localStart = charStart;
  }

  return (
    hasEmailLocalPartBoundary(normalized, localStart) &&
    isValidDotAtomLocalPart(normalized.slice(localStart, previousStart))
  );
};

const hasPathSeparatorInCurrentToken = (
  normalized: string,
  start: number,
): boolean => {
  let position = start;
  while (position > 0) {
    const charStart = previousCodePointStart(normalized, position);
    const char = normalized.slice(charStart, position);
    if (/\s/u.test(char)) {
      return false;
    }
    if (char === "?" || char === "#" || char === "=") {
      return false;
    }
    if (char === "/" || char === "\\") {
      return true;
    }
    position = charStart;
  }
  return false;
};

const isUrlAuthorityStart = (normalized: string, start: number): boolean => {
  const firstSlash = start - 2;
  if (firstSlash < 0 || normalized[firstSlash] !== "/") {
    return false;
  }
  if (firstSlash === 0) {
    return true;
  }

  const prefixStart = previousCodePointStart(normalized, firstSlash);
  const prefix = normalized.slice(prefixStart, firstSlash);
  if (prefix === ":") {
    let schemeStart = prefixStart;
    while (schemeStart > 0) {
      const charStart = previousCodePointStart(normalized, schemeStart);
      if (!/[A-Za-z0-9+.-]/u.test(normalized.slice(charStart, schemeStart))) {
        break;
      }
      schemeStart = charStart;
    }
    return URL_SCHEME_RE.test(normalized.slice(schemeStart, prefixStart));
  }

  return prefix !== "/" && prefix !== "\\" && !WORD_CHAR_RE.test(prefix);
};

const hasWordContinuation = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  const before =
    start === 0
      ? ""
      : normalized.slice(previousCodePointStart(normalized, start), start);
  const after =
    end === normalized.length
      ? ""
      : normalized.slice(end, nextCodePointEnd(normalized, end));

  return WORD_CHAR_RE.test(before) || WORD_CHAR_RE.test(after);
};

const isValidMultiLabelDomain = (
  candidate: string,
  trimLeadingPunctuation: boolean,
): boolean => {
  const withoutTrailingPunctuation = candidate.replace(/\.+$/u, "");
  const domain = trimLeadingPunctuation
    ? withoutTrailingPunctuation.replace(/^\.+/u, "")
    : withoutTrailingPunctuation;
  const labels = domain.split(".");
  return (
    domain.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => label.length <= 63 && DOMAIN_LABEL_RE.test(label))
  );
};

const nextCodePointEnd = (value: string, index: number): number => {
  const code = value.codePointAt(index);
  return index + (code !== undefined && code > 0xffff ? 2 : 1);
};

const previousCodePointStart = (value: string, index: number): number => {
  const previous = Math.max(0, index - 1);
  return previous > 0 &&
    value.charCodeAt(previous) >= 0xdc00 &&
    value.charCodeAt(previous) <= 0xdfff &&
    value.charCodeAt(previous - 1) >= 0xd800 &&
    value.charCodeAt(previous - 1) <= 0xdbff
    ? previous - 1
    : previous;
};
