import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  composeProfanityProfiles,
  createProfanityFilter,
  createProfanityScanner,
  defineProfanityLanguageProfile,
  type ComposedProfanityFilter,
  type ProfanityLanguageProfile,
  type ProfanityProfileInput,
  type ProfiledProfanityMatchRange,
  type ReadonlyProfanityFilter,
} from "../src/index.js";
import {
  filter as englishProfanityFilter,
  profile as englishProfanityProfile,
} from "../src/entrypoints/en.js";
import {
  filter as russianProfanityFilter,
  profile as russianProfanityProfile,
} from "../src/entrypoints/ru.js";

describe("configured multi-language profanity filter", () => {
  it("creates one filter for the selected Russian and English profiles", () => {
    const configured = composeProfanityProfiles([
      russianProfanityProfile,
      englishProfanityProfile,
    ]);
    const text = "бля shit";
    const ruleIds = configured
      .analyze(text)
      .map((match) => match.ruleId)
      .filter((ruleId): ruleId is string => ruleId !== undefined);

    expect(configured.censor(text)).toBe("*** ****");
    expect(new Set(ruleIds)).toEqual(
      new Set(["ru.obscene.blya", "en.obscene.shit"]),
    );
  });

  it("keeps language selection explicit", () => {
    const english = composeProfanityProfiles([englishProfanityProfile]);
    const russian = composeProfanityProfiles([russianProfanityProfile]);

    expect(english.check("shit")).toBe(true);
    expect(english.check("бля")).toBe(false);
    expect(russian.check("бля")).toBe(true);
    expect(russian.check("shit")).toBe(false);
  });

  it("preserves profile-specific English context exclusions", () => {
    const configured = composeProfanityProfiles([
      russianProfanityProfile,
      englishProfanityProfile,
    ]);

    expect(configured.check("shit.com")).toBe(false);
    expect(configured.censor("бля shit.com")).toBe("*** shit.com");
  });

  it("masks combined UTF-16 ranges once on the original text", () => {
    const configured = composeProfanityProfiles([
      russianProfanityProfile,
      englishProfanityProfile,
    ]);
    const text = "🙂 бля shit";

    expect(configured.censor(text)).toBe("🙂 *** ****");
    expect(configured.censor(text)).toHaveLength(text.length);
  });

  it("returns a frozen read-only filter for pipeline composition", () => {
    const configured = composeProfanityProfiles([
      russianProfanityProfile,
      englishProfanityProfile,
    ]);

    expect(Object.isFrozen(configured)).toBe(true);
    expect("addStrict" in configured).toBe(false);
    expect("setStrict" in configured).toBe(false);
  });

  it("deduplicates repeated language selections", () => {
    const configured = composeProfanityProfiles([
      englishProfanityProfile,
      englishProfanityProfile,
      englishProfanityProfile,
    ]);

    expect(configured.profileIds).toEqual(["en:default"]);
    expect(configured.analyze("shit")).toHaveLength(2);
  });

  it("rejects empty and invalid profile selections", () => {
    expect(() => composeProfanityProfiles([])).toThrow(
      "requires at least one language profile",
    );
    expect(() =>
      composeProfanityProfiles([null as unknown as ProfanityLanguageProfile]),
    ).toThrow("Invalid profanity language profile selection.");

    expect(() =>
      defineProfanityLanguageProfile({
        id: "",
        languageTag: "zz",
        filter: englishProfanityFilter,
      }),
    ).toThrow("profile id must be non-empty");
  });

  it("allows multiple profiles for one language and rejects duplicate ids", () => {
    const conflictingEnglishProfile: ProfanityLanguageProfile = {
      id: englishProfanityProfile.id,
      languageTag: "en",
      filter: englishProfanityFilter,
    };

    expect(() =>
      composeProfanityProfiles([
        englishProfanityProfile,
        conflictingEnglishProfile,
      ]),
    ).toThrow(
      'Multiple profanity profiles were provided with id "en:default".',
    );

    const extension = defineProfanityLanguageProfile({
      id: "en:extension",
      languageTag: "en",
      filter: createProfanityFilter(["extension-term"], []),
    });
    expect(
      composeProfanityProfiles([englishProfanityProfile, extension]).check(
        "extension-term",
      ),
    ).toBe(true);
  });

  it("keeps legacy scanner ranges in source order while enabling streaming", () => {
    const configured = composeProfanityProfiles([
      russianProfanityProfile,
      englishProfanityProfile,
    ]);
    const scanner = createProfanityScanner({ filter: configured });
    const text = "shit бля";
    const result = scanner.scan({ text, codePoints: Array.from(text) });

    expect(scanner.allocationAware).toBe(true);
    expect(result.ranges).toEqual([
      [0, 4],
      [5, 8],
    ]);
    expect(
      result.metadata.matches.map((match) =>
        "profileId" in match ? match.profileId : undefined,
      ),
    ).toEqual(["en:default", "en:default", "ru:default", "ru:default"]);
  });

  it("keeps built-in profiles declarative and exposes stable composition metadata", () => {
    const configured = composeProfanityProfiles([
      russianProfanityProfile,
      englishProfanityProfile,
    ]);

    expect(russianProfanityProfile.filter).toBe(russianProfanityFilter);
    expect(englishProfanityProfile.filter).toBe(englishProfanityFilter);
    expect(Object.isFrozen(russianProfanityProfile)).toBe(true);
    expect(Object.isFrozen(englishProfanityProfile)).toBe(true);
    expect(configured.profileIds).toEqual(["ru:default", "en:default"]);
    expect(configured.languageTags).toEqual(["ru", "en"]);
  });

  it("preserves same-span evidence and annotates every composed match", () => {
    const strictProfile = defineProfanityLanguageProfile({
      id: "zz:strict",
      languageTag: "zz",
      filter: createProfanityFilter(["a-l-p-h-a"], []),
    });
    const looseProfile = defineProfanityLanguageProfile({
      id: "zz:loose",
      languageTag: "zz",
      filter: createProfanityFilter([], ["alpha"]),
    });
    const matches = composeProfanityProfiles([
      strictProfile,
      looseProfile,
    ]).analyze("a-l-p-h-a");

    expect(matches).toHaveLength(2);
    expect(
      matches.map(({ mode, profileId, languageTag }) => ({
        mode,
        profileId,
        languageTag,
      })),
    ).toEqual([
      { mode: "strict", profileId: "zz:strict", languageTag: "zz" },
      { mode: "loose", profileId: "zz:loose", languageTag: "zz" },
    ]);
  });

  it("intersects profile policy with call-time match options", () => {
    const configured = composeProfanityProfiles([
      {
        profile: englishProfanityProfile,
        matchOptions: { categories: ["VULGAR"] },
      },
    ]);

    expect(configured.check("dick")).toBe(true);
    expect(configured.check("shit")).toBe(false);
    expect(configured.check("dick", { minSeverity: "high" })).toBe(false);
  });

  it("streams composed profiles without precollecting analyze output", () => {
    const firstFilter = createProfanityFilter(["alpha"], []);
    const secondFilter = createProfanityFilter(["beta"], []);
    const firstAnalyze = vi.spyOn(firstFilter, "analyze");
    const secondAnalyze = vi.spyOn(secondFilter, "analyze");
    const configured = composeProfanityProfiles([
      defineProfanityLanguageProfile({
        id: "zz:first",
        languageTag: "zz",
        filter: firstFilter,
      }),
      defineProfanityLanguageProfile({
        id: "zz:second",
        languageTag: "zz",
        filter: secondFilter,
      }),
    ]);
    const scanner = createProfanityScanner({ filter: configured });
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanner.scan(
        { text: "alpha beta", codePoints: Array.from("alpha beta") },
        ({ range }) => {
          seen.push(range);
          return false;
        },
      ),
    ).toBe(false);
    expect(scanner.allocationAware).toBe(true);
    expect(seen).toEqual([[0, 5]]);
    expect(firstAnalyze).not.toHaveBeenCalled();
    expect(secondAnalyze).not.toHaveBeenCalled();
  });

  it("exports the composition and profile types", () => {
    expectTypeOf<ProfanityProfileInput>().toMatchTypeOf<
      ProfanityLanguageProfile | { readonly profile: ProfanityLanguageProfile }
    >();
    expectTypeOf<ProfanityLanguageProfile>().toMatchTypeOf<{
      readonly id: string;
      readonly languageTag: string;
      readonly filter: ReadonlyProfanityFilter;
    }>();
    expectTypeOf(
      composeProfanityProfiles([
        russianProfanityProfile,
        englishProfanityProfile,
      ]),
    ).toEqualTypeOf<ComposedProfanityFilter>();
    expectTypeOf<ProfiledProfanityMatchRange>().toMatchTypeOf<{
      readonly profileId: string;
      readonly languageTag: string;
    }>();
  });
});
