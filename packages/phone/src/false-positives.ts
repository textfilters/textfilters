import {
  isWhitespaceSeparator,
  previousContent,
  previousVisible,
  skipZeroWidthForward,
} from "./boundaries.js";
import { isValidPhoneGroups } from "./phone-groups.js";
import { type TextMeta, WHITESPACE_RE } from "./meta.js";

const YEAR_GROUP_RE = /^(?:19|20)[0-9]{2}$/u;
const DAY_FIRST_YEAR_GROUP_RE = /^(?:(?:19|20)[0-9]{2}|[0-9]{2})$/u;

export const separatorHas = (
  separator: string | undefined,
  chars: string,
): boolean => Array.from(separator ?? "").some((ch) => chars.includes(ch));

const allZeroes = (value: string): boolean => /^[0]+$/u.test(value);

const isValidCoordinatePart = (
  whole: string | undefined,
  fraction: string | undefined,
  max: number,
): boolean => {
  if (!whole || !fraction) return false;
  if (fraction.length < 1 || fraction.length > 6) return false;
  const n = Number(whole);
  if (!Number.isInteger(n) || n < 0 || n > max) return false;
  return n < max || allZeroes(fraction);
};

const isCoordinateLike = (
  groups: readonly string[],
  separators: readonly string[],
): boolean => {
  const coordinateGroups =
    groups.length === 5 &&
    isWhitespaceSeparator(separators[3] ?? "") &&
    groups[4] !== undefined &&
    groups[4].length >= 1 &&
    groups[4].length <= 5
      ? groups.slice(0, 4)
      : groups;
  const coordinateSeparators =
    coordinateGroups === groups ? separators : separators.slice(0, 3);
  const coordinateSeparator = separators[1] ?? "";
  if (
    coordinateGroups.length !== 4 ||
    (coordinateGroups[0]?.length !== 1 && coordinateGroups[0]?.length !== 2) ||
    (coordinateGroups[2]?.length !== 1 &&
      coordinateGroups[2]?.length !== 2 &&
      coordinateGroups[2]?.length !== 3) ||
    !separatorHas(coordinateSeparators[0], ".,") ||
    !separatorHas(coordinateSeparators[2], ".,") ||
    // A real coordinate pair has a visible separator between latitude and longitude.
    (!separatorHas(coordinateSeparator, ",") &&
      !isWhitespaceSeparator(coordinateSeparator))
  ) {
    return false;
  }
  return (
    isValidCoordinatePart(coordinateGroups[0], coordinateGroups[1], 90) &&
    isValidCoordinatePart(coordinateGroups[2], coordinateGroups[3], 180)
  );
};

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const isValidDateParts = (
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
): boolean => {
  if (!year || !month || !day) return false;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  return (
    Number.isInteger(y) &&
    Number.isInteger(m) &&
    Number.isInteger(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
};

export const hasDayFirstDatePrefix = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  (groups[0]?.length === 1 || groups[0]?.length === 2) &&
  (groups[1]?.length === 1 || groups[1]?.length === 2) &&
  DAY_FIRST_YEAR_GROUP_RE.test(groups[2] ?? "") &&
  separatorHas(separators[0], "./-") &&
  separatorHas(separators[1], "./-") &&
  isValidDateParts(groups[2], groups[1], groups[0]);

export const hasMonthFirstDatePrefix = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  (groups[0]?.length === 1 || groups[0]?.length === 2) &&
  (groups[1]?.length === 1 || groups[1]?.length === 2) &&
  DAY_FIRST_YEAR_GROUP_RE.test(groups[2] ?? "") &&
  separatorHas(separators[0], "/-") &&
  separatorHas(separators[1], "/-") &&
  isValidDateParts(groups[2], groups[0], groups[1]);

export const hasYearFirstDatePrefix = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  groups[0]?.length === 4 &&
  YEAR_GROUP_RE.test(groups[0]) &&
  (groups[1]?.length === 1 || groups[1]?.length === 2) &&
  (groups[2]?.length === 1 || groups[2]?.length === 2) &&
  separatorHas(separators[0], "./-") &&
  separatorHas(separators[1], "./-") &&
  isValidDateParts(groups[0], groups[1], groups[2]);

const isDateTimeLike = (
  groups: readonly string[],
  separators: readonly string[],
): boolean => {
  if (groups.length < 4) return false;

  return (
    hasDayFirstDatePrefix(groups, separators) ||
    hasMonthFirstDatePrefix(groups, separators) ||
    hasYearFirstDatePrefix(groups, separators)
  );
};

export const isValidTimeParts = (
  hour: string | undefined,
  minute: string | undefined,
  separator: string | undefined,
): boolean => {
  if (
    !hour ||
    !minute ||
    hour.length < 1 ||
    hour.length > 2 ||
    minute.length !== 2
  ) {
    return false;
  }
  if (!separatorHas(separator, ":.")) return false;
  const h = Number(hour);
  const m = Number(minute);
  return (
    Number.isInteger(h) &&
    Number.isInteger(m) &&
    h >= 0 &&
    h <= 23 &&
    m >= 0 &&
    m <= 59
  );
};

interface DecimalRun {
  readonly whole: string;
  readonly fraction: string;
  readonly start: number;
  readonly end: number;
  readonly sign: string;
}

const readDecimalForward = (
  meta: TextMeta,
  start: number,
): DecimalRun | null => {
  let pos = start;
  let sign = "";
  if (meta.raw[pos] === "+" || meta.raw[pos] === "-") {
    sign = meta.raw[pos];
    pos++;
  }

  let whole = "";
  let fraction = "";
  let lastDigit = -1;
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) break;
    whole += meta.raw[pos];
    lastDigit = pos;
    pos++;
  }
  if (
    !whole ||
    pos >= meta.codePoints.length ||
    !separatorHas(meta.raw[pos], ".,")
  ) {
    return null;
  }

  pos++;
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) break;
    fraction += meta.raw[pos];
    lastDigit = pos;
    pos++;
  }

  return fraction ? { whole, fraction, start, end: lastDigit + 1, sign } : null;
};

