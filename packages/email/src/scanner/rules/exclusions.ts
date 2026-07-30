import { createEmailTextMeta } from "../../normalization.js";
import {
  TOKEN_VALUE,
  type ScannerExclusions,
  type ScannerOptions,
} from "../core/types.js";

const normalizeExclusionValue = (value: string): string => {
  // Exclusions compare against scanner candidates, so they use the same
  // lowercase NFKC normalization and zero-width stripping as matching.
  const meta = createEmailTextMeta(value);
  return meta.normalized
    .filter((_, index) => !meta.zeroWidth[index])
    .join("")
    .trim();
};

const normalizeDomainExclusion = (value: string): string => {
  const normalized = normalizeExclusionValue(value);
  return normalized.startsWith(TOKEN_VALUE.atSymbol)
    ? normalized.slice(TOKEN_VALUE.atSymbol.length)
    : normalized;
};

const toExclusionSet = (
  values: readonly string[] | undefined,
  normalize: (value: string) => string = normalizeExclusionValue,
): ReadonlySet<string> =>
  new Set(
    (values ?? [])
      .map((value) => normalize(value))
      .filter((value) => value.length > 0),
  );

export const createExclusionSets = (
  emails: readonly string[] | undefined,
  usernames: readonly string[] | undefined,
  domains: readonly string[] | undefined,
): ScannerExclusions => ({
  emails: toExclusionSet(emails),
  usernames: toExclusionSet(usernames),
  domains: toExclusionSet(domains, normalizeDomainExclusion),
});

const isExcludedDomain = (
  domain: string,
  excludedDomains: ReadonlySet<string>,
): boolean => {
  // Domain exclusions cover subdomains because a configured organization
  // domain should protect addresses under delegated hosts too.
  for (const excludedDomain of excludedDomains) {
    if (domain === excludedDomain) return true;
    if (domain.endsWith(`${TOKEN_VALUE.dotSymbol}${excludedDomain}`)) {
      return true;
    }
  }
  return false;
};

export const isExcludedAddress = (
  local: string,
  labels: readonly string[],
  options: ScannerOptions,
): boolean => {
  const domain = labels.join(TOKEN_VALUE.dotSymbol);
  const email = `${local}${TOKEN_VALUE.atSymbol}${domain}`;

  return (
    options.exclusions.emails.has(email) ||
    options.exclusions.usernames.has(local) ||
    isExcludedDomain(domain, options.exclusions.domains)
  );
};
