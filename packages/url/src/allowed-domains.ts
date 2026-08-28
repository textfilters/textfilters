import { DOT_CHAR_SET } from "./chars.js";
import {
  countCodePoints,
  MAX_HOST_LABEL_CODE_POINTS,
  MAX_HOSTNAME_CODE_POINTS,
  type DomainMatch,
  type TextMeta,
} from "./meta.js";
import { lowerNfkc, stripZeroWidth } from "./normalize.js";

export const EMPTY_ALLOWED_DOMAINS: ReadonlySet<string> = new Set();

const normalizeDomainLiteral = (value: string): string | null => {
  const normalized = Array.from(
    stripZeroWidth(lowerNfkc(String(value ?? "").trim())),
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
    countCodePoints(domain) > MAX_HOSTNAME_CODE_POINTS ||
    /[\s/:@?#\\[\]]/u.test(domain) ||
    isIpv4Address ||
    labels.some(
      (label) =>
        label.length === 0 ||
        countCodePoints(label) > MAX_HOST_LABEL_CODE_POINTS ||
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
  return domains.size ? domains : EMPTY_ALLOWED_DOMAINS;
};

export const isAllowedDomain = (
  meta: TextMeta,
  domain: DomainMatch,
  allowedDomains: ReadonlySet<string>,
  firstLabelStart: number = domain.labels[0]?.start ?? domain.start,
): boolean => {
  if (allowedDomains.size === 0) return false;
  const hostname = domain.labels
    .map((label, index) => {
      const start = index === 0 ? firstLabelStart : label.start;
      const nextLabel = domain.labels[index + 1];
      let sourceLabel = "";
      for (let cursor = start; cursor < label.end; cursor++) {
        const source = meta.codePoints[cursor] ?? "";
        const symbol = meta.symbol[cursor] ?? "";
        if (
          meta.alphaNum[cursor] ||
          symbol === "-" ||
          symbol === "_" ||
          /[\p{M}\p{S}]/u.test(source)
        ) {
          sourceLabel += source;
        }
      }
      if (nextLabel) {
        // Preserve hostname join syntax skipped by the dot parser. Otherwise
        // `trusted-.com` and `trusted_.com` collapse to an allowlisted
        // `trusted.com` even though the parsed source hosts are distinct.
        for (let cursor = label.end; cursor < nextLabel.start; cursor++) {
          if (meta.raw[cursor] === "-" || meta.raw[cursor] === "_") {
            sourceLabel += meta.raw[cursor];
          }
        }
      } else {
        // A final joiner can sit just outside the selected label range in an
        // explicit authority. Keep it in the trust comparison while ignoring
        // zero-width formatting that exact allowlists intentionally normalize.
        let cursor = label.end;
        while (
          meta.zeroWidth[cursor] ||
          meta.raw[cursor] === "-" ||
          meta.raw[cursor] === "_"
        ) {
          if (meta.raw[cursor] === "-" || meta.raw[cursor] === "_") {
            sourceLabel += meta.raw[cursor];
          }
          cursor++;
        }
      }
      return stripZeroWidth(lowerNfkc(sourceLabel));
    })
    .join(".");
  return allowedDomains.has(hostname);
};
