import { describe, expect, it } from "vitest";
import {
  buildLoosePatterns,
  buildStrictPatterns,
} from "../src/matchers/build.js";
import { compilePatternDefinitions } from "../src/matchers/compile.js";
import {
  buildLooseCandidateIndex,
  collectInputScanFacts,
  looseCandidatePatterns,
} from "../src/matchers/loose-candidates.js";
import { createBuiltInProfanityRules } from "../src/matchers/internal-rules.js";
import { normalizeForMatchSameLen } from "../src/normalization/text.js";
import { collectLooseRanges } from "../src/ranges/loose.js";
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

  it("uses first and second characters conservatively in one UTF-16 scan", () => {
    const [pattern] = compilePatternDefinitions(
      [{ source: String.raw`b[^\p{L}\p{N}]*a` }],
      false,
    );
    const index = buildLooseCandidateIndex([pattern!]);
    const unrelated = collectInputScanFacts("🙂b-x", index);
    const matching = collectInputScanFacts("🙂b---a", index);

    expect(unrelated.looseCandidateStartPositions).toEqual([2]);
    expect(looseCandidatePatterns(index, unrelated)).toEqual([]);
    expect(matching.looseCandidateStartPositions).toEqual([2]);
    expect(looseCandidatePatterns(index, matching)).toEqual([pattern]);
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
      "бля текст",
      "привет хуй и мир",
      "𐐀bad𐐀",
      "💬 привет хуй и мир",
    ];
    const generatedCases = ["пиздец", "хуй", "блядь", "ебал"].flatMap((term) =>
      [" ", "-", ".", "_", "/", "*", "\u200b", "🙂"].map((separator) =>
        Array.from(term).join(separator),
      ),
    );

    for (const source of [...maintainedCases, ...generatedCases]) {
      const normalized = normalizeForMatchSameLen(source);
      const candidates = looseCandidatePatterns(
        looseCandidateIndex,
        collectInputScanFacts(normalized, looseCandidateIndex),
      );
      const indexedRanges: CollectedLooseRanges = [];
      const exhaustiveRanges: CollectedLooseRanges = [];

      collectLooseRanges(
        normalized,
        source,
        candidates,
        strictPatterns,
        indexedRanges,
        loosePatterns,
      );
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