const readDecimalBackward = (
  meta: TextMeta,
  endExclusive: number,
): DecimalRun | null => {
  let pos = previousContent(meta, endExclusive - 1);
  if (pos < 0 || !meta.digit[pos]) return null;

  const fractionChars: string[] = [];
  const fractionEnd = pos + 1;
  while (pos >= 0 && meta.digit[pos]) {
    fractionChars.unshift(meta.raw[pos]);
    pos = previousVisible(meta, pos - 1);
  }
  if (pos < 0 || !separatorHas(meta.raw[pos], ".,")) return null;

  pos = previousVisible(meta, pos - 1);
  const wholeChars: string[] = [];
  let wholeStart = pos;
  while (pos >= 0 && meta.digit[pos]) {
    wholeChars.unshift(meta.raw[pos]);
    wholeStart = pos;
    pos = previousVisible(meta, pos - 1);
  }

  let sign = "";
  let start = wholeStart;
  if (pos >= 0 && (meta.raw[pos] === "+" || meta.raw[pos] === "-")) {
    sign = meta.raw[pos];
    start = pos;
  }

  const whole = wholeChars.join("");
  const fraction = fractionChars.join("");
  return whole && fraction
    ? { whole, fraction, start, end: fractionEnd, sign }
    : null;
};

export const getSignedLongitudeEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  const longitude = readDecimalForward(meta, start);
  if (!longitude?.sign) return null;

  const separator = previousContent(meta, start - 1);
  if (separator < 0 || meta.raw[separator] !== ",") return null;

  const latitude = readDecimalBackward(meta, separator);
  if (
    !latitude ||
    !isValidCoordinatePart(latitude.whole, latitude.fraction, 90) ||
    !isValidCoordinatePart(longitude.whole, longitude.fraction, 180)
  ) {
    return null;
  }
  return longitude.end;
};

const readDigitsForward = (
  meta: TextMeta,
  start: number,
  count: number,
): { readonly value: string; readonly end: number } | null => {
  let value = "";
  let pos = start;
  while (pos < meta.codePoints.length && value.length < count) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) return null;
    value += meta.raw[pos];
    pos++;
  }
  return value.length === count ? { value, end: pos } : null;
};

