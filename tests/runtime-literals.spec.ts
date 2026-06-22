import { describe, expect, it } from "vitest";

import { createProfanityFilter } from "../src";

describe("runtime literals", () => {
  it("treats runtime terms as normalized literals, not regular expressions", () => {
    expect(createProfanityFilter(["ёлка"], []).censor("елка")).toBe("****");
    expect(createProfanityFilter(["foo\\.bar"], []).censor("foo.bar")).toBe(
      "*******",
    );
    expect(createProfanityFilter(["foo|bar"], []).censor("bar")).toBe("bar");
    expect(createProfanityFilter(["foo|bar"], []).censor("foo|bar")).toBe(
      "*******",
    );
    expect(createProfanityFilter(["[^\\W]oo"], []).censor("boo")).toBe("boo");
    expect(
      createProfanityFilter(["[^\\P{Script=Latin}]oo"], []).censor("boo"),
    ).toBe("boo");
    expect(createProfanityFilter(["[ｂ]oo"], []).censor("boo")).toBe("boo");
    expect(createProfanityFilter(["[ｂ]oo"], []).censor("ｂoo")).toBe("ｂoo");
    expect(createProfanityFilter(["ｂoo"], []).censor("ｂoo")).toBe("***");
    expect(createProfanityFilter(["[ａ-ｚ]ёлка"], []).censor("ｂелка")).toBe(
      "ｂелка",
    );
    expect(createProfanityFilter([], ["[.a]bad"]).censor(". b a d")).toBe(
      ". b a d",
    );
    expect(createProfanityFilter([], ["bad"]).censor("baaad")).toBe("baaad");
    expect(
      createProfanityFilter(
        [],
        [{ source: "bad", loose: { stretch: true } }],
      ).censor("baaad"),
    ).toBe("baaad");
  });

  it("keeps runtime regex-like terms safe because they are literals", () => {
    const f = createProfanityFilter(["a?"], ["(?=a)"]);
    f.addStrict("(");
    f.addStrict(".");
    f.addStrict("!!");
    f.addStrict("!! !!");
    f.addLoose("[.a]bad");

    expect(f.censor("a")).toBe("a");
    expect(f.censor("a?")).toBe("**");
    expect(
      createProfanityFilter(["_bad", "-bad"], []).censor("_bad -bad"),
    ).toBe("**** ****");
    expect(f.censor("(")).toBe("*");
    expect(f.censor("...")).toBe("***");
    expect(f.censor("!!")).toBe("**");
    expect(f.censor("!! !!")).toBe("*****");
    expect(createProfanityFilter(["foo\\/bar"], []).censor("foo/bar")).toBe(
      "*******",
    );
    expect(f.censor(". b a d")).toBe("* b a d");
    expect(createProfanityFilter([], ["!!"]).censor("!!")).toBe("**");
    expect(createProfanityFilter([], ["!"]).censor("!")).toBe("*");
    expect(createProfanityFilter([], ["(?=𐐀)", "𐐀"]).censor("𐐀")).toBe("**");
  });

  it("keeps metadata-backed runtime terms literal-safe", () => {
    const strict = createProfanityFilter(
      [
        {
          source: "foo|bar",
          category: "VULGAR",
          severity: "low",
        },
        {
          source: "[ｂ]oo",
          category: "VULGAR",
          severity: "low",
        },
      ],
      [
        {
          source: "(?=a)",
          category: "EUPHEMISM",
          severity: "soft",
        },
      ],
    );

    expect(strict.censor("bar")).toBe("bar");
    expect(strict.censor("foo|bar")).toBe("*******");
    expect(strict.analyze("foo|bar")).toEqual([
      Object.assign([0, 7], {
        mode: "strict",
        category: "VULGAR",
        severity: "low",
      }),
    ]);
    expect(strict.censor("boo ｂoo")).toBe("boo ｂoo");
    expect(strict.censor("a")).toBe("a");
    expect(strict.censor("(?=a)")).toBe("*****");
    expect(strict.analyze("(?=a)")).toEqual([
      Object.assign([0, 5], {
        mode: "loose",
        category: "EUPHEMISM",
        severity: "soft",
      }),
    ]);
  });

  it("deduplicates metadata-backed runtime literals by normalized source", () => {
    const strict = createProfanityFilter(
      [
        {
          source: "foo\\.bar",
          category: "VULGAR",
          severity: "low",
        },
        "foo.bar",
      ],
      [
        {
          source: "абв",
          category: "EUPHEMISM",
          severity: "soft",
        },
        "абв",
      ],
    );

    expect(strict.analyze("foo.bar")).toEqual([
      Object.assign([0, 7], {
        mode: "strict",
        category: "VULGAR",
        severity: "low",
      }),
    ]);
    expect(strict.analyze("а-б-в")).toEqual([
      Object.assign([0, 5], {
        mode: "loose",
        category: "EUPHEMISM",
        severity: "soft",
      }),
    ]);
  });

  it("ignores dictionary-only rule fields on structured runtime literals", () => {
    const runtime = createProfanityFilter(
      [
        {
          id: "runtime.strict.bad",
          source: "bad",
          category: "VULGAR",
          severity: "low",
        },
      ],
      [
        {
          id: "runtime.loose.bad",
          source: "bad",
          category: "EUPHEMISM",
          severity: "soft",
          loose: {
            stretch: true,
          },
        },
      ],
    );

    expect(runtime.censor("baaad")).toBe("baaad");
    expect(runtime.analyze("bad")).toEqual([
      Object.assign([0, 3], {
        mode: "strict",
        category: "VULGAR",
        severity: "low",
      }),
      Object.assign([0, 3], {
        mode: "loose",
        category: "EUPHEMISM",
        severity: "soft",
      }),
    ]);
    expect(runtime.analyze("bad")[0]).not.toHaveProperty("ruleId");
  });
});
