import {
  isWhitespaceSeparator,
  previousContent,
  previousVisible,
  skipZeroWidthForward,
} from "./boundaries.js";
import { type TextMeta } from "./meta.js";

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

export const isCoordinateLike = (
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

export const isDateTimeLike = (
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

export const readVisibleDigitGroupForward = (
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
