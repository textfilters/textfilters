import {
  extendTimeSuffixEnd,
  getLeadingTimeEnd,
  getMinuteAfterTimeEnd,
  getSecondAfterTimeEnd,
  getSignedLongitudeEnd,
  hasDayFirstDatePrefix,
  hasMonthFirstDatePrefix,
  hasYearFirstDatePrefix,
  isCoordinateLike,
  isDateTimeLike,
  isValidTimeParts,
  readVisibleDigitGroupForward,
  separatorHas,
} from "./date-time.js";
export {
  extendTimeSuffixEnd,
  getLeadingTimeEnd,
  getMinuteAfterTimeEnd,
  getSecondAfterTimeEnd,
  getSignedLongitudeEnd,
  hasDayFirstDatePrefix,
  hasMonthFirstDatePrefix,
  hasYearFirstDatePrefix,
  isValidTimeParts,
  separatorHas,
};
import {
  isWhitespaceSeparator,
  previousContent,
  previousVisible,
} from "./boundaries.js";
import { isValidPhoneGroups } from "./phone-groups.js";
import { type TextMeta, WHITESPACE_RE } from "./meta.js";

const isIpv4Like = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  groups.length === 4 &&
  separators.slice(0, 3).every((separator) => separator === ".") &&
  groups.every((group) => {
    const value = Number(group);
    return group.length >= 1 && group.length <= 3 && value >= 0 && value <= 255;
  });

const isCidrLength = (value: string | undefined): boolean => {
  if (value === undefined || value.length < 1 || value.length > 2) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 32;
};

// Thousands groups may be punctuation- or whitespace-separated, but a single
// leading 7/8 with 3-digit chunks is still a common RU phone shape.
const isThousandsLike = (
  groups: readonly string[],
  separators: readonly string[],
): boolean => {
  const hasDecimalFraction =
    groups.length >= 3 &&
    groups.slice(1, -1).every((group) => group.length === 3) &&
    groups[groups.length - 1]?.length === 2;
  if (
    groups.length < 2 ||
    groups[0] === undefined ||
    groups[0].length < 1 ||
    groups[0].length > 3 ||
    (!groups.slice(1).every((group) => group.length === 3) &&
      !hasDecimalFraction)
  ) {
    return false;
  }

  const actualSeparators = separators.slice(0, Math.max(groups.length - 1, 0));
  const decimalAmountSeparated =
    hasDecimalFraction &&
    actualSeparators
      .slice(0, -1)
      .every((separator) => separator === actualSeparators[0]) &&
    separatorHas(actualSeparators[0], ".,") &&
    separatorHas(actualSeparators[actualSeparators.length - 1], ".,") &&
    actualSeparators[actualSeparators.length - 1] !== actualSeparators[0];
  const whitespaceSeparated = actualSeparators.every((separator) =>
    isWhitespaceSeparator(separator),
  );
  const punctuationSeparated = actualSeparators.every((separator) =>
    separatorHas(separator, ",."),
  );
  const hasPhoneCountryCodeShape = /^[78]$/u.test(groups[0]);
  return (
    (punctuationSeparated || whitespaceSeparated || decimalAmountSeparated) &&
    !hasPhoneCountryCodeShape
  );
};

const STRUCTURED_FALSE_POSITIVES = {
  coordinate: "coordinate",
  datetime: "datetime",
  ipv4: "ipv4",
  thousands: "thousands",
} as const;

type StructuredFalsePositive =
  (typeof STRUCTURED_FALSE_POSITIVES)[keyof typeof STRUCTURED_FALSE_POSITIVES];

export const getStructuredFalsePositive = (
  groups: readonly string[],
  separators: readonly string[],
  options: { readonly hasPlus: boolean },
): StructuredFalsePositive | null => {
  if (isCoordinateLike(groups, separators)) {
    return STRUCTURED_FALSE_POSITIVES.coordinate;
  }
  if (options.hasPlus) return null;
  if (isDateTimeLike(groups, separators))
    return STRUCTURED_FALSE_POSITIVES.datetime;
  if (isIpv4Like(groups, separators)) return STRUCTURED_FALSE_POSITIVES.ipv4;
  if (isThousandsLike(groups, separators)) {
    return STRUCTURED_FALSE_POSITIVES.thousands;
  }
  return null;
};