const readDigitsBackward = (
  meta: TextMeta,
  endExclusive: number,
  count: number,
): { readonly value: string; readonly before: number } | null => {
  let pos = previousVisible(meta, endExclusive - 1);
  const digits: string[] = [];
  while (pos >= 0 && digits.length < count) {
    if (!meta.digit[pos]) return null;
    digits.unshift(meta.raw[pos]);
    pos = previousVisible(meta, pos - 1);
  }
  return digits.length === count
    ? { value: digits.join(""), before: pos }
    : null;
};

const readHourBeforeSeparator = (
  meta: TextMeta,
  separator: number,
): string | null => {
  const hourLast = previousVisible(meta, separator - 1);
  if (hourLast < 0 || !meta.digit[hourLast]) return null;

  const hourFirst = previousVisible(meta, hourLast - 1);
  if (hourFirst < 0 || !meta.digit[hourFirst]) return meta.raw[hourLast];

  const beforeHour = previousVisible(meta, hourFirst - 1);
  if (beforeHour >= 0 && meta.digit[beforeHour]) return null;
  return `${meta.raw[hourFirst]}${meta.raw[hourLast]}`;
};

const readCompactTimezoneEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  let pos = skipZeroWidthForward(meta, start);
  if (pos >= meta.codePoints.length || !separatorHas(meta.raw[pos], "+-")) {
    return null;
  }

  const hour = readDigitsForward(meta, pos + 1, 2);
  if (!hour) return null;
  const hourValue = Number(hour.value);
  if (!Number.isInteger(hourValue) || hourValue > 23) return null;

  pos = skipZeroWidthForward(meta, hour.end);
  if (pos < meta.codePoints.length && meta.raw[pos] === ":") {
    const minute = readDigitsForward(meta, pos + 1, 2);
    if (!minute) return null;
    const minuteValue = Number(minute.value);
    return Number.isInteger(minuteValue) && minuteValue <= 59
      ? minute.end
      : null;
  }

  const minute = readDigitsForward(meta, pos, 2);
  if (!minute) return hour.end;
  const minuteValue = Number(minute.value);
  return Number.isInteger(minuteValue) && minuteValue <= 59 ? minute.end : null;
};

export const extendTimeSuffixEnd = (
  meta: TextMeta,
  end: number,
  { allowFraction = false }: { readonly allowFraction?: boolean } = {},
): number => {
  let pos = end;
  if (allowFraction) {
    const separator = skipZeroWidthForward(meta, pos);
    if (
      separator < meta.codePoints.length &&
      separatorHas(meta.raw[separator], ".,")
    ) {
      const fraction = readVisibleDigitGroupForward(meta, separator + 1);
      if (fraction) pos = fraction.end;
    }
  }

  return readCompactTimezoneEnd(meta, pos) ?? pos;
};

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

