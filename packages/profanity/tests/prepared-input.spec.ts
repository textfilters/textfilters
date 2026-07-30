import { describe, expect, it } from "vitest";

import {
  composeProfanityProfiles,
  createProfanityFilter,
  createProfanityFilterFromDictionary,
  defineProfanityLanguageProfile,
} from "../src/index.js";
import {
  analyzePreparedProfanity,
  createPreparedProfanityInput,
  streamPreparedProfanityMatches,
} from "../src/filter.js";

describe("prepared profanity input", () => {
  it("corroborates scanner length hints against the actual input", () => {
    const input = createPreparedProfanityInput("🙂 alpha", {
      codePoints: Array.from("🙂 alpha"),
      hints: {
        textLength: 0,
        codePointLength: 0,
        isEmpty: true,
        hasNonAscii: true,
      },
    });

    expect(input.hints).toMatchObject({
      textLength: 8,
      codePointLength: 7,
      isEmpty: false,
      hasNonAscii: true,
    });
  });

  it("reuses one normalized view across same-strategy composed profiles", () => {
    const composed = composeProfanityProfiles([
      defineProfanityLanguageProfile({
        id: "zz:first",
        languageTag: "zz",
        filter: createProfanityFilter(["alpha"], []),
      }),
      defineProfanityLanguageProfile({
        id: "zz:second",
        languageTag: "zz",
        filter: createProfanityFilter(["beta"], []),
      }),
    ]);
    const input = createPreparedProfanityInput("🙂 alpha beta");
    const matches: Array<{
      readonly profileId?: string;
      readonly range: readonly [number, number];
    }> = [];

    expect(
      streamPreparedProfanityMatches(composed, input, undefined, (match) => {
        matches.push({
          profileId: "profileId" in match ? String(match.profileId) : undefined,
          range: [match[0], match[1]],
        });
      }),
    ).toBe(true);
    expect(input.normalizedViews.size).toBe(1);
    expect(matches).toEqual([
      { profileId: "zz:first", range: [3, 8] },
      { profileId: "zz:second", range: [9, 13] },
    ]);
  });

  it("keeps separate normalized views for mixed strategies", () => {
    const latinPreserving = createProfanityFilterFromDictionary({
      language: "zz",
      normalization: "latin-preserving",
      rules: [
        {
          id: "zz.vulgar.alpha",
          category: "VULGAR",
          severity: "low",
          source: "alpha",
          match: { strict: {} },
        },
      ],
    });
    const composed = composeProfanityProfiles([
      defineProfanityLanguageProfile({
        id: "zz:cyrillic",
        languageTag: "zz",
        filter: createProfanityFilter(["alpha"], []),
      }),
      defineProfanityLanguageProfile({
        id: "zz:latin",
        languageTag: "zz-Latn",
        filter: latinPreserving,
      }),
    ]);
    const input = createPreparedProfanityInput("alpha");
    const profileIds: string[] = [];

    expect(
      streamPreparedProfanityMatches(composed, input, undefined, (match) => {
        if ("profileId" in match) {
          profileIds.push(String(match.profileId));
        }
      }),
    ).toBe(true);
    expect(input.normalizedViews.size).toBe(2);
    expect(profileIds).toEqual(["zz:cyrillic", "zz:latin"]);
  });

  it("recomputes index-specific facts after runtime dictionary mutation", () => {
    const filter = createProfanityFilter([], []);
    const input = createPreparedProfanityInput("b-a-d");

    expect(analyzePreparedProfanity(filter, input)).toEqual([]);
    filter.addLoose("bad");
    expect(
      analyzePreparedProfanity(filter, input)?.map((match) => [
        match[0],
        match[1],
        match.mode,
      ]),
    ).toEqual([[0, 5, "loose"]]);
    expect(input.normalizedViews.size).toBe(1);
  });
});