export const isClearPhoneSuffix = (groups: readonly string[]): boolean => {
  if (groups.length === 1) return groups[0]?.length >= 10;

  const first = groups[0] ?? "";
  const rest = groups.slice(1);
  if (/^[78][0-9]{3}$/u.test(first)) {
    return rest.every((group) => group.length >= 2 && group.length <= 3);
  }
  if (/^[78]$/u.test(first) && rest.length >= 3) {
    return rest.every((group) => group.length >= 2 && group.length <= 3);
  }
  return false;
};

export const isLocalGroupedPhoneSuffix = (groups: readonly string[]): boolean =>
  groups.length === 3 &&
  groups[0]?.length === 3 &&
  groups[1]?.length === 3 &&
  groups[2]?.length === 4;

export const isRecoverablePhoneSuffix = (groups: readonly string[]): boolean =>
  isClearPhoneSuffix(groups) || isLocalGroupedPhoneSuffix(groups);

export const getLeadingDecimalPhoneSuffixStart = (
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
): number | null => {
  // Preserve decimal-like prefixes such as "55.75" and "55,75" while letting a
  // clear phone suffix after the number be censored from its own first group.
  if (groups.length < 3 || !separatorHas(separators[0], ".,")) return null;
  const suffixGroups = groups.slice(2);
  const suffixStart = groupStarts[2];
  if (suffixStart === undefined) return null;
  if (
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    !getStructuredFalsePositive(suffixGroups, separators.slice(2), {
      hasPlus: false,
    })
  ) {
    return suffixStart;
  }
  return null;
};

export const getLeadingFormattedAmountPhoneSuffixStart = (
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
): number | null => {
  if (
    groups.length < 4 ||
    groups[0] === undefined ||
    groups[0].length < 1 ||
    groups[0].length > 3 ||
    groups[1]?.length !== 3 ||
    groups[2]?.length !== 2 ||
    (!(separatorHas(separators[0], ",") && separatorHas(separators[1], ".")) &&
      !(separatorHas(separators[0], ".") && separatorHas(separators[1], ",")))
  ) {
    return null;
  }

  const suffixGroups = groups.slice(3);
  const suffixStart = groupStarts[3];
  if (suffixStart === undefined) return null;
  if (
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    !getStructuredFalsePositive(suffixGroups, separators.slice(3), {
      hasPlus: false,
    })
  ) {
    return suffixStart;
  }
  return null;
};

export const getLeadingVersionPhoneSuffixStart = (
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
): number | null => {
  // Preserve dotted versions such as "1.2.3" and rescan the clear phone suffix
  // instead of allowing the version fields to become a phone prefix.
  const isVersionPart = (group: string | undefined): boolean =>
    group !== undefined && group.length >= 1 && group.length <= 3;
  if (
    groups.length < 4 ||
    !isVersionPart(groups[0]) ||
    !isVersionPart(groups[1]) ||
    !isVersionPart(groups[2]) ||
    !separatorHas(separators[0], ".") ||
    !separatorHas(separators[1], ".")
  ) {
    return null;
  }

  const suffixGroups = groups.slice(3);
  const suffixStart = groupStarts[3];
  if (suffixStart === undefined) return null;
  if (
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    !getStructuredFalsePositive(suffixGroups, separators.slice(3), {
      hasPlus: false,
    })
  ) {
    return suffixStart;
  }
  return null;
};

const PHONE_LABELS = new Set([
  "call",
  "mobile",
  "phone",
  "tel",
  "telegram",
  "tg",
  "wa",
  "whatsapp",
  "тел",
  "телефон",
]);

export const isUuidNumericSuffix = (
  meta: TextMeta,
  start: number,
  end: number,
  groups: readonly string[],
): boolean => {
  if (groups.length !== 1 || !/^[0-9]{12}$/u.test(groups[0] ?? "")) {
    return false;
  }
  const prefix = meta.raw.slice(Math.max(0, start - 24), start).join("");
  const suffix = meta.raw.slice(start, end).join("");
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-$/iu.test(prefix) &&
    /^[0-9]{12}$/u.test(suffix)
  );
};