export const getLeadingTimeEnd = (
  groups: readonly string[],
  separators: readonly string[],
  groupEnds: readonly number[],
): number | null => {
  if (groups.length < 3) return null;
  if (!isValidTimeParts(groups[0], groups[1], separators[0])) return null;
  if (
    groups[2]?.length === 2 &&
    separatorHas(separators[1], ":.") &&
    Number(groups[2]) >= 0 &&
    Number(groups[2]) <= 59
  ) {
    return groupEnds[2] ?? null;
  }
  return groupEnds[1] ?? null;
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

type JsonNumericMetadataKey = "cursor" | "serverTs";

interface JsonNumericMetadata {
  readonly key: JsonNumericMetadataKey;
  readonly keyStart: number;
  readonly quoted: boolean;
}

interface JsonMetadataObjectValidation {
  readonly end: number;
}

const JSON_WHITESPACE = new Set([" ", "\t", "\n", "\r"]);
const JSON_METADATA_OBJECT_CACHE = new WeakMap<
  TextMeta,
  Map<number, JsonMetadataObjectValidation | null>
>();

const skipJsonWhitespaceBackward = (meta: TextMeta, start: number): number => {
  let cursor = start;
  while (cursor >= 0 && JSON_WHITESPACE.has(meta.codePoints[cursor])) {
    cursor--;
  }
  return cursor;
};

const isEscapedJsonQuote = (meta: TextMeta, quotePosition: number): boolean => {
  let slashCount = 0;
  for (
    let cursor = quotePosition - 1;
    cursor >= 0 && meta.codePoints[cursor] === "\\";
    cursor--
  ) {
    slashCount++;
  }
  return slashCount % 2 === 1;
};

const jsonStringStartBefore = (
  meta: TextMeta,
  closingQuote: number,
): number | null => {
  for (let cursor = closingQuote - 1; cursor >= 0; cursor--) {
    if (meta.codePoints[cursor] === '"' && !isEscapedJsonQuote(meta, cursor)) {
      return cursor;
    }
  }
  return null;
};

const decodeJsonMetadataKey = (
  meta: TextMeta,
  openingQuote: number,
  closingQuote: number,
): JsonNumericMetadataKey | null => {
  const encodedKey = meta.codePoints
    .slice(openingQuote, closingQuote + 1)
    .join("");

  if (encodedKey === '"cursor"') return "cursor";
  if (encodedKey === '"serverTs"') return "serverTs";

  try {
    const decodedKey: unknown = JSON.parse(encodedKey);
    return decodedKey === "cursor" || decodedKey === "serverTs"
      ? decodedKey
      : null;
  } catch {
    return null;
  }
};

const jsonNumericMetadataKeyBefore = (
  meta: TextMeta,
  start: number,
): JsonNumericMetadata | null => {
  let cursor = start - 1;
  let quoted = false;

  if (cursor >= 0 && meta.codePoints[cursor] === '"') {
    quoted = true;
    cursor--;
  }
  cursor = skipJsonWhitespaceBackward(meta, cursor);
  if (cursor < 0 || meta.codePoints[cursor] !== ":") {
    return null;
  }

  cursor = skipJsonWhitespaceBackward(meta, cursor - 1);
  if (
    cursor < 0 ||
    meta.codePoints[cursor] !== '"' ||
    isEscapedJsonQuote(meta, cursor)
  ) {
    return null;
  }

  const closingQuote = cursor;
  const openingQuote = jsonStringStartBefore(meta, closingQuote);
  if (openingQuote === null) {
    return null;
  }

  cursor = skipJsonWhitespaceBackward(meta, openingQuote - 1);
  if (
    cursor >= 0 &&
    meta.codePoints[cursor] !== "{" &&
    meta.codePoints[cursor] !== ","
  ) {
    return null;
  }

  const key = decodeJsonMetadataKey(meta, openingQuote, closingQuote);
  return key === null ? null : { key, keyStart: openingQuote, quoted };
};

const jsonObjectStartBefore = (
  meta: TextMeta,
  position: number,
): number | null => {
  let depth = 0;
  let inString = false;

  for (let cursor = position - 1; cursor >= 0; cursor--) {
    const codePoint = meta.codePoints[cursor];
    if (codePoint === '"' && !isEscapedJsonQuote(meta, cursor)) {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (codePoint === "}") {
      depth++;
    } else if (codePoint === "{") {
      if (depth === 0) return cursor;
      depth--;
    }
  }

  return null;
};

type JsonObjectState =
  | "first-key-or-end"
  | "key"
  | "colon"
  | "value"
  | "comma-or-end";
type JsonArrayState = "first-value-or-end" | "value" | "comma-or-end";

interface JsonObjectNode {
  readonly children: JsonObjectNode[];
  end: number | null;
  readonly keyStarts: number[];
  readonly parent: JsonObjectNode | null;
  readonly start: number;
  syntaxValid: boolean;
}

type JsonContainer =
  | {
      readonly kind: "array";
      state: JsonArrayState;
      valid: boolean;
    }
  | {
      readonly kind: "object";
      readonly node: JsonObjectNode;
      state: JsonObjectState;
      valid: boolean;
    };

interface JsonToken {
  readonly end: number;
  readonly valid: boolean;
}

const JSON_NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
const JSON_LITERAL = /^(?:false|null|true)$/u;

const consumeJsonValue = (
  container: JsonContainer | undefined,
  valid: boolean,
): void => {
  if (container === undefined) return;

  const expectsValue =
    container.kind === "object"
      ? container.state === "value"
      : container.state === "first-value-or-end" || container.state === "value";

  if (expectsValue) {
    container.state = "comma-or-end";
  } else {
    container.valid = false;
  }
  if (!valid) container.valid = false;
};

const consumeJsonString = (
  container: JsonContainer | undefined,
  start: number,
  valid: boolean,
): void => {
  if (
    container?.kind === "object" &&
    (container.state === "first-key-or-end" || container.state === "key")
  ) {
    container.node.keyStarts.push(start);
    container.state = "colon";
    if (!valid) container.valid = false;
    return;
  }

  consumeJsonValue(container, valid);
};

const scanJsonString = (meta: TextMeta, start: number): JsonToken => {
  let valid = true;

  for (let cursor = start + 1; cursor < meta.codePoints.length; cursor++) {
    const codePoint = meta.codePoints[cursor];
    if (codePoint === '"') return { end: cursor + 1, valid };

    if (codePoint === "\\") {
      const escape = meta.codePoints[++cursor];
      if (escape === "u") {
        const hex = meta.codePoints.slice(cursor + 1, cursor + 5).join("");
        if (!/^[0-9a-fA-F]{4}$/u.test(hex)) valid = false;
        cursor += 4;
      } else if (
        escape === undefined ||
        !['"', "\\", "/", "b", "f", "n", "r", "t"].includes(escape)
      ) {
        valid = false;
      }
      continue;
    }

    if ((codePoint.codePointAt(0) ?? 0) < 0x20) valid = false;
  }

  return { end: meta.codePoints.length, valid: false };
};

const isJsonTokenBoundary = (codePoint: string | undefined): boolean =>
  codePoint === undefined ||
  JSON_WHITESPACE.has(codePoint) ||
  ['"', ",", ":", "[", "]", "{", "}"].includes(codePoint);

const scanJsonPrimitive = (meta: TextMeta, start: number): JsonToken => {
  let end = start + 1;
  while (!isJsonTokenBoundary(meta.codePoints[end])) end++;

  const token = meta.codePoints.slice(start, end).join("");
  return {
    end,
    valid: JSON_LITERAL.test(token) || JSON_NUMBER.test(token),
  };
};

const closeJsonContainer = (
  containers: JsonContainer[],
  objectStack: JsonObjectNode[],
  expectedKind: JsonContainer["kind"],
  end: number,
): void => {
  while (
    containers.length > 0 &&
    containers[containers.length - 1]?.kind !== expectedKind
  ) {
    const incomplete = containers.pop();
    if (incomplete?.kind === "object") objectStack.pop();
    consumeJsonValue(containers[containers.length - 1], false);
  }

  const container = containers.pop();
  if (container === undefined) return;

  let valid: boolean;
  if (container.kind === "object") {
    objectStack.pop();
    valid =
      container.valid &&
      (container.state === "first-key-or-end" ||
        container.state === "comma-or-end");
    container.node.end = end;
    container.node.syntaxValid = valid;
  } else {
    valid =
      container.valid &&
      (container.state === "first-value-or-end" ||
        container.state === "comma-or-end");
  }

  consumeJsonValue(containers[containers.length - 1], valid);
};

const scanJsonObjectSyntax = (
  meta: TextMeta,
  start = 0,
  stopAfterRoot = false,
): readonly JsonObjectNode[] => {
  const containers: JsonContainer[] = [];
  const objectStack: JsonObjectNode[] = [];
  const objects: JsonObjectNode[] = [];

  for (let cursor = start; cursor < meta.codePoints.length; ) {
    const codePoint = meta.codePoints[cursor];
    if (containers.length === 0 && codePoint !== "{") {
      cursor++;
      continue;
    }

    const container = containers[containers.length - 1];
    if (JSON_WHITESPACE.has(codePoint)) {
      cursor++;
    } else if (codePoint === '"') {
      const token = scanJsonString(meta, cursor);
      consumeJsonString(container, cursor, token.valid);
      cursor = token.end;
    } else if (codePoint === "{") {
      const parent = objectStack[objectStack.length - 1] ?? null;
      const node: JsonObjectNode = {
        children: [],
        end: null,
        keyStarts: [],
        parent,
        start: cursor,
        syntaxValid: false,
      };
      parent?.children.push(node);
      objects.push(node);
      objectStack.push(node);
      containers.push({
        kind: "object",
        node,
        state: "first-key-or-end",
        valid: true,
      });
      cursor++;
    } else if (codePoint === "[") {
      containers.push({
        kind: "array",
        state: "first-value-or-end",
        valid: true,
      });
      cursor++;
    } else if (codePoint === "}" || codePoint === "]") {
      closeJsonContainer(
        containers,
        objectStack,
        codePoint === "}" ? "object" : "array",
        cursor + 1,
      );
      cursor++;
      if (stopAfterRoot && objects.length > 0 && containers.length === 0) break;
    } else if (codePoint === ":") {
      if (container?.kind === "object" && container.state === "colon") {
        container.state = "value";
      } else if (container !== undefined) {
        container.valid = false;
      }
      cursor++;
    } else if (codePoint === ",") {
      if (container?.state === "comma-or-end") {
        container.state = container.kind === "object" ? "key" : "value";
      } else if (container !== undefined) {
        container.valid = false;
      }
      cursor++;
    } else {
      const token = scanJsonPrimitive(meta, cursor);
      consumeJsonValue(container, token.valid);
      cursor = token.end;
    }
  }

  return objects;
};

const cacheValidJsonObjectTree = (
  root: JsonObjectNode,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined || node.end === null) continue;
    for (const keyStart of node.keyStarts) {
      cache.set(keyStart, { end: node.end });
    }
    pending.push(...node.children);
  }
};

