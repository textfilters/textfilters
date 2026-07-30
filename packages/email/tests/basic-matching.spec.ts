import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

describe("@textfilters/email basic matching", () => {
  it("normalizes empty and non-string public input through core", () => {
    expect(filter.censor("")).toBe("");
    expect(filter.censor(null)).toBe("");
    expect(filter.censor(undefined)).toBe("");
    expect(filter.censor(12345)).toBe("12345");
    expect(filter.censor({ toString: () => "user@example.com" })).toBe(
      "****************",
    );
  });

  it("masks direct email addresses", () => {
    expect(filter.censor("contact user@example.com")).toBe(
      "contact ****************",
    );
  });

  it("masks complex direct email addresses", () => {
    expect(filter.censor("send first.last+tag@sub.example.co.uk now")).toBe(
      "send ******************************** now",
    );
  });

  it("masks mixed-case email addresses", () => {
    expect(filter.censor("Mail User@Example.COM")).toBe(
      "Mail ****************",
    );
  });

  it("masks fullwidth separators after normalization", () => {
    expect(filter.censor("contact user＠example．com")).toBe(
      "contact ****************",
    );
  });

  it("masks bracketed obfuscated email addresses", () => {
    expect(filter.censor("contact user [at] example [dot] com")).toBe(
      "contact ***************************",
    );
  });

  it("masks compact parenthesized obfuscated email addresses", () => {
    expect(filter.censor("contact user(at)example(dot)com")).toBe(
      "contact ***********************",
    );
  });

  it("masks word obfuscated email addresses", () => {
    expect(filter.censor("contact user at example dot com")).toBe(
      "contact ***********************",
    );
  });

  it("masks symbolic obfuscated email addresses", () => {
    expect(filter.censor("contact user [@] example [.] com")).toBe(
      "contact ************************",
    );
  });

  it("masks obfuscated variants with extra spaces", () => {
    expect(
      filter.censor("contact user   [ at ]   example   [ dot ]   com"),
    ).toBe("contact ***************************************");
  });

  it("masks explicit obfuscated email addresses with www subdomains", () => {
    const email = "user [at] www [dot] example [dot] com";
    expect(filter.censor(`contact ${email}`)).toBe(
      `contact ${"*".repeat(email.length)}`,
    );
  });

  it("masks bare-word obfuscated email addresses with www subdomains", () => {
    const email = "user at www dot example dot com";
    expect(filter.censor(`contact ${email}`)).toBe(
      `contact ${"*".repeat(email.length)}`,
    );
  });

  it("masks common-word local parts in obfuscated email addresses", () => {
    expect(filter.censor("contact the at example dot com")).toBe(
      "contact **********************",
    );
    expect(filter.censor("email you at example dot com")).toBe(
      "email **********************",
    );
  });

  it("masks bare-word obfuscated email addresses after punctuation or newlines", () => {
    const email = "user at example dot com";
    expect(filter.censor(`hello. ${email}`)).toBe(
      `hello. ${"*".repeat(email.length)}`,
    );
    expect(filter.censor(`hello\n${email}`)).toBe(
      `hello\n${"*".repeat(email.length)}`,
    );
  });

  it("masks mixed explicit dot obfuscated email addresses", () => {
    const email = "user at example [dot] com";
    expect(filter.censor(`try ${email}`)).toBe(
      `try ${"*".repeat(email.length)}`,
    );
  });
});
