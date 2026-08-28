import { combineFilters } from "@textfilters/core";
import { describe, expect, it } from "vitest";

import { createEmailFilter, filter } from "../src/index.js";

describe("@textfilters/email options and integration", () => {
  it("exposes the shared text filter methods with UTF-16 ranges", () => {
    const text = "😀 user@example.com";
    const [match] = filter.find(text);

    expect(filter.check(text)).toBe(true);
    expect(match).toEqual({
      start: 3,
      end: 19,
      value: "user@example.com",
      filter: "email",
    });
    expect(filter.process(text)).toEqual({
      censored: `😀 ${"*".repeat(16)}`,
      matches: [match],
    });
  });

  it("supports custom mask characters", () => {
    expect(createEmailFilter().censor("user@example.com", "#")).toBe(
      "################",
    );
    expect(createEmailFilter().censor("user@example.com", "💥")).toBe(
      "****************",
    );
  });

  it("keeps output length stable for normal mask characters", () => {
    const source = "contact user@example.com and admin at example dot com";
    const output = createEmailFilter().censor(source, "#");

    expect(output).toHaveLength(source.length);
    expect(output).toBe(
      "contact ################ and ########################",
    );
  });

  it("keeps output length stable for astral input", () => {
    const source = "📩 contact user@example.com now";
    const output = filter.censor(source);

    expect(output).toBe("📩 contact **************** now");
    expect(output).toHaveLength(source.length);
  });

  it("can disable obfuscated email matching", () => {
    const emailOnlyFilter = createEmailFilter({ matchObfuscated: false });

    expect(emailOnlyFilter.censor("contact user@example.com")).toBe(
      "contact ****************",
    );
    expect(emailOnlyFilter.censor("contact user at example dot com")).toBe(
      "contact user at example dot com",
    );
  });

  it("allows configured email addresses", () => {
    const configured = createEmailFilter({
      allowedEmails: ["user@example.com"],
    });

    expect(
      configured.censor("mail user@example.com and admin@example.com"),
    ).toBe("mail user@example.com and *****************");
    expect(
      configured.censor(
        "mail user at example dot com and admin at example dot com",
      ),
    ).toBe("mail user at example dot com and ************************");

    const admin = "admin at example dot org";
    expect(configured.censor(`mail user at example dot com, ${admin}`)).toBe(
      `mail user at example dot com, ${"*".repeat(admin.length)}`,
    );
  });

  it("applies full-address allowlists consistently to direct and obfuscated candidates", () => {
    const configured = createEmailFilter({
      allowedEmails: ["user@example.com"],
    });

    expect(configured.censor("mail user@example.com")).toBe(
      "mail user@example.com",
    );
    expect(configured.censor("mail user at example dot com")).toBe(
      "mail user at example dot com",
    );

    const source = "📩 mail user@example.com";
    expect(configured.censor(source)).toBe(source);
    expect(configured.censor(source)).toHaveLength(source.length);
  });

  it("allows configured usernames", () => {
    const configured = createEmailFilter({
      allowedUsernames: ["admin"],
    });

    expect(
      configured.censor("mail admin@example.com and user@example.com"),
    ).toBe("mail admin@example.com and ****************");
    expect(
      configured.censor(
        "mail admin at example dot com and user at example dot com",
      ),
    ).toBe("mail admin at example dot com and ***********************");
  });

  it("allows configured domains", () => {
    const configured = createEmailFilter({
      allowedDomains: ["example.com"],
    });

    expect(
      configured.censor(
        "mail user@example.com, admin@sub.example.com, and owner@example.net",
      ),
    ).toBe(
      "mail user@example.com, admin@sub.example.com, and *****************",
    );
    expect(
      configured.censor(
        "mail user at example dot com and owner at example dot net",
      ),
    ).toBe("mail user at example dot com and ************************");
  });

  it("normalizes configured allowlists before matching", () => {
    const configured = createEmailFilter({
      allowedEmails: ["USER@EXAMPLE.COM"],
      allowedUsernames: ["ＳＵＰＰＯＲＴ"],
      allowedDomains: ["@EXAMPLE.NET"],
    });

    expect(
      configured.censor(
        "mail user@example.com, support@example.org, admin@sub.example.net, and other@example.io",
      ),
    ).toBe(
      "mail user@example.com, support@example.org, admin@sub.example.net, and ****************",
    );
  });

  it("is idempotent", () => {
    const once = filter.censor("contact user@example.com");
    expect(filter.censor(once)).toBe(once);
  });

  it("has a stable name", () => {
    expect(filter.name).toBe("email");
    expect(createEmailFilter().name).toBe("email");
  });

  it("works inside the combined filter", () => {
    const combined = combineFilters(filter);
    expect(combined.censor("contact user@example.com")).toBe(
      "contact ****************",
    );
  });
});