const cacheUnvalidatedJsonObjectKeys = (
  objects: readonly JsonObjectNode[],
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  for (const object of objects) {
    for (const keyStart of object.keyStarts) {
      if (!cache.has(keyStart)) cache.set(keyStart, null);
    }
  }
};

const nextJsonContent = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  let cursor = start;
  while (cursor < end && JSON_WHITESPACE.has(meta.codePoints[cursor])) cursor++;
  return cursor;
};

const isPotentialJsonObjectStart = (
  meta: TextMeta,
  start: number,
  end: number,
): boolean => {
  const keyStart = nextJsonContent(meta, start + 1, end);
  if (meta.codePoints[keyStart] === "}") return true;
  if (meta.codePoints[keyStart] !== '"') return false;

  const key = scanJsonString(meta, keyStart);
  return (
    key.valid && meta.codePoints[nextJsonContent(meta, key.end, end)] === ":"
  );
};

const isPotentialJsonObjectEnd = (
  meta: TextMeta,
  position: number,
  end: number,
): boolean => {
  const next = nextJsonContent(meta, position + 1, end);
  return (
    next === end ||
    meta.codePoints[next] === "," ||
    meta.codePoints[next] === "]" ||
    meta.codePoints[next] === "}"
  );
};

const cacheLexicalJsonMetadataKeys = (
  meta: TextMeta,
  start: number,
  end: number,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  let objectDepth = 0;

  for (let cursor = start; cursor < end; cursor++) {
    if (
      meta.codePoints[cursor] === "{" &&
      (cursor === start || isPotentialJsonObjectStart(meta, cursor, end))
    ) {
      objectDepth++;
      continue;
    }
    if (
      meta.codePoints[cursor] === "}" &&
      objectDepth > 1 &&
      isPotentialJsonObjectEnd(meta, cursor, end)
    ) {
      objectDepth--;
      continue;
    }
    if (meta.codePoints[cursor] !== '"' || isEscapedJsonQuote(meta, cursor)) {
      continue;
    }

    const token = scanJsonString(meta, cursor);
    const closingQuote = token.end - 1;
    if (
      token.end > end ||
      meta.codePoints[closingQuote] !== '"' ||
      decodeJsonMetadataKey(meta, cursor, closingQuote) === null
    ) {
      continue;
    }

    let next = token.end;
    while (next < end && JSON_WHITESPACE.has(meta.codePoints[next])) next++;
    if (
      objectDepth === 1 &&
      meta.codePoints[next] === ":" &&
      !cache.has(cursor)
    ) {
      cache.set(cursor, null);
    }
  }
};

