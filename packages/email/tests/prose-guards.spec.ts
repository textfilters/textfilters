import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

interface GuardGroup {
  readonly name: string;
  readonly cases: readonly string[];
}

const unchangedGuardGroups: readonly GuardGroup[] = [
  {
    name: "package/social guards",
    cases: ["install @textfilters/core", "message @username"],
  },
  {
    name: "URL-like prose",
    cases: [
      "meet me at example dot com",
      "и ещё www (.) example dot com",
      "go www dot example dot com",
      "we are at www dot example dot com",
      "we are at example dot com",
      "we live at example dot com",
      "we work at www dot example dot com",
      "we work @ example dot com",
      "employees work at example dot com",
      "children study at example dot com",
      "the email service at example dot com is down",
      "the e-mail service at example dot com",
      "the contact form at example dot com",
      "I like my job at example dot com",
      "we saw her work at example dot com",
      "Located at example dot com",
      "See our site. Located at example dot com",
      "we work at example [dot] com",
    ],
  },
  {
    name: "work/study/shop/apply phrase starts",
    cases: [
      "Work at example dot com",
      "Study at example dot com",
      "Shop at example dot com",
      "Apply at example dot com",
      "try to shop at example dot com",
      "try to apply at example dot com",
      "send me to shop at example dot com",
      "send us to apply at example dot com",
      "send the report to work at example dot com",
      "write work at example dot com",
      "write work at example [dot] com",
    ],
  },
  {
    name: "contact/form/page/service resource phrases",
    cases: [
      "the contact us page at example dot com",
      "contact us page at example dot com",
      "the contact me form at example dot com",
      "contact the page at example dot com",
      "contact the form at example dot com",
      "the contact via page at example dot com",
      "corporate contact via form at example dot com",
      "please contact via form at example dot com",
      "contact via page at example dot com",
      "send via service at example dot com",
      "message via code at example dot com",
      "contact via work at example dot com",
      "email the service at example dot com",
      "email this form at example dot com",
      "message this page at example dot com",
      "forward shopping at example dot com",
      "forward to shop at example dot com",
      "reach shopping at example dot com",
      "reach work at example dot com",
      "the email to page at example dot com",
      "the message to page at example dot com",
      "corporate email to page at example dot com",
      "website message to page at example dot com",
      "Service at example dot com is down",
      "Page at example dot com moved",
      "try shopping at example dot com",
      "try shopping at example [dot] com",
      "try work at example dot com",
      "try work at example [dot] com",
      "send a file to page at example dot com",
      "send it to page at example dot com",
      "send this to work at example dot com",
      "send that to form at example dot com",
      "send this form at example dot com",
      "send that page at example dot com",
      "Our service at example dot com is down",
      "Their page at example dot com moved",
      "Our work at example dot com is showcased",
      "Their study at example dot com was cited",
      "corporate email service at example dot com is down",
      "website contact form at example dot com",
    ],
  },
  {
    name: "send/reply/respond prose phrases",
    cases: [
      "write code at example dot com",
      "write code at example [dot] com",
      "please reply back to work at example dot com",
      "please reply all to work at example dot com",
      "respond to work at example dot com",
      "respond via service at example dot com",
      "please respond back to work at example dot com",
    ],
  },
  {
    name: "label contexts",
    cases: [
      "Try: work at example dot com",
      "Try - work at example dot com",
      "Try To: work at example dot com",
      "Write: code at example dot com",
      "Write - code at example dot com",
      "Note: work at example dot com",
      "Note - work at example dot com",
      "Note- work at example dot com",
      "Note:\nwork at example dot com",
      "my email is hosted at example dot com",
      "my old email was hosted at example dot com",
      "my address is hosted at example dot com",
      "our address was located at example dot com",
      "address is located at example dot com",
      "address is work at example dot com",
      "work address is located at example dot com",
      "the email is down at example dot com",
      "the email was down at example dot com",
      "the address is down at example dot com",
      "my email address is hosted at example dot com",
      "the email address is down at example dot com",
    ],
  },
  {
    name: "address-list contexts",
    cases: [
      "work at example dot com and admin at example dot com",
      "we work at example dot com and admin at example dot com",
      "Note: service at example dot com and page at example dot com",
    ],
  },
];

describe("@textfilters/email prose guards", () => {
  for (const group of unchangedGuardGroups) {
    describe(group.name, () => {
      it.each(group.cases)("%s", (source) => {
        expect(filter.censor(source)).toBe(source);
      });
    });
  }

  it("does not mask versions, coordinates, or normal text", () => {
    expect(filter.censor("version 1.2.3 near 127.0.0.1 is normal")).toBe(
      "version 1.2.3 near 127.0.0.1 is normal",
    );
  });

  it("does not mask localhost or incomplete domains by default", () => {
    expect(filter.censor("mail user@localhost or user@example")).toBe(
      "mail user@localhost or user@example",
    );
  });
});
