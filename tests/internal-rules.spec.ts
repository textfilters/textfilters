import { describe, expect, it } from "vitest";

import {
  buildLoosePatterns,
  buildStrictPatterns,
} from "../src/matchers/build.js";
import { compileStrictLiteralPatterns } from "../src/matchers/literals.js";
import {
  matchRangesForMode,
  PROFANITY_MATCH_MODE,
} from "../src/matches/ranges.js";
import { collectLooseRanges } from "../src/ranges/loose.js";
import { collectStrictRanges } from "../src/ranges/strict.js";
import { createProfanityFilter } from "../src/index.js";
import {
  compileLooseInternalRulePatterns,
  compileStrictInternalRulePatterns,
  createBuiltInProfanityRules,
} from "../src/matchers/internal-rules.js";
import { LOOSE_BASE } from "../src/terms/loose-base.js";
import { STRICT_BASE } from "../src/terms/strict-base.js";
import type { InternalProfanityRuleDefinition } from "../src/matchers/internal-rules.js";
import type {
  ProfanityCategory,
  ProfanitySeverity,
} from "../src/taxonomy/types.js";

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

const isObjectRuleDefinition = (
  definition: InternalProfanityRuleDefinition,
): definition is Extract<InternalProfanityRuleDefinition, { source: string }> =>
  typeof definition === "object" && definition !== null;

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

          if (!ALLOWED_PROFANITY_CATEGORY_SET.has(definition.category)) {
            failures.push("category");
          }

          if (!ALLOWED_PROFANITY_SEVERITY_SET.has(definition.severity)) {
            failures.push("severity");
          }

          return failures.length === 0
            ? []
            : [{ corpus, index, failures, definition }];
        }),
    );

    expect(invalidDefinitions).toEqual([]);
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
    collectLooseRanges("b-a-d", loosePatterns, strictPatterns, looseRanges);

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
    const pattern = compileStrictLiteralPatterns(["bad"], true)[0];

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