const recoverUnindexedJsonMetadataObject = (
  meta: TextMeta,
  metadata: JsonNumericMetadata,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  const objectStart = jsonObjectStartBefore(meta, metadata.keyStart);
  if (objectStart === null) return;

  const objects = scanJsonObjectSyntax(meta, objectStart, true);
  const [root] = objects;
  const recoveryEnd = root?.end ?? meta.codePoints.length;
  cacheUnvalidatedJsonObjectKeys(objects, cache);
  cacheLexicalJsonMetadataKeys(meta, objectStart, recoveryEnd, cache);
  if (!cache.has(metadata.keyStart)) cache.set(metadata.keyStart, null);

  if (root?.start !== objectStart || !root.syntaxValid || root.end === null) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(
      meta.codePoints.slice(root.start, root.end).join(""),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      cacheValidJsonObjectTree(root, cache);
    }
  } catch {
    // JSON.parse remains authoritative for recovered object roots.
  }
};

const indexJsonMetadataObjects = (
  meta: TextMeta,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  const objects = scanJsonObjectSyntax(meta);
  cacheUnvalidatedJsonObjectKeys(objects, cache);

  for (const object of objects) {
    if (
      !object.syntaxValid ||
      object.end === null ||
      object.parent?.syntaxValid === true
    ) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(
        meta.codePoints.slice(object.start, object.end).join(""),
      );
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        cacheValidJsonObjectTree(object, cache);
      }
    } catch {
      // Syntax indexing is conservative; JSON.parse remains authoritative.
    }
  }
};

