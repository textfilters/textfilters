import { describe, expect, it } from "vitest";

import { createProfanityFilter } from "../src/index.js";

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
});
