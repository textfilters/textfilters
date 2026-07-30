import { describe, expect, it } from "vitest";

import { createUrlFilter, filter } from "../src/index.js";
import { mask } from "./helpers.js";

describe("explicit URL authority behavior", () => {
  it("censors explicit-scheme URLs with unknown TLDs while preserving bare-domain TLD rules", () => {
    expect(filter.censor("go https://example.unknown/path now")).toBe(
      `go ${mask("https://example.unknown/path")} now`,
    );
    expect(filter.censor("go example.unknown/path now")).toBe(
      "go example.unknown/path now",
    );
  });

  it("censors explicit authority forms", () => {
    expect(filter.censor("go https://[2001:db8::1]/path now")).toBe(
      `go ${mask("https://[2001:db8::1]/path")} now`,
    );
    expect(filter.censor("go http://localhost:3000/admin now")).toBe(
      `go ${mask("http://localhost:3000/admin")} now`,
    );
    expect(filter.censor("go https://user:pass@example.com/admin now")).toBe(
      `go ${mask("https://user:pass@example.com/admin")} now`,
    );
    expect(filter.censor("go https://user:1.next@example.com/admin now")).toBe(
      `go ${mask("https://user:1.next@example.com/admin")} now`,
    );
    expect(filter.censor("go https://foo_bar.com/path now")).toBe(
      `go ${mask("https://foo_bar.com/path")} now`,
    );
    expect(filter.censor("go https://foo_\u200bbar.com/path now")).toBe(
      `go ${mask("https://foo_\u200bbar.com/path")} now`,
    );
    expect(filter.censor("go https://example.com_foo/path now")).toBe(
      `go ${mask("https://example.com_foo/path")} now`,
    );
    expect(filter.censor("go https://example.com😀/path now")).toBe(
      `go ${"*".repeat("https://example.com😀/path".length)} now`,
    );
    expect(filter.censor("go http://svc_api:8080/ now")).toBe(
      `go ${mask("http://svc_api:8080/")} now`,
    );
  });

  it("censors explicit IDN, emoji, and punycode hosts", () => {
    expect(filter.censor("go http://☃.net/ now")).toBe(
      `go ${mask("http://☃.net/")} now`,
    );
    expect(filter.censor("go http://😀.com/ now")).toBe(
      `go ${"*".repeat("http://😀.com/".length)} now`,
    );
    expect(filter.censor("go xn--e1afmkfd.xn--p1ai now")).toBe(
      `go ${mask("xn--e1afmkfd.xn--p1ai")} now`,
    );
  });

  it("trims glued prose around explicit authority URLs", () => {
    expect(filter.censor("go http://localhost:3000,then")).toBe(
      `go ${mask("http://localhost:3000")},then`,
    );
    expect(filter.censor("go http://localhost:3000.next")).toBe(
      `go ${mask("http://localhost:3000")}.next`,
    );
    expect(filter.censor("go http://localhost:details")).toBe(
      `go ${mask("http://localhost")}:details`,
    );
    expect(filter.censor("go https://[2001:db8::1]:next")).toBe(
      `go ${mask("https://[2001:db8::1]")}:next`,
    );
    expect(filter.censor("go https://[2001:db8::1], now")).toBe(
      `go ${mask("https://[2001:db8::1]")}, now`,
    );
    expect(filter.censor("go http://localhost\u200b, next")).toBe(
      `go ${mask("http://localhost")}\u200b, next`,
    );
    expect(filter.censor("go https://[2001:db8::1]\u200b, next")).toBe(
      `go ${mask("https://[2001:db8::1]")}\u200b, next`,
    );
    expect(filter.censor("go https://[2001:db8::1],next")).toBe(
      `go ${mask("https://[2001:db8::1]")},next`,
    );
    expect(filter.censor("go https://[2001:db8::1].next")).toBe(
      `go ${mask("https://[2001:db8::1]")}.next`,
    );
    expect(filter.censor("go http://localhost\u200bnext now")).toBe(
      `go ${mask("http://localhost")}\u200bnext now`,
    );
    expect(filter.censor("go http://localhost”next now")).toBe(
      `go ${mask("http://localhost")}”next now`,
    );
    expect(filter.censor("go http://localhost»next now")).toBe(
      `go ${mask("http://localhost")}»next now`,
    );
    expect(filter.censor("go http://localhost“next now")).toBe(
      `go ${mask("http://localhost")}“next now`,
    );
    expect(filter.censor("go http://localhost‘next now")).toBe(
      `go ${mask("http://localhost")}‘next now`,
    );
    expect(filter.censor("go http://localhost«next now")).toBe(
      `go ${mask("http://localhost")}«next now`,
    );
    expect(filter.censor("go http://localhost(next now")).toBe(
      `go ${mask("http://localhost")}(next now`,
    );
    expect(filter.censor("go http://localhost[next now")).toBe(
      `go ${mask("http://localhost")}[next now`,
    );
    expect(filter.censor("go https://[2001:db8::1](next now")).toBe(
      `go ${mask("https://[2001:db8::1]")}(next now`,
    );
    expect(filter.censor("go https://[2001:db8::1][next now")).toBe(
      `go ${mask("https://[2001:db8::1]")}[next now`,
    );
    expect(filter.censor("go https://user:pass@example.com, now")).toBe(
      `go ${mask("https://user:pass@example.com")}, now`,
    );
  });

  it("keeps surrounding brackets outside explicit authority ranges", () => {
    expect(filter.censor("(https://[2001:db8::1])")).toBe(
      `(${mask("https://[2001:db8::1]")})`,
    );
    expect(filter.censor('"http://localhost:3000"')).toBe(
      `"${mask("http://localhost:3000")}"`,
    );
    expect(filter.censor("“https://[2001:db8::1]”")).toBe(
      `“${mask("https://[2001:db8::1]")}”`,
    );
    expect(filter.censor("<http://localhost:3000>")).toBe(
      `<${mask("http://localhost:3000")}>`,
    );
    expect(filter.censor("[https://[2001:db8::1]]")).toBe(
      `[${mask("https://[2001:db8::1]")}]`,
    );
    expect(filter.censor("(http://localhost:3000)")).toBe(
      `(${mask("http://localhost:3000")})`,
    );
  });

  it("censors explicit dot-before-path and spaced-host continuations", () => {
    expect(filter.censor("go https://example.com.:443/admin now")).toBe(
      `go ${mask("https://example.com.:443/admin")} now`,
    );
    expect(filter.censor("go https://example.com./admin now")).toBe(
      `go ${mask("https://example.com./admin")} now`,
    );
    expect(filter.censor("go https://exa mple.ai/path now")).toBe(
      `go ${mask("https://exa mple.ai/path")} now`,
    );
    expect(filter.censor("go https://exam pl\u200be.ai/path now")).toBe(
      `go ${mask("https://exam pl\u200be.ai/path")} now`,
    );
    expect(filter.censor("go https://example .ai/path now")).toBe(
      `go ${mask("https://example .ai/path")} now`,
    );
    expect(filter.censor("go https://example [.] com/path now")).toBe(
      `go ${mask("https://example [.] com/path")} now`,
    );
    expect(filter.censor("go https://example . com/path now")).toBe(
      `go ${mask("https://example . com/path")} now`,
    );
    expect(filter.censor("go http://example. com/path now")).toBe(
      `go ${mask("http://example. com/path")} now`,
    );
    expect(filter.censor("go https://example. online/path now")).toBe(
      `go ${mask("https://example. online/path")} now`,
    );
    expect(filter.censor("go https://example. online\u200b/path now")).toBe(
      `go ${mask("https://example. online\u200b/path")} now`,
    );
    expect(filter.censor("go https://example. on\u200bline/path now")).toBe(
      `go ${mask("https://example. on\u200bline/path")} now`,
    );
    expect(
      createUrlFilter({ tlds: ["internal"] }).censor(
        "go https://svc. internal/path now",
      ),
    ).toBe(`go ${mask("https://svc. internal/path")} now`);
    expect(filter.censor("go https://example dot com/path now")).toBe(
      `go ${mask("https://example dot com/path")} now`,
    );
    expect(filter.censor("go https://example dot com n\u200bext now")).toBe(
      `go ${mask("https://example dot com")} n\u200bext now`,
    );
    expect(filter.censor("go https://example dot com\u200b, next")).toBe(
      `go ${mask("https://example dot com")}\u200b, next`,
    );
    expect(filter.censor("go https://example dot com/path\u200b, next")).toBe(
      `go ${mask("https://example dot com/path")}\u200b, next`,
    );
    expect(filter.censor("go https://example dot com,then")).toBe(
      `go ${mask("https://example dot com")},then`,
    );
    expect(filter.censor("go https://example dot com,example.org now")).toBe(
      `go ${mask("https://example dot com")},${mask("example.org")} now`,
    );
    expect(filter.censor("go https://example dot com:123support now")).toBe(
      `go ${mask("https://example dot com:123")}support now`,
    );
    expect(filter.censor("go https://example dot com:123-support now")).toBe(
      `go ${mask("https://example dot com:123")}-support now`,
    );
    expect(filter.censor("go https://example dot com:80.support now")).toBe(
      `go ${mask("https://example dot com:80")}.support now`,
    );
    expect(filter.censor("go https://example dot unknown/path now")).toBe(
      `go ${mask("https://example dot unknown/path")} now`,
    );
    expect(filter.censor("go https://example . com now")).toBe(
      `go ${mask("https://example . com")} now`,
    );
    expect(filter.censor("go https://exa mple.ai/path,then")).toBe(
      `go ${mask("https://exa mple.ai/path")},then`,
    );
    expect(
      filter.censor("go https://exa mple.ai/wiki/Function_(math) now"),
    ).toBe(`go ${mask("https://exa mple.ai/wiki/Function_(math)")} now`);
    expect(filter.censor("go https://exam ple.unknown/path now")).toBe(
      `go ${mask("https://exam ple.unknown/path")} now`,
    );
  });

  it("trims prose and zero-width separators around explicit authority tails", () => {
    expect(filter.censor("go http://localhost next.step")).toBe(
      `go ${mask("http://localhost")} next.step`,
    );
    expect(filter.censor("go http://localhost\u200b/admin now")).toBe(
      `go ${mask("http://localhost\u200b/admin")} now`,
    );
    expect(filter.censor("go https://[2001:db8::1]\u200b/path now")).toBe(
      `go ${mask("https://[2001:db8::1]\u200b/path")} now`,
    );
    expect(filter.censor("go http://localhost:80abc now")).toBe(
      `go ${mask("http://localhost:80")}abc now`,
    );
    expect(filter.censor("go http://localhost:80-admin now")).toBe(
      `go ${mask("http://localhost:80")}-admin now`,
    );
    expect(filter.censor("go https://[2001:db8::1]:443_admin now")).toBe(
      `go ${mask("https://[2001:db8::1]:443")}_admin now`,
    );
    expect(filter.censor("go http://localhost:_admin now")).toBe(
      `go ${mask("http://localhost")}:_admin now`,
    );
    expect(filter.censor("go https://[2001:db8::1]:-note now")).toBe(
      `go ${mask("https://[2001:db8::1]")}:-note now`,
    );
    expect(filter.censor("go http://localhost:8\u200b0/admin now")).toBe(
      `go ${mask("http://localhost:8\u200b0/admin")} now`,
    );
    expect(filter.censor("go http://localhost:8\u200b0example.com now")).toBe(
      `go ${mask("http://localhost:8\u200b0")}${mask("example.com")} now`,
    );
    expect(filter.censor("go https://[2001:db8::1]\u200b:443/path now")).toBe(
      `go ${mask("https://[2001:db8::1]\u200b:443/path")} now`,
    );
    expect(filter.censor("go https://[2001:db8::1]:443next now")).toBe(
      `go ${mask("https://[2001:db8::1]:443")}next now`,
    );
    expect(filter.censor("go https://[2001:db8::1]next now")).toBe(
      `go ${mask("https://[2001:db8::1]")}next now`,
    );
    expect(filter.censor("go https://[2001:db8::1]\u200bnext now")).toBe(
      `go ${mask("https://[2001:db8::1]")}\u200bnext now`,
    );
    expect(filter.censor("go http://localhost,\u200bnext now")).toBe(
      `go ${mask("http://localhost")},\u200bnext now`,
    );
    expect(filter.censor("go http://localhost]next now")).toBe(
      `go ${mask("http://localhost")}]next now`,
    );
    expect(filter.censor("go https://[2001:db8::1]]next now")).toBe(
      `go ${mask("https://[2001:db8::1]")}]next now`,
    );
    expect(filter.censor("go http://[note:todo]/ now")).toBe(
      "go http://[note:todo]/ now",
    );
    expect(filter.censor("go https://example.com,example.org now")).toBe(
      `go ${mask("https://example.com")},${mask("example.org")} now`,
    );
    expect(filter.censor("go example.com.\u200b/admin now")).toBe(
      `go ${mask("example.com.\u200b/admin")} now`,
    );
    expect(filter.censor("go https://example.com.\u200b/admin now")).toBe(
      `go ${mask("https://example.com.\u200b/admin")} now`,
    );
    expect(filter.censor("go https://example.\u200bcom/path now")).toBe(
      `go ${mask("https://example.\u200bcom/path")} now`,
    );
    expect(filter.censor("go https://example.com\u200bnext now")).toBe(
      `go ${mask("https://example.com")}\u200bnext now`,
    );
    expect(filter.censor("go http://localhost:80example.com now")).toBe(
      `go ${mask("http://localhost:80")}${mask("example.com")} now`,
    );
    expect(filter.censor("go http://localhost:80\u200b.next now")).toBe(
      `go ${mask("http://localhost:80")}\u200b.next now`,
    );
  });
});