const hasCompleteJsonMetadataObject = (
  meta: TextMeta,
  metadata: JsonNumericMetadata,
  valueEnd: number,
): boolean => {
  let cache = JSON_METADATA_OBJECT_CACHE.get(meta);
  if (cache === undefined) {
    cache = new Map();
    JSON_METADATA_OBJECT_CACHE.set(meta, cache);
    indexJsonMetadataObjects(meta, cache);
  }

  let validation = cache.get(metadata.keyStart);
  if (validation === undefined) {
    recoverUnindexedJsonMetadataObject(meta, metadata, cache);
    validation = cache.get(metadata.keyStart);
  }
  return (
    validation !== null && validation !== undefined && validation.end > valueEnd
  );
};

const sourceSpanEquals = (
  meta: TextMeta,
  start: number,
  end: number,
  expected: string,
): boolean => {
  const expectedCodePoints = Array.from(expected);
  if (end - start !== expectedCodePoints.length) return false;

  return expectedCodePoints.every(
    (codePoint, offset) => meta.codePoints[start + offset] === codePoint,
  );
};

const hasExactJsonMetadataValueEnd = (
  meta: TextMeta,
  end: number,
  quoted: boolean,
): boolean => {
  if (quoted) return meta.codePoints[end] === '"';

  let cursor = end;
  while (
    cursor < meta.codePoints.length &&
    JSON_WHITESPACE.has(meta.codePoints[cursor])
  ) {
    cursor++;
  }

  return meta.codePoints[cursor] === "," || meta.codePoints[cursor] === "}";
};

interface NonContactNumericCandidate {
  readonly end: number;
  readonly groupEnds: readonly number[];
  readonly groups: readonly string[];
  readonly groupStarts: readonly number[];
  readonly separators: readonly string[];
}

