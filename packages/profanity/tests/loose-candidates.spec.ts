import { describe, expect, it, vi } from "vitest";
import {
  buildLoosePatterns,
  buildStrictPatterns,
} from "../src/matchers/build.js";
import { compilePatternDefinitions } from "../src/matchers/compile.js";
import {
  buildLooseCandidateIndex,
  collectInputScanFacts,
  createInputScanFactCollector,
  looseCandidateIndexDiagnostics,
  looseCandidateIndexStats,
  looseCandidatePatterns,
  loosePatternCandidates,
} from "../src/matchers/loose-candidates.js";
import { createBuiltInProfanityRules } from "../src/matchers/internal-rules.js";
import {
  normalizeForMatchSameLen,
  prepareForMatchSameLen,
  prepareForMatchSameLenWithoutHomoglyphs,
} from "../src/normalization/text.js";
import { collectLooseRanges } from "../src/ranges/loose.js";
import { iterateLooseCandidateRanges } from "../src/ranges/loose.js";
import { iteratePatternCandidateMatches } from "../src/ranges/patterns.js";
import { LOOSE_BASE } from "../src/terms/loose-base.js";
import { STRICT_BASE } from "../src/terms/strict-base.js";

const loosePatterns = buildLoosePatterns({
  internal: createBuiltInProfanityRules(LOOSE_BASE, "loose"),
  literals: [],
});
const strictPatterns = buildStrictPatterns({
  internal: createBuiltInProfanityRules(STRICT_BASE, "strict"),
  literals: [],
});
const looseCandidateIndex = buildLooseCandidateIndex(loosePatterns);
type CollectedLooseRanges = Parameters<typeof collectLooseRanges>[4];

