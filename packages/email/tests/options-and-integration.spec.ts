import { createTextPipeline } from "@textfilters/core";
import { describe, expect, it } from "vitest";

import {
  EMAIL_FILTER_NAME,
  createEmailFilter,
  emailFilter,
  filter,
} from "../src/index.js";

describe("@textfilters/email options and integration", () => {
  it("supports custom mask characters", () => {
    expect(
      createEmailFilter({ maskChar: "#" }).censor("user@example.com"),
    ).toBe("################");
    expect(
      createEmailFilter({ maskChar: "💥" }).censor("user@example.com"),
    ).toBe("****************");
  });

  it("keeps output length stable for normal mask characters", () => {
    const source = "contact user@example.com and admin at example dot com";
    const output = createEmailFilter({ maskChar: "#" }).censor(source);

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

  it("supports localhost when configured", () => {
    expect(
      createEmailFilter({ allowLocalhost: true }).censor("mail user@localhost"),
    ).toBe("mail **************");
    expect(
      createEmailFilter({ allowLocalhost: true }).censor(
        "email admin at localhost",
      ),
    ).toBe("email ******************");

    const user = "user at localhost";
    const admin = "admin at localhost";
    expect(
      createEmailFilter({ allowLocalhost: true }).censor(
        `email ${user} and ${admin}`,
      ),
    ).toBe(`email ${"*".repeat(user.length)} and ${"*".repeat(admin.length)}`);
  });

  it("supports single-label domains when configured", () => {
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        "mail user@example",
      ),
    ).toBe("mail ************");
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        "email admin at example",
      ),
    ).toBe("email ****************");

    const user = "user at example";
    const admin = "admin at example";
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        `email ${user} and ${admin}`,
      ),
    ).toBe(`email ${"*".repeat(user.length)} and ${"*".repeat(admin.length)}`);
  });

  it("excludes configured email addresses from masking", () => {
    const configured = createEmailFilter({
      excludeEmails: ["user@example.com"],
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

  it("applies full-address exclusions consistently to direct and obfuscated candidates", () => {
    const configured = createEmailFilter({
      excludeEmails: ["user@example.com"],
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

  it("excludes configured usernames from masking", () => {
    const configured = createEmailFilter({
      excludeUsernames: ["admin"],
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

  it("excludes configured domains from masking", () => {
    const configured = createEmailFilter({
      excludeDomains: ["example.com"],
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

  it("normalizes configured exclusions before matching", () => {
    const configured = createEmailFilter({
      excludeEmails: ["USER@EXAMPLE.COM"],
      excludeUsernames: ["ＳＵＰＰＯＲＴ"],
      excludeDomains: ["@EXAMPLE.NET"],
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

  it("has a stable name and factory alias", () => {
    expect(filter.name).toBe("email");
    expect(EMAIL_FILTER_NAME).toBe("email");
    expect(emailFilter().name).toBe("email");
  });

  it("works inside the core text pipeline", () => {
    const pipeline = createTextPipeline().use(filter);
    expect(pipeline.censor("contact user@example.com")).toBe(
      "contact ****************",
    );
  });
});