const hasRecoverableMetadataSuffix = (
  meta: TextMeta,
  candidate: NonContactNumericCandidate,
  protectedEnd: number,
  suffixStartIndex: number,
): boolean => {
  const suffixStart = candidate.groupStarts[suffixStartIndex];
  const separator = candidate.separators[suffixStartIndex - 1];
  const suffixGroups = candidate.groups.slice(suffixStartIndex);

  return (
    suffixStart !== undefined &&
    separator !== undefined &&
    sourceSpanEquals(meta, protectedEnd, suffixStart, separator) &&
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    getStructuredFalsePositive(
      suffixGroups,
      candidate.separators.slice(suffixStartIndex),
      { hasPlus: false },
    ) === null
  );
};

export const getNonContactNumericMetadataEnd = (
  meta: TextMeta,
  start: number,
  candidate: NonContactNumericCandidate,
): number | null => {
  const { end, groupEnds, groups, separators } = candidate;

  if (
    groups.length === 1 &&
    groups[0] === "2147483648" &&
    meta.codePoints[start - 1] === "-" &&
    sourceSpanEquals(meta, start, end, "2147483648")
  ) {
    return end;
  }

  if (!/^[0-9]{13}$/u.test(groups[0] ?? "")) {
    return null;
  }

  const metadata = jsonNumericMetadataKeyBefore(meta, start);
  const firstGroupEnd = groupEnds[0];
  if (
    metadata === null ||
    firstGroupEnd === undefined ||
    !sourceSpanEquals(meta, start, firstGroupEnd, groups[0] ?? "") ||
    !hasCompleteJsonMetadataObject(meta, metadata, end)
  ) {
    return null;
  }

  let protectedEnd = firstGroupEnd;
  let nextGroupIndex = 1;

  if (metadata.key === "cursor" && groups[1] === "0" && separators[0] === "-") {
    const cursorSequenceEnd = groupEnds[1];
    if (
      cursorSequenceEnd === undefined ||
      !sourceSpanEquals(meta, start, cursorSequenceEnd, `${groups[0]}-0`)
    ) {
      return null;
    }
    protectedEnd = cursorSequenceEnd;
    nextGroupIndex = 2;
  }

  if (groups.length > nextGroupIndex) {
    if (
      !hasRecoverableMetadataSuffix(
        meta,
        candidate,
        protectedEnd,
        nextGroupIndex,
      )
    ) {
      return null;
    }
  } else if (
    !hasExactJsonMetadataValueEnd(meta, protectedEnd, metadata.quoted)
  ) {
    return null;
  }

  return protectedEnd;
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

export const getMinuteAfterTimeEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  const minute = readDigitsForward(meta, start, 2);
  if (!minute) return null;

  let separator = start - 1;
  while (separator >= 0 && meta.zeroWidth[separator]) separator--;
  if (separator < 0 || !separatorHas(meta.raw[separator], ":.")) return null;

  const hour = readHourBeforeSeparator(meta, separator);
  return isValidTimeParts(hour ?? undefined, minute.value, meta.raw[separator])
    ? extendTimeSuffixEnd(meta, minute.end)
    : null;
};

export const getSecondAfterTimeEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  const second = readDigitsForward(meta, start, 2);
  if (!second) return null;

  const seconds = Number(second.value);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;

  let secondSeparator = start - 1;
  while (secondSeparator >= 0 && meta.zeroWidth[secondSeparator]) {
    secondSeparator--;
  }
  if (secondSeparator < 0 || !separatorHas(meta.raw[secondSeparator], ":.")) {
    return null;
  }

  const minute = readDigitsBackward(meta, secondSeparator, 2);
  if (!minute) return null;

  const minuteSeparator = minute.before;
  if (minuteSeparator < 0 || !separatorHas(meta.raw[minuteSeparator], ":.")) {
    return null;
  }

  const hour = readHourBeforeSeparator(meta, minuteSeparator);
  return isValidTimeParts(
    hour ?? undefined,
    minute.value,
    meta.raw[minuteSeparator],
  )
    ? extendTimeSuffixEnd(meta, second.end, { allowFraction: true })
    : null;
};

const readVisibleDigitGroupForward = (
  meta: TextMeta,
  start: number,
): { readonly value: string; readonly end: number } | null => {
  let pos = start;
  let value = "";
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) break;
    value += meta.raw[pos];
    pos++;
  }
  return value ? { value, end: pos } : null;
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
