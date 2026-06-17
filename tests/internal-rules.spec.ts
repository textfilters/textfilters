import { describe, expect, it } from "vitest";

import { buildLoosePatterns, buildStrictPatterns } from "../src/matchers/build";
import { compileStrictLiteralPatterns } from "../src/matchers/literals";
import {
  matchRangesForMode,
  PROFANITY_MATCH_MODE,
} from "../src/matches/ranges";
import { collectLooseRanges } from "../src/ranges/loose";
import { collectStrictRanges } from "../src/ranges/strict";
import {
  createProfanityFilter,
  type ProfanityCategory,
  type ProfanitySeverity,
} from "../src";
import { languageRuleSourcePattern } from "../src/languages/profanity";
import {
  compileLooseInternalRulePatterns,
  compileStrictInternalRulePatterns,
  createBuiltInProfanityRules,
  type InternalProfanityRuleDefinition,
} from "../src/matchers/internal-rules";
import { RUSSIAN_PROFANITY_DICTIONARY } from "../src/languages/ru";
import { LOOSE_BASE } from "../src/terms/loose-base";
import { STRICT_BASE } from "../src/terms/strict-base";

const ALLOWED_PROFANITY_CATEGORIES = [
  "OBSCENE_MAT",
  "STRONG_INSULT",
  "VULGAR",
  "EUPHEMISM",
] as const satisfies readonly ProfanityCategory[];

const ALLOWED_PROFANITY_SEVERITIES = [
  "high",
  "medium",
  "low",
  "soft",
] as const satisfies readonly ProfanitySeverity[];

const ALLOWED_PROFANITY_CATEGORY_SET = new Set<unknown>(
  ALLOWED_PROFANITY_CATEGORIES,
);

const ALLOWED_PROFANITY_SEVERITY_SET = new Set<unknown>(
  ALLOWED_PROFANITY_SEVERITIES,
);

const BUILT_IN_RULE_DEFINITION_SETS = [
  { corpus: "strict", definitions: STRICT_BASE },
  { corpus: "loose", definitions: LOOSE_BASE },
] as const satisfies readonly {
  readonly corpus: "strict" | "loose";
  readonly definitions: readonly InternalProfanityRuleDefinition[];
}[];

const REPRESENTATIVE_TAXONOMY_RULES = [
  { source: "alpha", category: "OBSCENE_MAT", severity: "high" },
  { source: "beta", category: "STRONG_INSULT", severity: "medium" },
  { source: "gamma", category: "VULGAR", severity: "low" },
  { source: "delta", category: "EUPHEMISM", severity: "soft" },
] as const satisfies readonly Extract<
  InternalProfanityRuleDefinition,
  { source: string }
>[];

const isObjectRuleDefinition = (
  definition: InternalProfanityRuleDefinition,
): definition is Extract<InternalProfanityRuleDefinition, { source: string }> =>
  typeof definition === "object" && definition !== null;

const hasTaxonomyMetadata = (
  definition: Extract<InternalProfanityRuleDefinition, { source: string }>,
): boolean =>
  definition.category !== undefined || definition.severity !== undefined;

