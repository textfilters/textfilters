import { normalizeHostText } from "./host-normalization.js";
import { IANA_TLDS } from "./tld-data.js";

// Keep exact membership and lookalike matching as separate policy inputs. They
// share the current compact baseline, while either policy can evolve without
// implicitly broadening the other.
export const DEFAULT_LOOKALIKE_TLDS = [
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

export const DEFAULT_TLDS: readonly string[] = IANA_TLDS;

export const normalizeTlds = (
  rawList: readonly string[] | undefined,
): readonly string[] => {
  // Preserve caller order while removing empty and duplicate normalized values.
  if (!Array.isArray(rawList) || rawList.length === 0) return DEFAULT_TLDS;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of rawList) {
    const tld = normalizeHostText(String(item ?? "").trim());
    if (!tld || seen.has(tld)) continue;
    seen.add(tld);
    out.push(tld);
  }
  return out.length ? out : DEFAULT_TLDS;
};
