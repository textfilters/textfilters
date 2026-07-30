import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

describe("@textfilters/email introduced contexts", () => {
  it("masks obfuscated email addresses introduced by possessive pronouns", () => {
    expect(filter.censor("email our support at example dot com")).toBe(
      "email our **************************",
    );
    expect(filter.censor("my admin at example dot com")).toBe(
      "my ************************",
    );
    expect(filter.censor("their sales at example dot com")).toBe(
      "their ************************",
    );
    expect(filter.censor("your admin at example dot com")).toBe(
      "your ************************",
    );
  });

  it("masks obfuscated email addresses introduced by prepositional wording", () => {
    expect(filter.censor("contact located at example dot com")).toBe(
      "contact **************************",
    );
    expect(filter.censor("send to user at example dot com")).toBe(
      "send to ***********************",
    );
    expect(filter.censor("send the report to user at example dot com")).toBe(
      "send the report to ***********************",
    );
    expect(filter.censor("send a file to admin at example dot com")).toBe(
      "send a file to ************************",
    );
    expect(filter.censor("send report to user at example dot com")).toBe(
      "send report to ***********************",
    );
    expect(filter.censor("send an email to user at example dot com")).toBe(
      "send an email to ***********************",
    );
    expect(filter.censor("contact via user at example dot com")).toBe(
      "contact via ***********************",
    );
    expect(filter.censor("send via admin at example dot com")).toBe(
      "send via ************************",
    );
    expect(filter.censor("message via support at example dot com")).toBe(
      "message via **************************",
    );
    expect(filter.censor("contact via admin at example dot com")).toBe(
      "contact via ************************",
    );
    expect(filter.censor("please contact via support at example dot com")).toBe(
      "please contact via **************************",
    );
    expect(filter.censor("email to admin at example dot com")).toBe(
      "email to ************************",
    );
    expect(filter.censor("cc to user at example dot com")).toBe(
      "cc to ***********************",
    );
    expect(filter.censor("bcc via admin at example dot com")).toBe(
      "bcc via ************************",
    );
    expect(filter.censor("send a message to admin at example dot com")).toBe(
      "send a message to ************************",
    );
    expect(filter.censor("forward to admin at example dot com")).toBe(
      "forward to ************************",
    );
    expect(filter.censor("forward to service at example dot com")).toBe(
      "forward to **************************",
    );
    expect(filter.censor("send it to user at example dot com")).toBe(
      "send it to ***********************",
    );
    expect(filter.censor("send this to admin at example dot com")).toBe(
      "send this to ************************",
    );
    expect(filter.censor("send it to our support at example dot com")).toBe(
      "send it to our **************************",
    );
    expect(filter.censor("send this to your admin at example dot com")).toBe(
      "send this to your ************************",
    );
    expect(filter.censor("email me user at example dot com")).toBe(
      "email me ***********************",
    );
    expect(filter.censor("message us admin at example dot com")).toBe(
      "message us ************************",
    );
    expect(filter.censor("write to admin at example dot com")).toBe(
      "write to ************************",
    );
    expect(filter.censor("please reply to user at example dot com")).toBe(
      "please reply to ***********************",
    );
    expect(filter.censor("please reply back to user at example dot com")).toBe(
      "please reply back to ***********************",
    );
    expect(filter.censor("please reply all to user at example dot com")).toBe(
      "please reply all to ***********************",
    );
    expect(filter.censor("please respond to user at example dot com")).toBe(
      "please respond to ***********************",
    );
    expect(filter.censor("respond via admin at example dot com")).toBe(
      "respond via ************************",
    );
    expect(
      filter.censor("please respond back to user at example dot com"),
    ).toBe("please respond back to ***********************");
    expect(filter.censor("please reach out to user at example dot com")).toBe(
      "please reach out to ***********************",
    );
    expect(
      filter.censor("please reach out to our support at example dot com"),
    ).toBe("please reach out to our **************************");
    expect(filter.censor("send to located at example dot com")).toBe(
      "send to **************************",
    );
    expect(filter.censor("send to our support at example dot com")).toBe(
      "send to our **************************",
    );
  });

  it("masks obfuscated email addresses introduced by e-mail wording", () => {
    expect(filter.censor("please e-mail user at example dot com")).toBe(
      "please e-mail ***********************",
    );
    expect(filter.censor("email service at example dot com")).toBe(
      "email **************************",
    );
    expect(filter.censor("email the admin at example dot com")).toBe(
      "email the ************************",
    );
    expect(filter.censor("please cc user at example dot com")).toBe(
      "please cc ***********************",
    );
    expect(filter.censor("bcc admin at example dot com")).toBe(
      "bcc ************************",
    );
    expect(filter.censor("cc the admin at example dot com")).toBe(
      "cc the ************************",
    );
    expect(filter.censor("cc me user at example dot com")).toBe(
      "cc me ***********************",
    );
    expect(filter.censor("message the user at example dot com")).toBe(
      "message the ***********************",
    );
    expect(filter.censor("please email service at example dot com")).toBe(
      "please email **************************",
    );
    expect(filter.censor("send email service at example dot com")).toBe(
      "send email **************************",
    );
    expect(filter.censor("forward user at example dot com")).toBe(
      "forward ***********************",
    );
    expect(filter.censor("please forward admin at example dot com")).toBe(
      "please forward ************************",
    );
    expect(filter.censor("forward service at example dot com")).toBe(
      "forward **************************",
    );
    expect(filter.censor("please reach user at example dot com")).toBe(
      "please reach ***********************",
    );
    expect(filter.censor("reach service at example dot com")).toBe(
      "reach **************************",
    );
    expect(filter.censor("try user at example dot com")).toBe(
      "try ***********************",
    );
    expect(filter.censor("write admin at example dot com")).toBe(
      "write ************************",
    );
  });

  it("masks obfuscated email addresses introduced through copula wording", () => {
    expect(filter.censor("my email is user at example dot com")).toBe(
      "my email is ***********************",
    );
    expect(filter.censor("my old email was user at example dot com")).toBe(
      "my old email was ***********************",
    );
    expect(filter.censor("my email address is user at example dot com")).toBe(
      "my email address is ***********************",
    );
    expect(filter.censor("our address was admin at example dot com")).toBe(
      "our address was ************************",
    );
    expect(filter.censor("Email: work at example dot com")).toBe(
      "Email: ***********************",
    );
    expect(filter.censor("Email - work at example dot com")).toBe(
      "Email - ***********************",
    );
    expect(filter.censor("Email- work at example dot com")).toBe(
      "Email- ***********************",
    );
    expect(filter.censor("Email:\nwork at example dot com")).toBe(
      "Email:\n***********************",
    );
    expect(filter.censor("To: user at example dot com")).toBe(
      "To: ***********************",
    );
    expect(filter.censor("Reply-To: admin at example dot com")).toBe(
      "Reply-To: ************************",
    );
    expect(filter.censor("Reply To: admin at example dot com")).toBe(
      "Reply To: ************************",
    );
    expect(filter.censor("From: work at example dot com")).toBe(
      "From: ***********************",
    );
    expect(filter.censor("From: apply at example dot com")).toBe(
      "From: ************************",
    );
    expect(filter.censor("Contact: apply at example dot com")).toBe(
      "Contact: ************************",
    );
    expect(filter.censor("Contact us - apply at example dot com")).toBe(
      "Contact us - ************************",
    );
    expect(filter.censor("Contact us- apply at example dot com")).toBe(
      "Contact us- ************************",
    );
    expect(filter.censor("Address: admin at example dot com")).toBe(
      "Address: ************************",
    );
    expect(filter.censor("Email address: work at example dot com")).toBe(
      "Email address: ***********************",
    );
    expect(filter.censor("Contact us: apply at example dot com")).toBe(
      "Contact us: ************************",
    );
    expect(filter.censor("my address is user at example dot com")).toBe(
      "my address is ***********************",
    );
    expect(filter.censor("address is admin at example dot com")).toBe(
      "address is ************************",
    );
    expect(filter.censor("work address is user at example dot com")).toBe(
      "work address is ***********************",
    );
  });

  it("masks additional obfuscated email addresses in introduced lists", () => {
    const user = "user at example dot com";
    const admin = "admin at example dot com";
    const work = "work at example dot com";
    const apply = "apply at example dot com";
    const service = "service at example dot com";

    expect(filter.censor(`email ${user} and ${admin}`)).toBe(
      `email ${"*".repeat(user.length)} and ${"*".repeat(admin.length)}`,
    );
    expect(filter.censor(`email ${user}, and ${admin}`)).toBe(
      `email ${"*".repeat(user.length)}, and ${"*".repeat(admin.length)}`,
    );
    expect(filter.censor(`email ${user}, ${work}`)).toBe(
      `email ${"*".repeat(user.length)}, ${"*".repeat(work.length)}`,
    );
    expect(filter.censor(`contact ${user} or ${admin}`)).toBe(
      `contact ${"*".repeat(user.length)} or ${"*".repeat(admin.length)}`,
    );
    expect(filter.censor(`Email: ${work} and ${apply}`)).toBe(
      `Email: ${"*".repeat(work.length)} and ${"*".repeat(apply.length)}`,
    );
    expect(filter.censor(`Email: ${work}, ${apply}, ${service}`)).toBe(
      `Email: ${"*".repeat(work.length)}, ${"*".repeat(apply.length)}, ${"*".repeat(service.length)}`,
    );
  });

  it("masks long introduced lists without recursive context revalidation", () => {
    const addresses = Array.from(
      { length: 64 },
      (_, index) => `user${index} at example dot com`,
    );
    const source = `email ${addresses.join(" and ")}`;
    const expected = `email ${addresses
      .map((address) => "*".repeat(address.length))
      .join(" and ")}`;

    expect(filter.censor(source)).toBe(expected);
  });
});