describe("internal profanity rules", () => {
  it("keeps internal object rule metadata within the allowed taxonomy", () => {
    const invalidDefinitions = BUILT_IN_RULE_DEFINITION_SETS.flatMap(
      ({ corpus, definitions }) =>
        definitions.flatMap((definition, index) => {
          if (!isObjectRuleDefinition(definition)) {
            return [];
          }

          const failures = [];

          if (definition.source.length === 0) {
            failures.push("source");
          }

          if (
            hasTaxonomyMetadata(definition) &&
            !ALLOWED_PROFANITY_CATEGORY_SET.has(definition.category)
          ) {
            failures.push("category");
          }

          if (
            hasTaxonomyMetadata(definition) &&
            !ALLOWED_PROFANITY_SEVERITY_SET.has(definition.severity)
          ) {
            failures.push("severity");
          }

          if (
            definition.loose !== undefined &&
            definition.loose.stretch !== true &&
            definition.loose.hyphenTail !== true
          ) {
            failures.push("loose");
          }

          return failures.length === 0
            ? []
            : [{ corpus, index, failures, definition }];
        }),
    );

    expect(invalidDefinitions).toEqual([]);
  });

  it("documents the built-in corpus taxonomy metadata audit baseline", () => {
    const audit = BUILT_IN_RULE_DEFINITION_SETS.map(
      ({ corpus, definitions }) => {
        const objectDefinitions = definitions.filter(isObjectRuleDefinition);
        const taxonomyDefinitions =
          objectDefinitions.filter(hasTaxonomyMetadata);

        return {
          corpus,
          totalRules: definitions.length,
          stringBackedRules: definitions.length - objectDefinitions.length,
          taxonomyBackedRules: taxonomyDefinitions.length,
          compilerMetadataRules:
            objectDefinitions.length - taxonomyDefinitions.length,
          invalidTaxonomyBackedRules: objectDefinitions.filter(
            (definition) =>
              hasTaxonomyMetadata(definition) &&
              (!ALLOWED_PROFANITY_CATEGORY_SET.has(definition.category) ||
                !ALLOWED_PROFANITY_SEVERITY_SET.has(definition.severity)),
          ).length,
        };
      },
    );

    expect(audit).toEqual([
      {
        corpus: "strict",
        totalRules: 62,
        stringBackedRules: 0,
        taxonomyBackedRules: 62,
        compilerMetadataRules: 0,
        invalidTaxonomyBackedRules: 0,
      },
      {
        corpus: "loose",
        totalRules: 112,
        stringBackedRules: 0,
        taxonomyBackedRules: 112,
        compilerMetadataRules: 0,
        invalidTaxonomyBackedRules: 0,
      },
    ]);
  });

  it("models the Russian corpus as one language dictionary with compiled matcher views", () => {
    const rules = RUSSIAN_PROFANITY_DICTIONARY.rules;

    expect(RUSSIAN_PROFANITY_DICTIONARY.language).toBe("ru");
    expect(rules).toHaveLength(122);
    expect(
      rules.filter((rule) => rule.match.strict !== undefined),
    ).toHaveLength(STRICT_BASE.length);
    expect(rules.filter((rule) => rule.match.loose !== undefined)).toHaveLength(
      LOOSE_BASE.length,
    );
    expect(
      rules.filter(
        (rule) =>
          rule.match.strict !== undefined && rule.match.loose !== undefined,
      ),
    ).toHaveLength(52);
  });

  it("derives matcher views from Russian dictionary source order", () => {
    const strictSources = RUSSIAN_PROFANITY_DICTIONARY.rules
      .filter((rule) => rule.match.strict !== undefined)
      .map((rule) => languageRuleSourcePattern(rule.source));
    const looseSources = RUSSIAN_PROFANITY_DICTIONARY.rules
      .filter((rule) => rule.match.loose !== undefined)
      .map((rule) => languageRuleSourcePattern(rule.source));

    expect(STRICT_BASE.map((rule) => rule.source)).toEqual(strictSources);
    expect(LOOSE_BASE.map((rule) => rule.source)).toEqual(looseSources);
  });

  it("keeps representative taxonomy-backed examples for every public category and severity", () => {
    const categories = new Set(
      REPRESENTATIVE_TAXONOMY_RULES.map((rule) => rule.category),
    );
    const severities = new Set(
      REPRESENTATIVE_TAXONOMY_RULES.map((rule) => rule.severity),
    );

    expect([...categories].sort()).toEqual(
      [...ALLOWED_PROFANITY_CATEGORIES].sort(),
    );
    expect([...severities].sort()).toEqual(
      [...ALLOWED_PROFANITY_SEVERITIES].sort(),
    );
    expect(
      createBuiltInProfanityRules(REPRESENTATIVE_TAXONOMY_RULES, "strict").map(
        ({ source, category, severity }) => ({ source, category, severity }),
      ),
    ).toEqual(REPRESENTATIVE_TAXONOMY_RULES);
  });

  it("creates deterministic built-in rule ids from corpus, index, and source", () => {
    const sources = ["first", "second"];
    const firstPass = createBuiltInProfanityRules(sources, "strict");
    const secondPass = createBuiltInProfanityRules(sources, "strict");

    expect(firstPass).toEqual(secondPass);
    expect(firstPass).toEqual([
      { id: "builtin:strict:0:0k495j5", source: "first" },
      { id: "builtin:strict:1:1bps3bx", source: "second" },
    ]);
    expect(createBuiltInProfanityRules(sources, "loose")[0]?.id).toBe(
      "builtin:loose:0:0k495j5",
    );
    expect(
      createBuiltInProfanityRules([...sources].reverse(), "strict"),
    ).toEqual([
      { id: "builtin:strict:0:1bps3bx", source: "second" },
      { id: "builtin:strict:1:0k495j5", source: "first" },
    ]);
  });

  it("keeps string built-in rule definitions compatible with the original rule shape", () => {
    expect(createBuiltInProfanityRules(["first", "second"], "strict")).toEqual([
      { id: "builtin:strict:0:0k495j5", source: "first" },
      { id: "builtin:strict:1:1bps3bx", source: "second" },
    ]);
  });

  it("preserves object built-in rule metadata without changing source-based ids", () => {
    expect(
      createBuiltInProfanityRules(
        [
          {
            source: "first",
            category: "OBSCENE_MAT",
            severity: "high",
          },
          {
            source: "second",
            category: "VULGAR",
            severity: "low",
          },
        ],
        "strict",
      ),
    ).toEqual([
      {
        id: "builtin:strict:0:0k495j5",
        source: "first",
        category: "OBSCENE_MAT",
        severity: "high",
      },
      {
        id: "builtin:strict:1:1bps3bx",
        source: "second",
        category: "VULGAR",
        severity: "low",
      },
    ]);
  });

  it("keeps mixed string and object rule definitions compatible through match ranges", () => {
    const cases = [
      {
        mode: PROFANITY_MATCH_MODE.STRICT,
        input: "legacy meta",
        expectedRanges: [
          [0, 6],
          [7, 11],
        ],
      },
      {
        mode: PROFANITY_MATCH_MODE.LOOSE,
        input: "l-e-g-a-c-y m-e-t-a",
        expectedRanges: [
          [0, 11],
          [12, 19],
        ],
      },
    ] as const;

    for (const testCase of cases) {
      const [legacyRule, objectRule] = createBuiltInProfanityRules(
        [
          "legacy",
          {
            source: "meta",
            category: "OBSCENE_MAT",
            severity: "high",
          },
        ],
        testCase.mode,
      );
      const strictPatterns = buildStrictPatterns({
        internal:
          testCase.mode === PROFANITY_MATCH_MODE.STRICT
            ? [legacyRule!, objectRule!]
            : [],
        literals: [],
      });
      const loosePatterns = buildLoosePatterns({
        internal:
          testCase.mode === PROFANITY_MATCH_MODE.LOOSE
            ? [legacyRule!, objectRule!]
            : [],
        literals: [],
      });
      const ranges = [];

      if (testCase.mode === PROFANITY_MATCH_MODE.STRICT) {
        collectStrictRanges(testCase.input, strictPatterns, ranges);
      } else {
        collectLooseRanges(
          testCase.input,
          testCase.input,
          loosePatterns,
          strictPatterns,
          ranges,
        );
      }

      expect(matchRangesForMode(ranges, testCase.mode)).toEqual([
        Object.assign([...testCase.expectedRanges[0]], {
          mode: testCase.mode,
          ruleId: legacyRule!.id,
        }),
        Object.assign([...testCase.expectedRanges[1]], {
          mode: testCase.mode,
          ruleId: objectRule!.id,
          category: "OBSCENE_MAT",
          severity: "high",
        }),
      ]);
    }
  });

  it("uses object source values for deterministic ids and compiled match behavior", () => {
    const stringRule = createBuiltInProfanityRules(["bad"], "strict")[0]!;
    const objectRule = createBuiltInProfanityRules(
      [{ source: "bad", category: "STRONG_INSULT", severity: "medium" }],
      "strict",
    )[0]!;
    const objectLooseRule = createBuiltInProfanityRules(
      [{ source: "bad", category: "STRONG_INSULT", severity: "medium" }],
      "loose",
    )[0]!;

    expect(objectRule.id).toBe(stringRule.id);
    expect(compileStrictInternalRulePatterns([objectRule])[0]?.re.source).toBe(
      "^(?:bad)$",
    );
    expect(
      compileLooseInternalRulePatterns([objectLooseRule])[0]?.re.source,
    ).toBe(String.raw`b[^\p{L}\p{N}]*a[^\p{L}\p{N}]*d`);
  });

  it("threads built-in rule ids through compiled strict and loose patterns", () => {
    const strictRule = createBuiltInProfanityRules(["bad"], "strict")[0];
    const looseRule = createBuiltInProfanityRules(["bad"], "loose")[0];

    expect(strictRule).toBeDefined();
    expect(looseRule).toBeDefined();

    const strictPatterns = compileStrictInternalRulePatterns([strictRule!]);
    const loosePatterns = compileLooseInternalRulePatterns([looseRule!]);

    expect(strictPatterns[0]?.ruleId).toBe(strictRule!.id);
    expect(loosePatterns[0]?.ruleId).toBe(looseRule!.id);
    expect(strictPatterns[0]?.re.source).toBe("^(?:bad)$");
    expect(loosePatterns[0]?.re.source).toBe(
      String.raw`b[^\p{L}\p{N}]*a[^\p{L}\p{N}]*d`,
    );
  });

  it("preserves object rule taxonomy metadata in compiled strict patterns", () => {
    const rule = createBuiltInProfanityRules(
      [{ source: "bad", category: "STRONG_INSULT", severity: "medium" }],
      "strict",
    )[0]!;
    const pattern = compileStrictInternalRulePatterns([rule])[0];

    expect(pattern).toMatchObject({
      ruleId: rule.id,
      category: "STRONG_INSULT",
      severity: "medium",
    });
    expect(pattern?.re.source).toBe("^(?:bad)$");
  });

  it("preserves object rule taxonomy metadata in compiled loose patterns", () => {
    const rule = createBuiltInProfanityRules(
      [{ source: "bad", category: "STRONG_INSULT", severity: "medium" }],
      "loose",
    )[0]!;
    const pattern = compileLooseInternalRulePatterns([rule])[0];

    expect(pattern).toMatchObject({
      ruleId: rule.id,
      category: "STRONG_INSULT",
      severity: "medium",
    });
    expect(pattern?.re.source).toBe(
      String.raw`b[^\p{L}\p{N}]*a[^\p{L}\p{N}]*d`,
    );
  });

  it("uses loose stretch metadata without changing strict compilation", () => {
    const rule = createBuiltInProfanityRules(
      [{ source: "bad", loose: { stretch: true } }],
      "loose",
    )[0]!;

    expect(compileStrictInternalRulePatterns([rule])[0]?.re.source).toBe(
      "^(?:bad)$",
    );
    expect(compileLooseInternalRulePatterns([rule])[0]?.re.source).toBe(
      String.raw`b(?:[^\p{L}\p{N}]*b)*[^\p{L}\p{N}]*a(?:[^\p{L}\p{N}]*a)*[^\p{L}\p{N}]*d(?:[^\p{L}\p{N}]*d)*`,
    );
  });

  it("carries built-in rule metadata into internal strict and loose match ranges", () => {
    const strictRule = createBuiltInProfanityRules(
      [{ source: "bad", category: "STRONG_INSULT", severity: "medium" }],
      "strict",
    )[0]!;
    const looseRule = createBuiltInProfanityRules(
      [{ source: "bad", category: "STRONG_INSULT", severity: "medium" }],
      "loose",
    )[0]!;
    const strictPatterns = buildStrictPatterns({
      internal: [strictRule],
      literals: [],
    });
    const loosePatterns = buildLoosePatterns({
      internal: [looseRule],
      literals: [],
    });
    const strictRanges = [];
    const looseRanges = [];

    collectStrictRanges("bad", strictPatterns, strictRanges);
    collectLooseRanges(
      "b-a-d",
      "b-a-d",
      loosePatterns,
      strictPatterns,
      looseRanges,
    );

    expect(
      matchRangesForMode(strictRanges, PROFANITY_MATCH_MODE.STRICT),
    ).toEqual([
      Object.assign([0, 3], {
        mode: PROFANITY_MATCH_MODE.STRICT,
        ruleId: strictRule.id,
        category: "STRONG_INSULT",
        severity: "medium",
      }),
    ]);
    expect(matchRangesForMode(looseRanges, PROFANITY_MATCH_MODE.LOOSE)).toEqual(
      [
        Object.assign([0, 5], {
          mode: PROFANITY_MATCH_MODE.LOOSE,
          ruleId: looseRule.id,
          category: "STRONG_INSULT",
          severity: "medium",
        }),
      ],
    );
  });

  it("propagates representative object rule taxonomy metadata through match ranges", () => {
    const cases = [
      {
        mode: PROFANITY_MATCH_MODE.STRICT,
        input: "alpha",
        source: "alpha",
        category: "OBSCENE_MAT",
        severity: "high",
        expectedRange: [0, 5],
      },
      {
        mode: PROFANITY_MATCH_MODE.LOOSE,
        input: "b-e-t-a",
        source: "beta",
        category: "EUPHEMISM",
        severity: "soft",
        expectedRange: [0, 7],
      },
    ] as const;

    for (const testCase of cases) {
      const rule = createBuiltInProfanityRules(
        [
          {
            source: testCase.source,
            category: testCase.category,
            severity: testCase.severity,
          },
        ],
        testCase.mode,
      )[0]!;
      const strictPatterns = buildStrictPatterns({
        internal: testCase.mode === PROFANITY_MATCH_MODE.STRICT ? [rule] : [],
        literals: [],
      });
      const loosePatterns = buildLoosePatterns({
        internal: testCase.mode === PROFANITY_MATCH_MODE.LOOSE ? [rule] : [],
        literals: [],
      });
      const ranges = [];

      if (testCase.mode === PROFANITY_MATCH_MODE.STRICT) {
        collectStrictRanges(testCase.input, strictPatterns, ranges);
      } else {
        collectLooseRanges(
          testCase.input,
          testCase.input,
          loosePatterns,
          strictPatterns,
          ranges,
        );
      }

      expect(matchRangesForMode(ranges, testCase.mode)).toEqual([
        Object.assign([...testCase.expectedRange], {
          mode: testCase.mode,
          ruleId: rule.id,
          category: testCase.category,
          severity: testCase.severity,
        }),
      ]);
    }
  });

  it("leaves runtime literal patterns without taxonomy metadata", () => {
    const pattern = compileStrictLiteralPatterns([{ source: "bad" }], true)[0];

    expect(pattern?.ruleId).toBeUndefined();
    expect(pattern?.category).toBeUndefined();
    expect(pattern?.severity).toBeUndefined();
  });

  it("keeps public check and censor behavior unchanged", () => {
    const filter = createProfanityFilter(["bad"], ["evil"]);

    expect(filter.check("bad")).toBe(true);
    expect(filter.check("ok")).toBe(false);
    expect(filter.censor("bad e-v-i-l ok")).toBe("*** ******* ok");
  });
});
