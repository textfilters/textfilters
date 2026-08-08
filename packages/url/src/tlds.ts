import { lowerNfkc } from "@textfilters/core";

import { IANA_TLDS } from "./tld-data.js";

// Bare domains use the complete embedded IANA root-zone snapshot. Explicit
// schemes still accept unknown TLDs because the scheme is stronger evidence.
export const DEFAULT_TLDS = IANA_TLDS;
export const DEFAULT_TLD_SET: ReadonlySet<string> = new Set(DEFAULT_TLDS);

// Ambiguous whitespace-wrapped dots may extend an already complete host only
// through the compact compatibility set that historically carried that
// behavior. Other delegated TLD words remain detectable as direct domains.
export const DEFAULT_TLD_CONTINUATIONS = [
  "ru",
  "рф",
  "com",
  "biz",
  "net",
  "org",
  "io",
  "gg",
  "me",
  "co",
  "cc",
  "uk",
  "ly",
  "gl",
  "tv",
  "dev",
  "app",
  "xyz",
  "online",
  "site",
  "link",
  "top",
  "shop",
  "store",
  "pro",
  "info",
  "su",
  "ua",
  "by",
  "kz",
] as const;

export const normalizeTlds = (
  rawList: readonly string[] | undefined,
): string[] => {
  // Preserve caller order while removing empty and duplicate normalized values.
  const source = Array.isArray(rawList) ? rawList : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of source) {
    const tld = lowerNfkc(String(item ?? "").trim());
    if (!tld || seen.has(tld)) continue;
    seen.add(tld);
    out.push(tld);
  }
  return out;
};