describe("loose candidate index", () => {
  it("assigns stable numeric ids and preserves compiled pattern order", () => {
    expect(looseCandidateIndex.patterns.map(({ id }) => id)).toEqual(
      looseCandidateIndex.patterns.map((_, id) => id),
    );
    expect(looseCandidateIndex.patterns.map(({ pattern }) => pattern)).toEqual(
      loosePatterns,
    );

    const facts = collectInputScanFacts(
      normalizeForMatchSameLen("п-и-з-д-е-ц"),
      looseCandidateIndex,
    );
    const selected = looseCandidatePatterns(looseCandidateIndex, facts);

    expect(selected).toEqual(
      loosePatterns.filter((pattern) => selected.includes(pattern)),
    );
  });

  it("records complete signatures and UTF-16 candidate starts in one scan", () => {
    const [pattern] = compilePatternDefinitions(
      [{ source: String.raw`b[^\p{L}\p{N}]*a` }],
      false,
    );
    const index = buildLooseCandidateIndex([pattern!]);
    const unrelated = collectInputScanFacts("🙂b-x", index);
    const matching = collectInputScanFacts("🙂b---a", index);

    expect(unrelated.looseCandidateStartPositions).toEqual([]);
    expect(looseCandidatePatterns(index, unrelated)).toEqual([]);
    expect(matching.looseCandidateStartPositions).toEqual([2]);
    expect(looseCandidatePatterns(index, matching)).toEqual([pattern]);
    expect(loosePatternCandidates(index, matching)).toEqual([
      { pattern, startPositions: [2] },
    ]);
  });

  it("applies non-letter prefix guards without losing repeated starts", () => {
    const [pattern] = compilePatternDefinitions(
      [{ source: String.raw`(?<!\p{L})b[^\p{L}\p{N}]*a` }],
      false,
    );
    const index = buildLooseCandidateIndex([pattern!]);
    const embedded = collectInputScanFacts("xb-a", index);
    const repeated = collectInputScanFacts(" bbb-a", index);

    expect(looseCandidatePatterns(index, embedded)).toEqual([]);
    expect(repeated.looseCandidateStartPositions).toEqual([1]);
    expect(looseCandidatePatterns(index, repeated)).toEqual([pattern]);
  });

  it("keeps rules without a derivable prefix on the fallback path", () => {
    const patterns = compilePatternDefinitions(
      [
        { source: String.raw`\p{L}+` },
        { source: String.raw`b[^\p{L}\p{N}]*a` },
      ],
      false,
    );
    const index = buildLooseCandidateIndex(patterns);

    expect(
      looseCandidatePatterns(index, collectInputScanFacts("plain", index)),
    ).toEqual(
      patterns.filter((pattern) => pattern.scanFirstChars === undefined),
    );
    expect(
      looseCandidatePatterns(index, collectInputScanFacts("b-a", index)),
    ).toEqual(patterns);
  });

  it("uses three-character signatures and keeps unsafe prefixes on fallback", () => {
    const [indexed, fallback] = compilePatternDefinitions(
      [
        { source: String.raw`b[^\p{L}\p{N}]*a[^\p{L}\p{N}]*d` },
        { source: String.raw`(?:x)?b[^\p{L}\p{N}]*a` },
      ],
      false,
    );
    const mixedSymbol = compilePatternDefinitions(
      [{ source: String.raw`b[^\p{L}\p{N}]*[a@]` }],
      false,
    )[0]!;
    const index = buildLooseCandidateIndex([indexed!, fallback!, mixedSymbol]);
    const stats = looseCandidateIndexStats(index);

    expect(indexed!.scanSignatures).toEqual(["bad"]);
    expect(fallback!.scanSignatures).toBeUndefined();
    expect(mixedSymbol.scanSignatures).toBeUndefined();
    expect(stats).toMatchObject({
      patternCount: 3,
      candidateIndexedPatternCount: 1,
      globalScanFallbackPatternCount: 2,
      signatureCount: 1,
    });
    expect(stats.automatonNodeCount).toBeGreaterThan(1);
    expect(stats.trackedByteLength).toBeGreaterThan(0);
  });

  it("reports the matcher strategy and exact global fallback reason", () => {
    const [indexed, missing] = compilePatternDefinitions(
      [
        { ruleId: "test.indexed", source: String.raw`b[^\p{L}\p{N}]*a` },
        { ruleId: "test.missing", source: String.raw`\p{L}+` },
      ],
      false,
    );
    const unsupported = {
      ...indexed!,
      ruleId: "test.unsupported",
      scanSignatures: ["abcd"],
    };
    const repeated = {
      ...indexed!,
      ruleId: "test.repeated",
      scanSignatures: ["bba"],
    };
    const index = buildLooseCandidateIndex([
      indexed!,
      missing!,
      unsupported,
      repeated,
    ]);

    expect(looseCandidateIndexDiagnostics(index)).toEqual([
      {
        patternId: 0,
        ruleId: "test.indexed",
        strategy: "candidate-indexed",
      },
      {
        patternId: 1,
        ruleId: "test.missing",
        strategy: "global-scan-fallback",
        reason: "missing-safe-leading-signature",
      },
      {
        patternId: 2,
        ruleId: "test.unsupported",
        strategy: "global-scan-fallback",
        reason: "unsupported-signature-length",
      },
      {
        patternId: 3,
        ruleId: "test.repeated",
        strategy: "global-scan-fallback",
        reason: "adjacent-repeated-signature-character",
      },
    ]);
  });

  it("preserves Unicode case-fold matches in signature indexing", () => {
    for (const [source, normalized] of [
      ["ßa", "ẞa"],
      ["σa", "ςa"],
      ["ka", "Ka"],
    ]) {
      const [pattern] = compilePatternDefinitions([{ source }], false);
      const index = buildLooseCandidateIndex([pattern!]);
      const candidates = loosePatternCandidates(
        index,
        collectInputScanFacts(normalized, index),
      );

      expect(pattern!.scanSignatures, source).toBeDefined();
      expect(candidates, source).toEqual([{ pattern, startPositions: [0] }]);
      expect(
        [...iteratePatternCandidateMatches(normalized, candidates)].map(
          ({ start, end }) => [start, end],
        ),
        source,
      ).toEqual([[0, normalized.length]]);
    }
  });

  it("keeps negated classes that can consume letters off the signature path", () => {
    const [pattern] = compilePatternDefinitions(
      [{ source: String.raw`b[^\s]*a` }],
      false,
    );
    const index = buildLooseCandidateIndex([pattern!]);
    const candidates = loosePatternCandidates(
      index,
      collectInputScanFacts("bxa", index),
    );

    expect(pattern!.scanSignatures).toBeUndefined();
    expect(candidates).toEqual([{ pattern }]);
    expect(
      [...iteratePatternCandidateMatches("bxa", candidates)].map(
        ({ start, end }) => [start, end],
      ),
    ).toEqual([[0, 3]]);
  });

  it("validates indexed rules only at anchored candidate positions", () => {
    const [pattern] = compilePatternDefinitions(
      [
        {
          source: String.raw`b(?:[^\p{L}\p{N}]*b)*[^\p{L}\p{N}]*a`,
        },
      ],
      false,
    );
    const index = buildLooseCandidateIndex([pattern!]);
    const normalized = "🙂bb-a xx b--a";
    const candidates = loosePatternCandidates(
      index,
      collectInputScanFacts(normalized, index),
    );
    const globalExec = vi.spyOn(pattern!.re, "exec");

    expect(candidates).toEqual([{ pattern, startPositions: [2, 3, 10] }]);
    expect(
      [...iteratePatternCandidateMatches(normalized, candidates)].map(
        ({ start, end }) => [start, end],
      ),
    ).toEqual([
      [2, 6],
      [10, 14],
    ]);
    expect(globalExec).not.toHaveBeenCalled();
  });

  it("keeps unindexable rules on the global compatibility path", () => {
    const [pattern] = compilePatternDefinitions(
      [{ source: String.raw`\p{L}+` }],
      false,
    );
    const index = buildLooseCandidateIndex([pattern!]);
    const candidates = loosePatternCandidates(
      index,
      collectInputScanFacts("plain text", index),
    );
    const globalExec = vi.spyOn(pattern!.re, "exec");

    expect(candidates).toEqual([{ pattern }]);
    expect([
      ...iteratePatternCandidateMatches("plain text", candidates),
    ]).toHaveLength(2);
    expect(globalExec).toHaveBeenCalled();
  });

  it("keeps fused candidate facts aligned with the compatibility collector", () => {
    const sources = [
      "🙂ｐ-и-z-д-е-ц",
      "х\u200Bу\u200Bй",
      "Ａ plain eё text",
      " bbb-a 𐐀",
    ];

    for (const prepare of [
      prepareForMatchSameLen,
      prepareForMatchSameLenWithoutHomoglyphs,
    ]) {
      for (const source of sources) {
        const collector = createInputScanFactCollector(looseCandidateIndex);
        const normalized = prepare(source, collector.visit);

        expect(collector.finish(), source).toEqual(
          collectInputScanFacts(normalized, looseCandidateIndex),
        );
      }
    }
  });

  it("matches the exhaustive path across maintained and generated cases", () => {
    const maintainedCases = [
      "обычный текст без нарушений",
      "The quick brown fox jumps over the lazy dog. ".repeat(10),
      "ну это пи здец конечно",
      "п-и-з-д-е-ц",
      "х/у/й",
      "б*л*я*д*ь",
      "запиииздячить",
      "о/х/у/у/е/т/ь",
      "х\u200bу\u200bй",
      "xyй",
      "пи3дец",
      "п1и1д1о1р",
      "еб@ть",
      "бля текст",
      "привет хуй и мир",
      "𐐀bad𐐀",
      "💬 привет хуй и мир",
    ];
    const generatedCases = ["пиздец", "хуй", "блядь", "ебал"].flatMap((term) =>
      [" ", "-", ".", "_", "/", "*", "1", "\u200b", "🙂"].map((separator) =>
        Array.from(term).join(separator),
      ),
    );

    for (const source of [...maintainedCases, ...generatedCases]) {
      const normalized = normalizeForMatchSameLen(source);
      const candidates = loosePatternCandidates(
        looseCandidateIndex,
        collectInputScanFacts(normalized, looseCandidateIndex),
      );
      const indexedRanges: CollectedLooseRanges = [
        ...iterateLooseCandidateRanges(
          normalized,
          source,
          candidates,
          strictPatterns,
          loosePatterns,
        ),
      ];
      const exhaustiveRanges: CollectedLooseRanges = [];

      collectLooseRanges(
        normalized,
        source,
        loosePatterns,
        strictPatterns,
        exhaustiveRanges,
      );

      expect(indexedRanges, source).toEqual(exhaustiveRanges);
    }
  });
});
