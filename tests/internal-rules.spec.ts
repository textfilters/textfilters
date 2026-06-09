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

describe("internal profanity rules", () => {
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

  it("carries built-in rule ids into internal strict and loose match ranges", () => {
    const strictRule = createBuiltInProfanityRules(["bad"], "strict")[0]!;
    const looseRule = createBuiltInProfanityRules(["bad"], "loose")[0]!;
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
      }),
    ]);
    expect(matchRangesForMode(looseRanges, PROFANITY_MATCH_MODE.LOOSE)).toEqual(
      [
        Object.assign([0, 5], {
          mode: PROFANITY_MATCH_MODE.LOOSE,
          ruleId: looseRule.id,
        }),
      ],
    );
  });

  it("leaves runtime literal patterns and public behavior without rule metadata", () => {
    expect(
      compileStrictLiteralPatterns(["bad"], true)[0]?.ruleId,
    ).toBeUndefined();

    const filter = createProfanityFilter(["bad"], ["evil"]);
    expect(filter.check("bad")).toBe(true);
    expect(filter.check("ok")).toBe(false);
    expect(filter.censor("bad e-v-i-l ok")).toBe("*** ******* ok");
  });
});
