import {
  type InputScanFacts,
  type LooseCandidateIndex,
} from "./matchers/loose-candidates.js";
import { type LiteralNormalizer } from "./matchers/literals.js";
import { type ProfanityNormalizationStrategy } from "./languages/profanity.js";
import { type ProfanityScanHints } from "./types.js";

export interface PreparedNormalizationView {
  readonly normalized: string;
  readonly scanFacts: WeakMap<LooseCandidateIndex, InputScanFacts>;
}

export interface PreparedProfanityInput {
  readonly text: string;
  readonly codePoints?: readonly string[];
  readonly hints?: ProfanityScanHints;
  readonly normalizedViews: Map<
    ProfanityNormalizationStrategy,
    PreparedNormalizationView
  >;
}

export const createPreparedProfanityInput = (
  text: string,
  scanInput?: {
    readonly codePoints?: readonly string[];
    readonly hints?: ProfanityScanHints;
  },
): PreparedProfanityInput => {
  const codePoints = scanInput?.codePoints;
  // Preserve generic hints as optional evidence, but derive length facts from
  // the actual invocation input before package-owned code can use them.
  const hints =
    scanInput?.hints === undefined
      ? undefined
      : {
          ...scanInput.hints,
          textLength: text.length,
          ...(codePoints === undefined
            ? {}
            : { codePointLength: codePoints.length }),
          isEmpty: text.length === 0,
        };

  return {
    text,
    ...(codePoints === undefined ? {} : { codePoints }),
    ...(hints === undefined ? {} : { hints }),
    normalizedViews: new Map(),
  };
};

export const normalizedTextForPreparedProfanityInput = (
  input: PreparedProfanityInput,
  normalization: ProfanityNormalizationStrategy,
  normalizeForMatch: LiteralNormalizer,
): string =>
  normalizedViewForPreparedInput(input, normalization, normalizeForMatch)
    .normalized;

const normalizedViewForPreparedInput = (
  input: PreparedProfanityInput,
  normalization: ProfanityNormalizationStrategy,
  normalizeForMatch: LiteralNormalizer,
): PreparedNormalizationView => {
  const existing = input.normalizedViews.get(normalization);
  if (existing !== undefined) return existing;

  const created: PreparedNormalizationView = {
    normalized: normalizeForMatch(input.text),
    scanFacts: new WeakMap(),
  };
  input.normalizedViews.set(normalization, created);
  return created;
};
