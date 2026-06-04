import { lowerNfkc } from "@textfilters/core";

// Default TLDs are intentionally small and domain-only; explicit schemes can
// accept unknown TLDs because the scheme is stronger URL evidence.
export const DEFAULT_TLDS = [
  "ru",
  "рф",
  "com",
  "net",
  "org",
  "io",
  "gg",
  "me",
  "co",
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
  const source =
    Array.isArray(rawList) && rawList.length ? rawList : DEFAULT_TLDS;
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