export const isLabeledBookIdentifier = (
  meta: TextMeta,
  start: number,
  groups: readonly string[],
): boolean => {
  if (groups.length !== 1 || !/^[0-9]{13}$/u.test(groups[0] ?? "")) {
    return false;
  }

  const prefix = meta.raw.slice(Math.max(0, start - 32), start).join("");
  return /(?:^|[^\p{L}\p{N}_])(?:isbn(?:[-\s]?1[03])?|ean(?:[-\s]?13)?)[\s:#-]*$/iu.test(
    prefix,
  );
};

export const hasPhoneLabelBefore = (meta: TextMeta, pos: number): boolean => {
  let cursor = previousContent(meta, pos - 1);
  if (cursor < 0 || !meta.wordChar[cursor]) return false;

  const chars: string[] = [];
  while (cursor >= 0 && meta.wordChar[cursor]) {
    chars.unshift(meta.raw[cursor]);
    cursor = previousVisible(meta, cursor - 1);
  }
  return PHONE_LABELS.has(chars.join(""));
};

const readVisibleDigitGroupBackward = (
  meta: TextMeta,
  endExclusive: number,
): { readonly value: string; readonly before: number } | null => {
  let pos = previousVisible(meta, endExclusive - 1);
  const digits: string[] = [];
  while (pos >= 0 && meta.digit[pos]) {
    digits.unshift(meta.raw[pos]);
    pos = previousVisible(meta, pos - 1);
  }
  return digits.length > 0 ? { value: digits.join(""), before: pos } : null;
};

export const getIpv4PortEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  // A scan starting on the first port digit after "10.0.0.1:" looks like a
  // time field ("1:44"). Skip only the port so the following phone can rescan.
  let colon = start - 1;
  while (colon >= 0 && meta.zeroWidth[colon]) colon--;
  if (colon < 0 || meta.raw[colon] !== ":") return null;

  let groupEnd = colon;
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) {
    const group = readVisibleDigitGroupBackward(meta, groupEnd);
    if (!group) return null;
    groups.unshift(group.value);
    if (i === 3) break;
    if (group.before < 0 || meta.raw[group.before] !== ".") return null;
    groupEnd = group.before;
  }

  if (!isIpv4Like(groups, [".", ".", "."])) return null;

  const port = readVisibleDigitGroupForward(meta, start);
  if (!port || port.value.length > 5) return null;
  const value = Number(port.value);
  return Number.isInteger(value) && value <= 65535 ? port.end : null;
};

export const getIpv6TailFieldEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  let separator = start - 1;
  while (separator >= 0 && meta.zeroWidth[separator]) separator--;
  if (separator < 0 || meta.raw[separator] !== ":") return null;

  let cursor = separator - 1;
  let colonCount = 1;
  let hasHex = false;
  while (cursor >= 0 && !WHITESPACE_RE.test(meta.raw[cursor])) {
    const raw = meta.raw[cursor];
    if (meta.zeroWidth[cursor]) {
      cursor--;
      continue;
    }
    if (raw === ":") {
      colonCount++;
      cursor--;
      continue;
    }
    if (/^[0-9a-f]$/iu.test(raw)) {
      hasHex = true;
      cursor--;
      continue;
    }
    return null;
  }
  if (colonCount < 2 || !hasHex) return null;

  const group = readVisibleDigitGroupForward(meta, start);
  return group !== null && group.value.length <= 4 ? group.end : null;
};

export const getStructuredPrefixEnd = (
  groups: readonly string[],
  separators: readonly string[],
  groupEnds: readonly number[],
): number | null => {
  if (isIpv4Like(groups.slice(0, 4), separators.slice(0, 3))) {
    if (
      separatorHas(separators[3], "/") &&
      isCidrLength(groups[4]) &&
      groupEnds[4] !== undefined
    ) {
      return groupEnds[4];
    }
    return groupEnds[3] ?? null;
  }
  return null;
};
