import { describe, expect, it } from "vitest";

import {
  createUrlFilter,
  filter,
  URL_FILTER_NAME,
  urlFilter,
} from "../src/index.js";

const mask = (s: string, ch = "*") => ch.repeat(Array.from(s).length);

// These tests double as compatibility fixtures for parser boundary decisions:
// small URL-obfuscation tweaks can otherwise create broad false positives.
describe("compatibility behavior", () => {
  it("exposes old-compatible public API", () => {
    expect(filter.name).toBe(URL_FILTER_NAME);
    expect(urlFilter()).toEqual(
      expect.objectContaining({ name: URL_FILTER_NAME }),
    );
  });

  it("normalizes nullish input to an empty string", () => {
    expect(filter.censor(null)).toBe("");
    expect(filter.censor(undefined)).toBe("");
  });

  it("censors explicit scheme URLs and keeps surrounding text", () => {
    const input = "go https://example.com/path?q=1 now";
    expect(filter.censor(input)).toBe(
      `go ${mask("https://example.com/path?q=1")} now`,
    );
    expect(filter.censor("go http://secure.com/path now")).toBe(
      `go ${mask("http://secure.com/path")} now`,
    );
    expect(filter.censor("go https://example.com/ now")).toBe(
      `go ${mask("https://example.com/")} now`,
    );
    expect(filter.censor("not http:// next")).toBe("not http:// next");
    expect(filter.censor("see http:// later")).toBe("see http:// later");
    expect(filter.censor("go http:// example.com/path now")).toBe(
      `go ${mask("http:// example.com/path")} now`,
    );
  });

  it("keeps trailing punctuation outside masked URL ranges", () => {
    const input = "go example.com, now";
    expect(filter.censor(input)).toBe(`go ${mask("example.com")}, now`);
    expect(filter.censor("go example.com: now")).toBe(
      `go ${mask("example.com")}: now`,
    );
    expect(filter.censor("go example.com? now")).toBe(
      `go ${mask("example.com")}? now`,
    );
    expect(filter.censor("go example.com# now")).toBe(
      `go ${mask("example.com")}# now`,
    );
    expect(filter.censor("go https://example.com: now")).toBe(
      `go ${mask("https://example.com")}: now`,
    );
    expect(filter.censor("go http://example.com:/path now")).toBe(
      `go ${mask("http://example.com:/path")} now`,
    );
    expect(filter.censor("go http://example.com:?x now")).toBe(
      `go ${mask("http://example.com:?x")} now`,
    );
    expect(filter.censor("go http://example.com:#x now")).toBe(
      `go ${mask("http://example.com:#x")} now`,
    );
    expect(filter.censor("go https://example.com. next")).toBe(
      `go ${mask("https://example.com")}. next`,
    );
    expect(filter.censor("go http://localhost:3000. next")).toBe(
      `go ${mask("http://localhost:3000")}. next`,
    );
    expect(filter.censor("go http://localhost. now")).toBe(
      `go ${mask("http://localhost")}. now`,
    );

    const withPath = "go https://example.com/path?q=1#frag! now";
    expect(filter.censor(withPath)).toBe(
      `go ${mask("https://example.com/path?q=1#frag")}! now`,
    );
    expect(filter.censor("go https://example.com/path,then")).toBe(
      `go ${mask("https://example.com/path")},then`,
    );
    expect(filter.censor("go https://example.com/path,\u200bthen")).toBe(
      `go ${mask("https://example.com/path")},\u200bthen`,
    );
    expect(filter.censor("go https://example.com/path,\u200b next")).toBe(
      `go ${mask("https://example.com/path")},\u200b next`,
    );
    expect(filter.censor("go https://example.com/file.html now")).toBe(
      `go ${mask("https://example.com/file.html")} now`,
    );
    expect(filter.censor("go https://example.com/search?q=a,b now")).toBe(
      `go ${mask("https://example.com/search?q=a,b")} now`,
    );
    expect(
      filter.censor(
        "go https://en.wikipedia.org/wiki/Function_(mathematics) now",
      ),
    ).toBe(
      `go ${mask("https://en.wikipedia.org/wiki/Function_(mathematics)")} now`,
    );
  });

  it("censors hxxp-obfuscated links", () => {
    const input = "visit hxxp://example.com";
    expect(filter.censor(input)).toBe(`visit ${mask("hxxp://example.com")}`);
    expect(filter.censor("visit hxxp[:]//example.com")).toBe(
      `visit ${mask("hxxp[:]//example.com")}`,
    );
    expect(filter.censor("visit http[://]example.com")).toBe(
      `visit ${mask("http[://]example.com")}`,
    );
    expect(filter.censor("visit https[://]example.com")).toBe(
      `visit ${mask("https[://]example.com")}`,
    );
  });

  it("censors domain-only links", () => {
    expect(filter.censor("example.com")).toBe(mask("example.com"));
    expect(filter.censor("www.example.com")).toBe(mask("www.example.com"));
    expect(filter.censor("sub.domain.co.uk/path")).toBe(
      mask("sub.domain.co.uk/path"),
    );
    expect(filter.censor("bit.ly/abc123")).toBe(mask("bit.ly/abc123"));
    expect(filter.censor("goo.gl/test")).toBe(mask("goo.gl/test"));
    expect(filter.censor("t.me/example")).toBe(mask("t.me/example"));
    expect(filter.censor("discord.gg/example")).toBe(
      mask("discord.gg/example"),
    );
    expect(filter.censor("example.com/")).toBe(mask("example.com/"));
    expect(filter.censor("example.com/path\u200b, next")).toBe(
      `${mask("example.com/path")}\u200b, next`,
    );
    expect(filter.censor("example.com./admin")).toBe(
      mask("example.com./admin"),
    );
    expect(filter.censor("example.com.:443/admin")).toBe(
      mask("example.com.:443/admin"),
    );
    expect(filter.censor("example.com:443.next")).toBe(
      `${mask("example.com:443")}.next`,
    );
    expect(filter.censor("example.com:443?next")).toBe(
      mask("example.com:443?next"),
    );
    expect(filter.censor("example.com:80, next")).toBe(
      `${mask("example.com:80")}, next`,
    );
    expect(filter.censor("example.com:80\u200b, next")).toBe(
      `${mask("example.com:80")}\u200b, next`,
    );
    expect(filter.censor("example.com:80) next")).toBe(
      `${mask("example.com:80")}) next`,
    );
    expect(filter.censor("example.com. next")).toBe(
      `${mask("example.com")}. next`,
    );
    expect(filter.censor("example.com. store")).toBe(
      `${mask("example.com")}. store`,
    );
    expect(filter.censor("example.com a")).toBe(`${mask("example.com")} a`);
    expect(filter.censor("foo.com x")).toBe(`${mask("foo.com")} x`);
    expect(filter.censor("example.com\u200b. next")).toBe(
      `${mask("example.com")}\u200b. next`,
    );
    expect(filter.censor("example.com\u200b. store")).toBe(
      `${mask("example.com")}\u200b. store`,
    );
    expect(filter.censor("example.com\u200b,next")).toBe(
      `${mask("example.com")}\u200b,next`,
    );
    expect(filter.censor("example.com\u200b!next")).toBe(
      `${mask("example.com")}\u200b!next`,
    );
    expect(filter.censor("example.com\u200bnext")).toBe(
      `${mask("example.com")}\u200bnext`,
    );
    expect(filter.censor("example.com/path,\u200bthen")).toBe(
      `${mask("example.com/path")},\u200bthen`,
    );
    expect(filter.censor("example.com:support")).toBe(
      `${mask("example.com")}:support`,
    );
    expect(filter.censor("example.com:123support")).toBe(
      `${mask("example.com")}:123support`,
    );
    expect(filter.censor("example.com:123support?x")).toBe(
      `${mask("example.com")}:123support?x`,
    );
    expect(filter.censor("example.com:123-support")).toBe(
      `${mask("example.com")}:123-support`,
    );
    expect(filter.censor("example.com:123_support")).toBe(
      `${mask("example.com")}:123_support`,
    );
    expect(filter.censor("example.com:8\u200b0support")).toBe(
      `${mask("example.com")}:8\u200b0support`,
    );
    expect(filter.censor("example.com's")).toBe(`${mask("example.com")}'s`);
    expect(filter.censor("example.com’s")).toBe(`${mask("example.com")}’s`);
    expect(filter.censor("example.com-like")).toBe(
      `${mask("example.com")}-like`,
    );
    expect(filter.censor("example.com--test")).toBe(
      `${mask("example.com")}--test`,
    );
  });

  it("censors defanged dots", () => {
    expect(filter.censor("example[.]com")).toBe(mask("example[.]com"));
    expect(filter.censor("example dot com")).toBe(mask("example dot com"));
    expect(filter.censor("go to dot com now")).toBe(
      `go ${mask("to dot com")} now`,
    );
    expect(filter.censor("example d0t com")).toBe(mask("example d0t com"));
    expect(filter.censor("example точка com")).toBe(mask("example точка com"));
    expect(filter.censor("the dotcom bubble")).toBe("the dotcom bubble");
    expect(filter.censor("not dotorg")).toBe("not dotorg");
    expect(filter.censor("hello dotnet now")).toBe("hello dotnet now");
  });

  it("censors links split by separators and spaces", () => {
    const input = "h t t p : / / e x a m p l e . c o m";
    expect(filter.censor(input)).toBe(mask(input));
    expect(filter.censor("go exa mple.com now")).toBe(
      `go ${mask("exa mple.com")} now`,
    );
    expect(filter.censor("go ex ample dot com now")).toBe(
      `go ${mask("ex ample dot com")} now`,
    );
    expect(filter.censor("please example.com")).toBe(
      `please ${mask("example.com")}`,
    );
    expect(filter.censor("and example.com")).toBe(`and ${mask("example.com")}`);
    expect(filter.censor("please e\u200bxample.com")).toBe(
      `please ${mask("e\u200bxample.com")}`,
    );
  });

  it("keeps current split-path behavior after a spaced host", () => {
    const input = "go h t t p : / / e x a m p l e . c o m / p a t h now";
    expect(filter.censor(input)).toBe(
      `go ${mask("h t t p : / / e x a m p l e . c o m")} / p a t h now`,
    );
  });

  it("handles mixed latin/cyrillic lookalikes in host", () => {
    const input = "hxxp://еxample.cоm";
    expect(filter.censor(input)).toBe(mask(input));
  });

  it("keeps zero-width marks inside host labels", () => {
    expect(filter.censor("go exa\u200bmple.com now")).toBe(
      `go ${mask("exa\u200bmple.com")} now`,
    );
    expect(filter.censor("go https://exa\u200bmple.com/path now")).toBe(
      `go ${mask("https://exa\u200bmple.com/path")} now`,
    );
  });

  it("locks current uppercase TLD behavior", () => {
    expect(filter.censor("go EXAMPLE.COM now")).toBe(
      `go ${mask("EXAMPLE.COM")} now`,
    );
  });

  it("does not censor neutral non-url text", () => {
    const input = "welcome to sample text and enjoy the canvas";
    expect(filter.censor(input)).toBe(input);
  });

  it("preserves input length and is idempotent", () => {
    const input =
      "check https://example.com and h t t p : / / e x a m p l e . c o m";
    const once = filter.censor(input);
    const twice = filter.censor(once);
    expect(once.length).toBe(input.length);
    expect(twice).toBe(once);
  });

  it("preserves UTF-16 length for astral code points inside URLs", () => {
    const input = "go http://😀.com/ now";
    const output = filter.censor(input);
    expect(output).toBe(`go ${"*".repeat("http://😀.com/".length)} now`);
    expect(output.length).toBe(input.length);

    const customBmp = createUrlFilter({ maskChar: "#" }).censor(input);
    expect(customBmp).toBe(`go ${"#".repeat("http://😀.com/".length)} now`);
    expect(customBmp.length).toBe(input.length);

    const custom = createUrlFilter({ maskChar: "😀" }).censor(
      "go example.com now",
    );
    expect(custom).toBe(`go ${mask("example.com")} now`);
    expect(custom.length).toBe("go example.com now".length);
  });

  it("handles long non-url input without excessive scanning", () => {
    const punctuation = ".".repeat(10_000);
    const letters = "a".repeat(10_000);
    const dotted = "a.".repeat(5_000);
    expect(filter.censor(punctuation)).toBe(punctuation);
    expect(filter.censor(letters)).toBe(letters);
    expect(filter.censor(dotted)).toBe(dotted);
  });

  it("supports custom tld list and custom mask char", () => {
    const f = createUrlFilter({ tlds: ["internal"], maskChar: "#" });
    expect(f.censor("svc.internal")).toBe(mask("svc.internal", "#"));
    expect(f.censor("example.com")).toBe("example.com");
  });

  it("normalizes custom uppercase TLDs and preserves path punctuation behavior", () => {
    const f = createUrlFilter({ tlds: ["INTERNAL"] });
    expect(f.censor("go EXAMPLE.INTERNAL now")).toBe(
      `go ${mask("EXAMPLE.INTERNAL")} now`,
    );
    expect(f.censor("go example.internal/path?x=1#y.")).toBe(
      `go ${mask("example.internal/path?x=1#y")}.`,
    );
  });
});

describe("explicit URL improvements", () => {
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
