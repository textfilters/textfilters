import { describe, expect, it } from "vitest";

describe("built public API surfaces", () => {
  it("keeps core focused on filters, guards, moderation, and UTF-16 masking", async () => {
    const core = await import("@textfilters/core");

    expect(core.combineFilters).toBeTypeOf("function");
    expect(core.createModerationPipeline).toBeTypeOf("function");
    expect(core.maskTextRanges).toBeTypeOf("function");
    expect(Object.keys(core).sort()).toEqual([
      "combineFilters",
      "createModerationPipeline",
      "maskTextRanges",
    ]);
    expect(core).not.toHaveProperty("createTextPipeline");
    expect(core).not.toHaveProperty("createTextRangePipeline");
    expect(core).not.toHaveProperty("createTextFilterFromScanner");
    expect(core).not.toHaveProperty("createCachedTextProcessor");
    expect(core).not.toHaveProperty("createPreparedText");
    expect(core).not.toHaveProperty("createTextHints");
    expect(core).not.toHaveProperty("scanTextRanges");
    expect(core).not.toHaveProperty("checkTextRanges");
    expect(core).not.toHaveProperty("maskCodePointRanges");
  });

  it("removes URL scanner aliases, constants, and compatibility APIs", async () => {
    const url = await import("@textfilters/url");

    expect(url.createUrlFilter).toBeTypeOf("function");
    expect(url.filter.name).toBe("url");
    expect(Object.keys(url).sort()).toEqual(["createUrlFilter", "filter"]);
    expect(url).not.toHaveProperty("urlFilter");
    expect(url).not.toHaveProperty("URL_FILTER_NAME");
    expect(url).not.toHaveProperty("createUrlScanner");
    expect(url).not.toHaveProperty("checkUrlRanges");
    expect(url).not.toHaveProperty("scanUrlRanges");
    expect(url).not.toHaveProperty("scanUrlRangeMatches");
  });

  it("removes email scanner aliases, constants, and range APIs", async () => {
    const email = await import("@textfilters/email");

    expect(email.createEmailFilter).toBeTypeOf("function");
    expect(email.filter.name).toBe("email");
    expect(Object.keys(email).sort()).toEqual(["createEmailFilter", "filter"]);
    expect(email).not.toHaveProperty("emailFilter");
    expect(email).not.toHaveProperty("EMAIL_FILTER_NAME");
    expect(email).not.toHaveProperty("createEmailScanner");
    expect(email).not.toHaveProperty("collectEmailRanges");
    expect(email).not.toHaveProperty("checkEmailRanges");
    expect(email).not.toHaveProperty("scanEmailRanges");
  });

  it("exposes phone only as the shared stateless filter", async () => {
    const phone = await import("@textfilters/phone");

    expect(phone.filter.name).toBe("phone");
    expect(Object.keys(phone)).toEqual(["filter"]);
    expect(phone).not.toHaveProperty("createPhoneFilter");
    expect(phone).not.toHaveProperty("phoneFilter");
    expect(phone).not.toHaveProperty("PHONE_FILTER_NAME");
    expect(phone).not.toHaveProperty("createPhoneScanner");
    expect(phone).not.toHaveProperty("checkPhoneRanges");
    expect(phone).not.toHaveProperty("scanPhoneRanges");
  });

  it("exposes spam only as a bounded stateful guard", async () => {
    const spam = await import("@textfilters/spam");

    expect(spam.createSpamGuard).toBeTypeOf("function");
    expect(spam.SPAM_BLOCK_REASONS).toEqual({
      empty: "empty",
      tooFast: "too_fast",
      duplicate: "duplicate",
      burst: "burst",
    });
    expect(Object.keys(spam).sort()).toEqual([
      "SPAM_BLOCK_REASONS",
      "createSpamGuard",
    ]);
    expect(spam).not.toHaveProperty("createSpamFilter");
    expect(spam).not.toHaveProperty("spamFilter");
    expect(spam).not.toHaveProperty("SPAM_FILTER_NAME");
    expect(spam).not.toHaveProperty("createInMemorySpamStateStore");
  });
});
