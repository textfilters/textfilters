import { DOT_CHAR_SET } from "./chars.js";
import {
  normalizeHostText,
  stripIgnorableHostFormatting,
} from "./host-normalization.js";
import type { DomainMatch, TextMeta } from "./meta.js";

export const EMPTY_ALLOWED_DOMAINS: ReadonlySet<string> = new Set();
const NORMALIZED_ALLOWED_DOMAIN_SETS = new WeakSet<ReadonlySet<string>>([
  EMPTY_ALLOWED_DOMAINS,
]);

const normalizeDomainLiteral = (value: unknown): string | null => {
  const normalized = Array.from(
    normalizeHostText(stripIgnorableHostFormatting(String(value ?? "").trim())),
    (char) => (DOT_CHAR_SET.has(char) ? "." : char),
  ).join("");
  const domain = normalized.endsWith(".")
    ? normalized.slice(0, -1)
    : normalized;
  const labels = domain.split(".");
  const isIpv4Address =
    labels.length === 4 &&
    labels.every((label) => /^\d{1,3}$/u.test(label) && Number(label) <= 255);

  if (
    !domain ||
    labels.length < 2 ||
    Array.from(domain).length > 253 ||
    /[\s/:@?#\\[\]]/u.test(domain) ||
    isIpv4Address ||
    labels.some(
      (label) =>
        label.length === 0 ||
        Array.from(label).length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !/^[\p{L}\p{N}\p{M}\p{S}_-]+$/u.test(label),
    )
  ) {
    return null;
  }

  return domain;
};

export const normalizeAllowedDomains = (
  rawList: readonly string[] | undefined,
): ReadonlySet<string> => {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return EMPTY_ALLOWED_DOMAINS;
  }

  const domains = new Set<string>();
  for (const item of rawList) {
    const domain = normalizeDomainLiteral(item);
    if (domain) domains.add(domain);
  }
  if (domains.size === 0) return EMPTY_ALLOWED_DOMAINS;
  NORMALIZED_ALLOWED_DOMAIN_SETS.add(domains);
  return domains;
};

export const normalizeAllowedDomainSet = (
  rawSet: ReadonlySet<string>,
): ReadonlySet<string> =>
  NORMALIZED_ALLOWED_DOMAIN_SETS.has(rawSet)
    ? rawSet
    : normalizeAllowedDomains(Array.from(rawSet));

export const isAllowedDomain = (
  meta: TextMeta,
  domain: DomainMatch,
  allowedDomains: ReadonlySet<string>,
  firstLabelStart: number = domain.labels[0]?.start ?? domain.start,
): boolean => {
  if (allowedDomains.size === 0) return false;
  if (domain.labels.some((label) => label.hasUnconsumedLabelMark)) return false;
  const hostname = domain.labels
    .map((label, index) => {
      const start = index === 0 ? firstLabelStart : label.start;
      let source = "";
      for (let cursor = start; cursor < label.end; cursor++) {
        const codePoint = meta.codePoints[cursor] ?? "";
        const symbol = meta.symbol[cursor] ?? "";
        if (
          meta.alphaNum[cursor] ||
          symbol === "-" ||
          symbol === "_" ||
          /[\p{M}\p{S}]/u.test(codePoint)
        ) {
          source += codePoint;
        }
      }
      return normalizeHostText(stripIgnorableHostFormatting(source));
    })
    .join(".");
  return allowedDomains.has(hostname);
};
