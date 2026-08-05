import { describe, expect, it } from "vitest";

import {
  createUrlFilter,
  filter,
  URL_FILTER_NAME,
  urlFilter,
} from "../src/index.js";
import { mask } from "./helpers.js";

// These tests double as compatibility fixtures for parser boundary decisions:
// small URL-obfuscation tweaks can otherwise create broad false positives.
describe("compatibility behavior", () => {
  it("exposes old-compatible public API", () => {
    expect(filter.name).toBe(URL_FILTER_NAME);
    expect(urlFilter()).toEqual(
      expect.objectContaining({ name: URL_FILTER_NAME }),
    );
  });

  it("normalizes empty and non-string public input through core", () => {
    expect(filter.censor("")).toBe("");
    expect(filter.censor(null)).toBe("");
    expect(filter.censor(undefined)).toBe("");
    expect(filter.censor(12345)).toBe("12345");
    expect(filter.censor({ toString: () => "https://example.com" })).toBe(
      mask("https://example.com"),
    );
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
    expect(filter.censor("freeaccount.biz")).toBe(mask("freeaccount.biz"));
    expect(filter.censor("FREEACCOUNT.BIZ/path")).toBe(
      mask("FREEACCOUNT.BIZ/path"),
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
    expect(f.censor("freeaccount.biz")).toBe("freeaccount.biz");
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

  it("allows exact configured domains across URL forms", () => {
    const f = createUrlFilter({ allowedDomains: [" TRUSTED.COM. "] });

    expect(f.censor("visit trusted.com/path now")).toBe(
      "visit trusted.com/path now",
    );
    expect(f.censor("visit https://trusted.com:443/path?q=1 now")).toBe(
      "visit https://trusted.com:443/path?q=1 now",
    );
    expect(f.censor("visit https://user:pass@trusted.com/path now")).toBe(
      "visit https://user:pass@trusted.com/path now",
    );
    expect(f.censor("visit hxxp[:]//trusted[.]com/path now")).toBe(
      "visit hxxp[:]//trusted[.]com/path now",
    );
    expect(f.censor("visit https://trusted [.] com/path now")).toBe(
      "visit https://trusted [.] com/path now",
    );
    expect(f.censor("visit https://trusted . com/path now")).toBe(
      "visit https://trusted . com/path now",
    );
    expect(f.censor("visit trusted dot com now")).toBe(
      "visit trusted dot com now",
    );
    expect(f.censor("visit trusted d o t com now")).toBe(
      "visit trusted d o t com now",
    );
    expect(
      f.censor("visit trusted \u0442\u043e\u0447\u043a\u0430 com now"),
    ).toBe("visit trusted \u0442\u043e\u0447\u043a\u0430 com now");
    expect(f.censor("visit trusted\u3002com now")).toBe(
      "visit trusted\u3002com now",
    );
    expect(f.censor("visit https://tru\u200bsted.com/path now")).toBe(
      "visit https://tru\u200bsted.com/path now",
    );
    expect(f.censor("visit https://tru\ufb06ed.com/path now")).toBe(
      "visit https://tru\ufb06ed.com/path now",
    );
    expect(f.censor("visit trusted.com./admin now")).toBe(
      "visit trusted.com./admin now",
    );

    const split = createUrlFilter({
      allowedDomains: ["example.com", "example.ai"],
    });
    expect(split.censor("visit exa mple.com now")).toBe(
      "visit exa mple.com now",
    );
    expect(split.censor("visit ex ample dot com now")).toBe(
      "visit ex ample dot com now",
    );
    expect(split.censor("visit https://exa mple.ai/path now")).toBe(
      "visit https://exa mple.ai/path now",
    );
  });

  it("keeps domain allowlists exact and hostname-based", () => {
    const f = createUrlFilter({ allowedDomains: ["trusted.com"] });
    const homograph = "https://tru\u0455ted.com/path";

    expect(f.censor("www.trusted.com")).toBe(mask("www.trusted.com"));
    expect(f.censor("nottrusted.com")).toBe(mask("nottrusted.com"));
    expect(f.censor("trusted.com.evil.com")).toBe(mask("trusted.com.evil.com"));
    expect(f.censor("https://trusted.com@evil.com/path")).toBe(
      mask("https://trusted.com@evil.com/path"),
    );
    expect(f.censor("https://evil.com@trusted.com/path")).toBe(
      "https://evil.com@trusted.com/path",
    );
    expect(f.censor(homograph)).toBe(mask(homograph));
  });

  it("normalizes Unicode allowed domains without broadening scripts", () => {
    const f = createUrlFilter({
      allowedDomains: [
        " \u041f\u0420\u0418\u041c\u0415\u0420\u3002\u0420\u0424. ",
      ],
    });

    expect(
      f.censor(
        "visit \u043f\u0440\u0438\u043c\u0435\u0440.\u0440\u0444/path now",
      ),
    ).toBe("visit \u043f\u0440\u0438\u043c\u0435\u0440.\u0440\u0444/path now");
    expect(f.censor("visit primer.\u0440\u0444/path now")).toBe(
      `visit ${mask("primer.\u0440\u0444/path")} now`,
    );
    expect(f.censor("visit xn--e1afmkfd.xn--p1ai now")).toBe(
      `visit ${mask("xn--e1afmkfd.xn--p1ai")} now`,
    );
  });

  it("ignores invalid allowed-domain entries and masks mixed blocked URLs", () => {
    const invalid = createUrlFilter({
      allowedDomains: [
        "",
        "*.trusted.com",
        "https://trusted.com",
        "trusted-.com",
        "127.0.0.1",
        "localhost",
      ],
    });
    expect(invalid.censor("trusted.com")).toBe(mask("trusted.com"));
    expect(invalid.censor("https://trusted-.com/path")).toBe(
      mask("https://trusted-.com/path"),
    );
    expect(invalid.censor("https://127.0.0.1/path")).toBe(
      mask("https://127.0.0.1/path"),
    );
    expect(invalid.censor("http://localhost:3000/path")).toBe(
      mask("http://localhost:3000/path"),
    );

    const f = createUrlFilter({ allowedDomains: ["trusted.com"] });
    expect(f.censor("trusted.com and example.org")).toBe(
      `trusted.com and ${mask("example.org")}`,
    );
    expect(f.censor("https://trusted.com:80example.org")).toBe(
      `https://trusted.com:80${mask("example.org")}`,
    );
  });
});
